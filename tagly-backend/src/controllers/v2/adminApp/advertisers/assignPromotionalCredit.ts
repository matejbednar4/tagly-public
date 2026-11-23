import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { createPromotionalCreditEvent } from "../../../../utils/money/ledger/events/createPromotionalCreditEvent.js";
import { retrieveAvailableStripeBalance } from "../../../../utils/money/stripe/retrieveAvailableStripeBalance.js";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import type {
  AdminAdvertiserUidParams,
  AdminAssignPromotionalCreditBody,
  AdminAssignPromotionalCreditResponse,
} from "@tagly/models/v2/adminApp";
import { PROMOTIONAL_CREDITS } from "@tagly/models/shared";

/**
 * `POST /v2/admin/advertisers/:uid/promotional-credit` — gift an advertiser
 * promotional credits.
 *
 * Flow: cap the amount at PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS, then in one
 * transaction verify the platform's *unassigned* Stripe balance covers the
 * gift and write the zero-sum PROMOTIONAL_CREDIT ledger event (platform →
 * advertiser available budget). The estimate-cache bump happens automatically
 * inside the ledger chokepoint (`applyBalancesFromEvent`).
 *
 * Idempotency: the externalRef is hour-bucketed per advertiser
 * (`promo:advertiser:{id}:{YYYY-MM-DDTHH}`), so at most one promotional credit
 * per advertiser per hour — a duplicate within the window 409s.
 */
export const assignPromotionalCredit: RequestHandler = asyncHandler(
  async (req, res) => {
    const adminId = req.user.id;
    const adminUid = req.user.uid;
    const { uid: advertiserUid } = req.validatedParams as AdminAdvertiserUidParams;
    const { amountCents, reason } =
      req.validatedBody as AdminAssignPromotionalCreditBody;

    // Belt-and-suspenders on top of the Zod max
    if (amountCents > PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS) {
      throw createCustomError(
        4950,
        `Amount exceeds max promotional credit of ${PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS} cents`,
        400,
      );
    }

    const advertiser = await prisma.advertiser.findUnique({
      where: { uid: advertiserUid },
      select: { id: true, uid: true },
    });
    if (!advertiser) {
      throw createCustomError(4043, "Advertiser not found", 404);
    }

    // One promo credit per advertiser per hour
    const hourBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const externalRef = `promo:advertiser:${advertiser.id}:${hourBucket}`;

    const result = await prisma.$transaction(async (tx) => {
      // DB sums are transactional; the Stripe API read inside isn't, but the
      // platform balance moves slowly and this is an admin-only endpoint.
      const { unassignedCents } = await retrieveAvailableStripeBalance(tx);
      if (unassignedCents < amountCents) {
        // 4953 (4951 means "profanity" in the business endpoints).
        throw createCustomError(
          4953,
          `Insufficient unassigned balance. Available: ${unassignedCents} cents, Requested: ${amountCents} cents`,
          400,
        );
      }

      const { event, created } = await createPromotionalCreditEvent(tx, {
        advertiserId: advertiser.id,
        amountCents,
        currency: "usd",
        externalRef,
        meta: {
          assignedByAdminId: adminId,
          assignedByAdminUid: adminUid,
          ...(reason ? { reason } : {}),
        },
      });
      if (!created) {
        throw createCustomError(
          4952,
          "Duplicate promotional credit assignment",
          409,
        );
      }

      const updated = await tx.advertiser.findUnique({
        where: { id: advertiser.id },
        select: {
          sensitiveData: { select: { availableBudgetUsdCents: true } },
        },
      });

      return {
        eventId: event.id,
        newAvailableBudgetCents: Number(
          updated?.sensitiveData?.availableBudgetUsdCents ?? 0n,
        ),
      };
    });

    // Best-effort, after commit. Dedupe mirrors the hour-bucketed ledger
    // idempotency, so a retried request can't double-notify.
    await queueNotificationJobs({
      advertiserIds: [advertiser.id],
      eventSlug: "a.balance.promo-credit",
      payload: { amountFormatted: `$${(amountCents / 100).toFixed(2)}` },
      dedupeKey: `promo-credit-${advertiser.id}-${hourBucket}`,
    });

    res.status(201).json({
      message: "Promotional credit assigned successfully",
      eventId: result.eventId,
      advertiserUid: advertiser.uid,
      amountCents,
      newAvailableBudgetCents: result.newAvailableBudgetCents,
    } satisfies AdminAssignPromotionalCreditResponse);
  },
);
