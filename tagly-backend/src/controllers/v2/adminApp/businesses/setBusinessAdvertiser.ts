import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { assertBusinessCountryMatchesAdvertiserLocaleOrThrow } from "../../../../utils/businesses/write/assertBusinessCountryMatchesAdvertiserLocaleOrThrow.js";
import { bumpBusinessRewardEstGen } from "../../../../utils/pricing/rewardEstCache.js";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import adminHydrateLocal from "../../../../utils/hydrators/admin/adminHydrateLocal.js";
import type {
  AdminBusinessUidParams,
  AdminSetBusinessAdvertiserBody,
} from "@tagly/models/v2/adminApp";

/**
 * `PATCH /v2/admin/businesses/:uid/advertiser` — hand an admin-created,
 * UNOWNED business page over to an advertiser. Deliberately NARROW (decided
 * 2026-07-24): this exists ONLY for
 * the onboarding-assist flow — the advertiser skips the business-page setup
 * step, we create the page for them in admin, then assign it. It is NOT a
 * general re-ownership tool, so it never touches shares, ratings, or money.
 *
 * That narrowness is enforced by HARD GATES:
 * - the page is ACTIVE (4610) and unowned (4616);
 * - the page has NEVER been subsidized — zero SubsidizationPeriod rows, open
 *   OR closed (4617 — a page that was ever subsidized is refused outright,
 *   never "transferred" with its subsidized shares);
 * - the page has NEVER had any shares — zero Share rows of any status (4618);
 * - the advertiser exists (4619) and their locale matches the page's country
 *   (4944, shared invariant util — once owned, the country invariant that
 *   create/update enforce for owned pages must already hold).
 *
 * The write is a single atomic claim on `advertiserId: null` (a concurrent
 * assign loses the CAS). Nothing else changes — from that moment the page is
 * an ordinary owned page: the advertiser sees it in their app, edits it, and
 * funds it with their own budget/PAYG.
 *
 * SUPER-gated in the router.
 */
export const setBusinessAdvertiser: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminBusinessUidParams;
    const { advertiserUid } = req.validatedBody as AdminSetBusinessAdvertiserBody;

    const local = await prisma.localSubaccount.findUnique({
      where: { uid },
      select: {
        id: true,
        name: true,
        status: true,
        advertiserId: true,
        address: { select: { countryCode: true } },
      },
    });
    if (!local) throw createCustomError(4043, "Business not found", 404);

    if (local.status !== "ACTIVE") {
      throw createCustomError(
        4610,
        "Only an ACTIVE business can be assigned",
        409,
      );
    }
    if (local.advertiserId !== null) {
      throw createCustomError(4616, "Business already has an advertiser", 409);
    }

    // HARD GATE: never subsidized — any period (open or closed) refuses. A
    // page with subsidization history carries platform-funded pricing history
    // this simplified handover must not inherit.
    const periodCount = await prisma.subsidizationPeriod.count({
      where: { localId: local.id },
    });
    if (periodCount > 0) {
      throw createCustomError(
        4617,
        "Business has been subsidized and cannot be assigned",
        409,
      );
    }

    // HARD GATE: never had shares — any Share row (any status) refuses. The
    // handover moves no share/money state, so there must be none to move.
    const shareCount = await prisma.share.count({
      where: { localId: local.id },
    });
    if (shareCount > 0) {
      throw createCustomError(
        4618,
        "Business already has shares and cannot be assigned",
        409,
      );
    }

    const advertiser = await prisma.advertiser.findUnique({
      where: { uid: advertiserUid },
      select: { id: true },
    });
    if (!advertiser) throw createCustomError(4619, "Advertiser not found", 404);

    // Once owned, the advertiser-locale ↔ business-country invariant must
    // hold (create/update enforce it for owned pages) — same shared util.
    await assertBusinessCountryMatchesAdvertiserLocaleOrThrow({
      advertiserId: advertiser.id,
      countryCode: local.address.countryCode,
    });

    // Atomic claim: only an (still) unowned row is assignable — a concurrent
    // assign or subsidize-then-assign race loses here instead of clobbering.
    const claimed = await prisma.localSubaccount.updateMany({
      where: { id: local.id, advertiserId: null },
      data: { advertiserId: advertiser.id },
    });
    if (claimed.count === 0) {
      throw createCustomError(4616, "Business already has an advertiser", 409);
    }

    // The page's funding path changed (unowned → this advertiser's budget) —
    // per-business generation bump (best-effort, cache fails open).
    await bumpBusinessRewardEstGen(local.id).catch(() => {});

    // Tell the new owner a page landed in their account (best-effort; deduped
    // per business so an admin retry can't double-notify).
    await queueNotificationJobs({
      advertiserIds: [advertiser.id],
      eventSlug: "a.business.assigned",
      payload: { businessName: local.name },
      dedupeKey: `business-assigned-${local.id}`,
    });

    const [business] = await adminHydrateLocal({ localIds: [local.id] });
    if (!business) throw createCustomError(4043, "Business not found", 404);

    // No `satisfies` — the hydrator emits the schema's INPUT shape.
    res.status(200).json({
      message: "Business assigned successfully",
      business,
    });
  },
);
