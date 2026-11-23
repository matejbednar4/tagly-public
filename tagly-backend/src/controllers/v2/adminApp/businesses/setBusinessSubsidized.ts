import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { bumpBusinessRewardEstGen } from "../../../../utils/pricing/rewardEstCache.js";
import adminHydrateLocal from "../../../../utils/hydrators/admin/adminHydrateLocal.js";
import type {
  AdminBusinessUidParams,
  AdminSetBusinessSubsidizedBody,
} from "@tagly/models/v2/adminApp";

/**
 * `PATCH /v2/admin/businesses/:uid/subsidized` — open or close the business's
 * `SubsidizationPeriod`. Two invariants: (a) subsidizing requires the page to
 * be ACTIVE (never a BANNED/DELETED page), and (b) **both paths bump the
 * business reward-estimate generation** — the previously-unwired cache
 * trigger: a subsidization start/stop switches the page between subsidized and
 * budget-funded pricing, which moves the estimate for every customer.
 *
 * Invariant (schema-documented): a business is owned (advertiser) XOR
 * subsidized — subsidizing an owned page is refused (4611); the assign
 * endpoint refuses ever-subsidized pages symmetrically.
 *
 * Money safety: closing a period does NOT touch in-flight shares — each share
 * settles per its immutable `fundingModeAtCreation` stamp (a SUBSIDIZED share
 * stays platform-funded regardless of the period closing).
 *
 * SUPER-gated in the router.
 */
export const setBusinessSubsidized: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminBusinessUidParams;
    const { isSubsidized } = req.validatedBody as AdminSetBusinessSubsidizedBody;

    const local = await prisma.localSubaccount.findUnique({
      where: { uid },
      select: {
        id: true,
        status: true,
        advertiserId: true,
        subsidizationPeriods: {
          where: { endedAt: null },
          select: { id: true },
        },
      },
    });
    if (!local) throw createCustomError(4043, "Business not found", 404);
    const openPeriod = local.subsidizationPeriods[0] ?? null;

    if (isSubsidized) {
      if (local.status !== "ACTIVE") {
        throw createCustomError(
          4610,
          "Only an ACTIVE business can be subsidized",
          409,
        );
      }
      if (local.advertiserId !== null) {
        throw createCustomError(
          4611,
          "Business has an advertiser and cannot be subsidized",
          409,
        );
      }
      if (openPeriod) {
        throw createCustomError(4612, "Business is already subsidized", 409);
      }
      await prisma.subsidizationPeriod.create({
        data: { localId: local.id },
      });
    } else {
      if (!openPeriod) {
        throw createCustomError(4613, "Business is not subsidized", 409);
      }
      await prisma.subsidizationPeriod.update({
        where: { id: openPeriod.id },
        data: { endedAt: new Date() },
      });
    }

    // Subsidization start/stop moves the reward estimate for every customer —
    // per-business generation bump (best-effort, cache fails open). This is
    // the trigger tagly-backend/CLAUDE.md tracked as "remaining unwired".
    await bumpBusinessRewardEstGen(local.id).catch(() => {});

    const [business] = await adminHydrateLocal({ localIds: [local.id] });
    if (!business) throw createCustomError(4043, "Business not found", 404);

    // No `satisfies` — the hydrator emits the schema's INPUT shape (Date /
    // bigint before coercion), same as every other hydrated admin response.
    res.status(200).json({
      message: isSubsidized
        ? "Business subsidized successfully"
        : "Subsidization ended successfully",
      business,
    });
  },
);
