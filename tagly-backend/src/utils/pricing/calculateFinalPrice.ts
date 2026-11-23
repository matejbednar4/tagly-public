import prisma from "../../prisma/prisma.js";
import { bpsOfCents } from "../formatting/bpsOfCents.js";
import { createCustomError } from "../core/errors/createCustomError.js";
import { applyPriceCap } from "./helpers/applyPriceCap.js";
import { calculateActionBonusesCents } from "./helpers/calculateActionBonusesCents.js";
import { calculateAudienceRelevanceBps } from "./helpers/calculateAudienceRelevanceBps.js";
import { calculateCustomerRatingBps } from "./helpers/calculateCustomerRatingBps.js";
import { calculateDemographicsBps } from "./helpers/calculateDemographicsBps.js";
import { calculateAccountQualityBps } from "./helpers/calculateAccountQualityBps.js";
import { calculateFinalBasePrice } from "./helpers/calculateFinalBasePrice.js";
import { calculateFrequencyBps } from "./helpers/calculateFrequencyBps.js";
import { calculateGeographicsBps } from "./helpers/calculateGeographicsBps.js";
import { calculateInterestsBps } from "./helpers/calculateInterestsBps.js";
import { calculateTypeBps } from "./helpers/calculateTypeBps.js";
import { getCountryMultiplierBps } from "./helpers/getCountryMultiplierBps.js";
import { LOCAL_REWARD_ALGO_VERSION } from "../../constants/rewards/META.js";
import { REWARD_TAKES } from "../../constants/rewards/PRICING.js";

export type ShareFinalPriceResult = {
  finalPriceCents: bigint;
  algoVersion: string;
  baseValueCents: bigint;
  ecpmCents: number;
  qualifiedReach: number;
  actionBonusesCents: bigint;
  geoMultiplierBps: number;
  demoMultiplierBps: number;
  interestMultiplierBps: number;
  typeMultiplierBps: number;
  ratingMultiplierBps: number;
  frequencyMultiplierBps: number;
  audienceRelevanceMultiplierBps: number;
  accountQualityMultiplierBps: number;
  // Audit values persisted on the nullable FinalPrice columns. New rows
  // always populate all three; pre-existing historical rows are NULL.
  subtotalBeforeCapCents: bigint;
  subtotalAfterCapCents: bigint;
  countryMultiplierBps: number;
  customerId: number;
};

/**
 * Calculates the final price for a local share and returns all multiplier data.
 * Does not write to the DB — the caller is responsible for persisting and settling.
 *
 * IMPORTANT: bump LOCAL_REWARD_ALGO_VERSION in constants/rewards/META.ts
 * whenever the pricing logic in this file changes.
 *
 * IMPORTANT: when any new input or intermediate value gets added to the
 * pricing pipeline, also extend the FinalPrice model in `prisma/schema.prisma`
 * so the audit row records enough state to reconstruct the math from the
 * stored row + the algoVersion-locked constants. Pre-existing FinalPrice
 * columns capture everything up to the geo×demo×… multipliers; the nullable
 * columns (`subtotalBeforeCapCents`, `countryMultiplierBps`,
 * `accountQualityMultiplierBps`) cover the cap, country-multiplier, and
 * follower:following-ratio-penalty steps. Anything new in this pipeline that
 * isn't trivially derivable from those + algoVersion-locked constants needs
 * a new column.
 */
export async function calculateFinalPrice({
  shareId,
  wasSubsidizedAtCreation,
}: {
  shareId: number;
  wasSubsidizedAtCreation: boolean;
}): Promise<ShareFinalPriceResult> {
  const share = await prisma.share.findUnique({
    where: { id: shareId },
    select: {
      id: true,
      local: {
        select: {
          type: { select: { slug: true } },
          address: { select: { countryCode: true } },
        },
      },
      localId: true,
      advertiserId: true,
      customer: {
        select: {
          interests: { select: { slug: true } },
          sensitiveData: { select: { multiplierBps: true } },
        },
      },
      customerId: true,
      igPostType: true,
      insights: true,
      postedToIgAt: true,
      instagramSnapshot: {
        select: {
          followerCount: true,
          followingCount: true,
          id: true,
          audienceLocationsSource: true,
          audienceGenderAges: {
            select: { gender: true, age: true, value: true },
          },
        },
      },
    },
  });

  if (!share) {
    throw createCustomError(5004, "share not found", 404);
  }

  if (
    share.local === null ||
    share.customer === null ||
    share.customerId === null ||
    share.localId === null ||
    share.instagramSnapshot === null ||
    share.postedToIgAt === null
  ) {
    throw createCustomError(5235, "share not valid for payout", 500);
  }

  const { basePriceCents, appliedECPMCents, qualifiedReach } =
    calculateFinalBasePrice(share);

  const actionBonusesCents = calculateActionBonusesCents(share);

  let subtotalCents = basePriceCents + actionBonusesCents;

  const { bps: geoBps } = await calculateGeographicsBps({
    localId: share.localId,
    snapshot: share.instagramSnapshot,
  });
  const demoBps = calculateDemographicsBps({
    local: share.local,
    audienceGenderAges: share.instagramSnapshot.audienceGenderAges as {
      gender: "M" | "F" | "U";
      age: string;
      value: number;
    }[],
  });
  const interestsBps = calculateInterestsBps(share);
  // Intrinsic business-type multiplier (cafe discount, sports-fitness boost, …) —
  // prices the category itself, unlike the interests/demo MATCH multipliers.
  const typeBps = calculateTypeBps(share.local.type.slug);
  const { bps: customerRatingBps } = calculateCustomerRatingBps({
    customerMultiplierBps: share.customer.sensitiveData.multiplierBps,
  });
  const { bps: frequencyBps } = await calculateFrequencyBps({
    since: share.postedToIgAt,
    customerId: share.customerId,
    localId: share.localId,
    shareId: share.id,
  });
  // Account authenticity, keyed on the snapshot's FOLLOWER count — not on
  // qualifiedReach. Reach is already paid for in basePriceCents; see the helper.
  const audienceRelevanceBps = calculateAudienceRelevanceBps({
    followerCount: share.instagramSnapshot.followerCount,
  });
  // Decrease-only account-quality penalty from the follower:following ratio
  // (neutral 10_000 when the ratio is healthy / unknown / a large account). The
  // message slug is estimate-only, so settlement ignores it.
  const { bps: accountQualityBps } = calculateAccountQualityBps({
    followerCount: share.instagramSnapshot.followerCount,
    followingCount: share.instagramSnapshot.followingCount,
  });

  // Geo first, and it is NOT a bonus: since v12 geoBps is the 0..1 fraction of
  // reach that counts as local, so this step converts a price over RAW reach
  // into a price over LOCAL reach (the eCPMs are per 1000 local views).
  subtotalCents = bpsOfCents(subtotalCents, geoBps);
  subtotalCents = bpsOfCents(subtotalCents, demoBps);
  subtotalCents = bpsOfCents(subtotalCents, interestsBps);
  subtotalCents = bpsOfCents(subtotalCents, typeBps);
  subtotalCents = bpsOfCents(subtotalCents, customerRatingBps);
  subtotalCents = bpsOfCents(subtotalCents, frequencyBps);
  subtotalCents = bpsOfCents(subtotalCents, audienceRelevanceBps);
  subtotalCents = bpsOfCents(subtotalCents, accountQualityBps);

  // Snapshot the post-multiplier subtotal for audit. This is the only piece
  // of information the cap step destroys (and isn't recoverable from
  // finalPriceCents because the cap is one-way). Everything else in the
  // pipeline below — the cap value used, the subsidized discount, the take —
  // is derivable from this value plus the algoVersion-locked constants plus
  // the SubsidizationPeriod overlap on share.createdAt.
  const subtotalBeforeCapCents = subtotalCents;

  const cappedCents = applyPriceCap(subtotalCents, wasSubsidizedAtCreation);

  // For subsidized shares there is no platform take — the capped amount is
  // already the net reward (capped × 60%). For regular shares
  // usScaleFinalCents is the gross; settlement deducts the take from there.
  const usScaleFinalCents = wasSubsidizedAtCreation
    ? bpsOfCents(cappedCents, 10_000 - REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS)
    : cappedCents;

  // Country-specific multiplier — the ECPM curve, action bonuses, and cap
  // are all defined in USD. For non-US locals (currently only CZ) we scale
  // the final amount to local market pricing. The fallback (DEFAULT) is the
  // US rate so an unmapped country pays the same as the US rather than zero.
  const countryMultiplierBps = getCountryMultiplierBps(
    share.local.address.countryCode,
  );
  const finalPriceCents = bpsOfCents(usScaleFinalCents, countryMultiplierBps);

  return {
    finalPriceCents,
    algoVersion: LOCAL_REWARD_ALGO_VERSION,
    baseValueCents: basePriceCents,
    ecpmCents: appliedECPMCents,
    qualifiedReach,
    actionBonusesCents,
    geoMultiplierBps: geoBps,
    demoMultiplierBps: demoBps,
    interestMultiplierBps: interestsBps,
    typeMultiplierBps: typeBps,
    ratingMultiplierBps: customerRatingBps,
    frequencyMultiplierBps: frequencyBps,
    audienceRelevanceMultiplierBps: audienceRelevanceBps,
    accountQualityMultiplierBps: accountQualityBps,
    subtotalBeforeCapCents,
    subtotalAfterCapCents: cappedCents,
    countryMultiplierBps,
    customerId: share.customerId,
  };
}
