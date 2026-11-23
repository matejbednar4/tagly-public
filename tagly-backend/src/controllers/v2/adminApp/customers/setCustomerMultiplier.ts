import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import { bumpCustomerRewardEstGen } from "../../../../utils/pricing/rewardEstCache.js";
import { CUSTOMER_RATING_MULTIPLIER } from "../../../../constants/rewards/CUSTOMER_RATING.js";
import adminHydrateCustomer from "../../../../utils/hydrators/admin/adminHydrateCustomer.js";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import type {
  AdminCustomerUidParams,
  AdminSetCustomerMultiplierBody,
} from "@tagly/models/v2/adminApp";

/**
 * `PATCH /v2/admin/customers/:uid/multiplier` — set the customer's rating
 * multiplier to an ABSOLUTE value (not a delta): lets an admin correct a
 * multiplier that rating deltas or a
 * rejection penalty drove somewhere wrong.
 *
 * The value must be inside the v2 rating-algorithm bounds
 * (`CUSTOMER_RATING_MULTIPLIER.minBps..maxBps`) — out of range is rejected
 * (1544), not clamped, so the admin sees exactly what they set. After the
 * write the customer's reward-estimate generation is bumped (mandatory — the
 * multiplier feeds every cached estimate for this customer).
 *
 * No audit reason (decided 2026-07-24): the change itself is visible on the
 * customer detail; there is no ledger event or audit sink for non-money
 * admin actions.
 *
 * SUPER-gated in the router.
 */
export const setCustomerMultiplier: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminCustomerUidParams;
    const { multiplierBps } = req.validatedBody as AdminSetCustomerMultiplierBody;

    const { minBps, maxBps } = CUSTOMER_RATING_MULTIPLIER;
    if (multiplierBps < minBps || multiplierBps > maxBps) {
      throw createCustomError(
        1544,
        `Multiplier must be between ${minBps} and ${maxBps} bps`,
        400,
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { uid },
      // The multiplier lives on the sensitive-data row (with the balances).
      select: { id: true, sensitiveData: { select: { id: true } } },
    });
    if (!customer) throw createCustomError(4043, "Customer not found", 404);
    if (!customer.sensitiveData) {
      throw createCustomError(1545, "Customer sensitive data missing", 500);
    }

    await prisma.customerSensitiveData.update({
      where: { id: customer.sensitiveData.id },
      data: { multiplierBps },
    });

    // The multiplier feeds every cached reward estimate for this customer —
    // bump their generation (best-effort, cache fails open).
    await bumpCustomerRewardEstGen(customer.id).catch(() => {});

    // Tell the customer their rating moved (best-effort; deduped daily so a
    // correction shortly after doesn't double-ping).
    await queueNotificationJobs({
      customerIds: [customer.id],
      eventSlug: "c.account.multiplier-updated",
      dedupeKey: `multiplier-updated-${customer.id}-${new Date().toISOString().slice(0, 10)}`,
    });

    const hydrated = await adminHydrateCustomer({ customerId: customer.id });

    // No `satisfies` — the hydrator emits the schema's INPUT shape.
    res.status(200).json({
      message: "Multiplier updated successfully",
      customer: hydrated,
    });
  },
);
