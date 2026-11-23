import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { mediaPreviewSelect } from "../../../prisma/selects/shared/common/media.preview.select.js";
import adminHydrateLedgerEvents from "./adminHydrateLedgerEvents.js";
import { deriveCustomerShareStatus } from "../shares/deriveCustomerShareStatus.js";
import { deriveAdvertiserShareStatus } from "../shares/deriveAdvertiserShareStatus.js";
import {
  isAdminApprovedShare,
  isAdminAssessableShare,
} from "../../shares/shareAccess.js";
import type { AdminShareInput } from "@tagly/models/v2/adminApp";

/**
 * Hydrates shares into the full admin view, preserving input order. Shows the
 * status from three angles — the customer-facing derivation, the advertiser-facing
 * derivation, and the raw axes — plus the full FinalPrice audit row, the ledger
 * money trail, and the settlement-retry / last-error bookkeeping. The composite
 * select is inlined (single consumer, per the v2 selects guidance).
 *
 * `finalPriceCents` / `finalRewardCents` / `totalPlatformDeltaCents` are derived
 * from the ledger (the money source of truth), NOT from the FinalPrice row (which
 * is the algo's computed price, not what actually moved).
 */
export default async function adminHydrateShare(
  opts: { shareId: number } | { shareIds: number[] },
): Promise<AdminShareInput[]> {
  const ids = "shareId" in opts ? [opts.shareId] : opts.shareIds;
  if (ids.length === 0) return [];

  const shares = await prisma.share.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      uid: true,
      createdAt: true,
      paidAt: true,
      postedToIgAt: true,
      ratedAt: true,
      customerId: true, // null (customer deleted) → not assessable
      forceCreated: true,
      estimatedPriceCents: true,
      estimatedRewardCents: true,
      estimatedAverageReach: true,
      rating: true,
      igPostId: true,
      igPostType: true,
      status: true,
      approvalStatus: true,
      reviewedAt: true,
      reviewedByAdminId: true,
      rejectionReason: true,
      fundingModeAtCreation: true,
      lastProcessingError: true,
      lastProcessingErrorAt: true,
      paygChargeAttempts: true,
      paygNextRetryAt: true,
      stripePaymentIntentId: true,
      media: { select: mediaPreviewSelect },
      thumbnail: { select: mediaPreviewSelect },
      local: {
        select: {
          uid: true,
          name: true,
          banner: { select: mediaPreviewSelect },
          type: { select: { slug: true } },
          instagramTag: true,
          address: { select: { city: true } },
        },
      },
      advertiser: { select: { uid: true } },
      report: {
        select: {
          reportType: true,
          reportMessage: true,
          status: true,
          reviewMessage: true,
          reviewedById: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
      insights: {
        select: {
          reach: true,
          views: true,
          shares: true,
          totalInteractions: true,
          follows: true,
          profileVisits: true,
          comments: true,
          likes: true,
          saved: true,
          replies: true,
          tapsForward: true,
          tapsBack: true,
          exits: true,
          igReelsAvgWatchTime: true,
        },
      },
      finalPrice: {
        select: {
          algoVersion: true,
          currency: true,
          qualifiedReach: true,
          ecpmCents: true,
          baseValueCents: true,
          actionBonusesCents: true,
          geoMultiplierBps: true,
          demoMultiplierBps: true,
          interestMultiplierBps: true,
          typeMultiplierBps: true,
          ratingMultiplierBps: true,
          frequencyMultiplierBps: true,
          audienceRelevanceMultiplierBps: true,
          accountQualityMultiplierBps: true,
          subtotalBeforeCapCents: true,
          subtotalAfterCapCents: true,
          countryMultiplierBps: true,
          finalPriceCents: true,
          settledGrossCents: true,
          capReason: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      customer: {
        select: {
          uid: true,
          fullName: true,
          status: true,
          instagram: { select: { username: true, pfpUrl: true } },
          sensitiveData: { select: { multiplierBps: true } },
        },
      },
      ledgerEvents: { select: { id: true } },
    },
  });

  if (shares.length === 0) return [];

  // Batch-hydrate every ledger event across all shares, then re-map per share.
  const allLedgerEventIds = shares.flatMap((s) =>
    s.ledgerEvents.map((e) => e.id),
  );
  const hydratedLedgerEvents =
    allLedgerEventIds.length > 0
      ? await adminHydrateLedgerEvents({ ledgerEventIds: allLedgerEventIds })
      : [];
  const ledgerEventById = new Map(
    allLedgerEventIds.map((id, i) => [id, hydratedLedgerEvents[i]!]),
  );

  const shareById = new Map(shares.map((s) => [s.id, s]));

  return ids.map((id) => {
    const s = shareById.get(id);
    if (!s) {
      throw createCustomError(4297, `Share not found for id ${id}`, 404);
    }

    const shareLedgerEvents = s.ledgerEvents.map(
      (e) => ledgerEventById.get(e.id)!,
    );

    // finalPriceCents from SHARE_PAYMENT events. Regular: advertiser debits;
    // subsidized: advertiser deltas are 0, use the customer payout.
    const payments = shareLedgerEvents.filter((e) => e.kind === "SHARE_PAYMENT");
    const finalPriceCents =
      payments.length > 0
        ? payments.reduce((sum, e) => {
            const advertiserDelta =
              BigInt(e.deltaAdvertiserCents) +
              BigInt(e.deltaAdvertiserLockedCents);
            const subsidizedDelta = BigInt(e.deltaCustomerCents);
            const delta =
              advertiserDelta !== 0n ? -advertiserDelta : subsidizedDelta;
            return sum + delta;
          }, 0n)
        : null;

    const finalRewardCents =
      payments.length > 0
        ? payments.reduce((sum, e) => sum + BigInt(e.deltaCustomerCents), 0n)
        : null;

    const totalPlatformDeltaCents =
      shareLedgerEvents.length > 0
        ? shareLedgerEvents.reduce(
            (sum, e) => sum + BigInt(e.deltaPlatformCents),
            0n,
          )
        : null;

    const reportStatus = s.report?.status ?? null;

    return {
      uid: s.uid,

      customerStatus: deriveCustomerShareStatus({
        status: s.status,
        approvalStatus: s.approvalStatus,
        reportStatus,
      }),
      advertiserStatus: deriveAdvertiserShareStatus({
        status: s.status,
        reportStatus,
      }),
      visibleToAdvertiser: isAdminApprovedShare(s),
      // "The admin should rate this in the advertiser's stead" — approved +
      // SUBSIDIZED + unassessed + has a customer (same predicate the admin
      // unrated queue filters on). Twin of ADMIN_ASSESSABLE_SHARE_WHERE.
      shouldAssessShare: isAdminAssessableShare(s),
      rawStatus: s.status,
      approvalStatus: s.approvalStatus,
      reviewedAt: s.reviewedAt,
      reviewedByAdminId: s.reviewedByAdminId,
      rejectionReason: s.rejectionReason,
      fundingModeAtCreation: s.fundingModeAtCreation,
      report: s.report ?? null,

      media: s.media,
      thumbnail: s.thumbnail,
      igPostId: s.igPostId,
      igPostType: s.igPostType,
      postedToIgAt: s.postedToIgAt,

      estimatedPriceCents: s.estimatedPriceCents,
      estimatedRewardCents: s.estimatedRewardCents,
      estimatedAverageReach: s.estimatedAverageReach,

      finalPriceCents,
      finalRewardCents,
      totalPlatformDeltaCents,
      finalPrice: s.finalPrice ?? null,

      ratingStars: s.rating,
      ratedAt: s.ratedAt,

      // Unified insights need the post-type discriminator; drop to null if the
      // share never got a type (no insights possible then anyway).
      insights:
        s.insights && s.igPostType
          ? { postType: s.igPostType, ...s.insights }
          : null,

      createdAt: s.createdAt,
      paidAt: s.paidAt,
      lastProcessingError: s.lastProcessingError,
      lastProcessingErrorAt: s.lastProcessingErrorAt,
      paygChargeAttempts: s.paygChargeAttempts,
      paygNextRetryAt: s.paygNextRetryAt,
      stripePaymentIntentId: s.stripePaymentIntentId,
      forceCreated: s.forceCreated,

      ledgerEvents: shareLedgerEvents,

      local: s.local
        ? {
            uid: s.local.uid,
            name: s.local.name,
            banner: s.local.banner,
            type: { slug: s.local.type.slug },
            instagramTag: s.local.instagramTag,
            city: s.local.address.city,
          }
        : null,
      customer: s.customer
        ? {
            uid: s.customer.uid,
            fullName: s.customer.fullName,
            instagramUsername: s.customer.instagram?.username ?? null,
            instagramPfpUrl: s.customer.instagram?.pfpUrl ?? null,
            multiplierBps: s.customer.sensitiveData.multiplierBps,
            status: s.customer.status,
          }
        : null,
      advertiserUid: s.advertiser?.uid ?? null,
    };
  });
}
