import prisma from "../../../prisma/prisma.js";
import { bumpCustomerRewardEstGen } from "../../../utils/pricing/rewardEstCache.js";
import { getDecryptedInstagramTokenForCustomer } from "../../../utils/instagram/tokens/getDecryptedIgTokenForCustomer.js";
import { getUserDataFromIG } from "../../../utils/instagram/accountInsights/getUserDataFromIg.js";
import {
  fetchAudienceCityBreakdownFromIG,
  type AudienceCityBreakdown,
} from "../../../utils/instagram/accountInsights/fetchAudienceCityBreakdownFromIG.js";
import {
  selectAndGeocodeAudienceLocations,
  type AudienceLocationRow,
} from "../../../utils/instagram/accountInsights/helpers/selectAndGeocodeAudienceLocations.js";
import type { GeocodeMemo } from "../../../utils/instagram/accountInsights/helpers/geocodeAudienceLocations.js";
import { getAudienceGenderAgeFromIG } from "../../../utils/instagram/accountInsights/getAudienceGenderAgeFromIG.js";
import { REACHED_AUDIENCE_CAPTURE } from "../../../constants/instagram/AUDIENCE_CAPTURE.js";
import { insertAudienceLocationRows } from "./insertAudienceLocationRows.js";
import { createCustomError } from "../../../utils/core/errors/createCustomError.js";
import { db } from "../../../db/kysely.js";
import { sql } from "kysely";
import type { SnapshotJob } from "./claimSnapshotJobs.js";

/**
 * Takes an Instagram snapshot for a claimed snapshot job.
 *
 * Resolves the job shape first: a **share-level** job (enqueued at share
 * creation) snapshots for that share; an **account-level** job (IG
 * reconnect/refresh, no share) snapshots the account only. A job missing its
 * customerId is unrecoverable → a permanent error (fail terminally, no retry).
 *
 * Audience locations use ONE chosen source per snapshot — **either/or**, both
 * for the stamp (`audienceLocationsSource`) and for the stored rows:
 * `reached_audience_demographics` (rolling `this_month`) when it passes the
 * `REACHED_AUDIENCE_CAPTURE` guards, else `follower_demographics`, else NULL
 * when nothing usable was captured. Only the chosen source is geocoded +
 * stored. The reached fetch is best-effort (IG suppresses the metric under
 * ~100 reached accounts by returning an empty dataset) and its failure never
 * fails the job. The pricer reads the stamped source (reached-stamped
 * snapshots carry no follower rows, so the geo calc must never assume them).
 *
 * The share's status is NOT touched (it stays PROCESSING); the payment worker
 * keys on the insights + snapshot rows existing. Payment is NOT handled here -
 * that's the payment worker's responsibility.
 */
export async function executeSnapshotJob(job: SnapshotJob): Promise<true> {
  // 0) Resolve customer + optional share from the job shape.
  let customerId: number;
  let share: { id: number } | undefined;
  if (job.share) {
    if (!job.share.customerId) {
      // 8030 — igSnapshot share missing customerId (worker 8xxx block).
      throw createCustomError(8030, "Missing customerId on share", {
        permanent: true,
      });
    }
    customerId = job.share.customerId;
    share = { id: job.share.id };
  } else {
    if (!job.instagram.customerId) {
      // 8031 — igSnapshot account missing customerId.
      throw createCustomError(8031, "Missing customerId on instagram", {
        permanent: true,
      });
    }
    customerId = job.instagram.customerId;
  }

  // 1) Auth & basic IG data
  const { accessToken, instagramUid, instagramDbId } =
    await getDecryptedInstagramTokenForCustomer(customerId);

  const { followers_count: followersCountRaw, follows_count: followsCountRaw } =
    await getUserDataFromIG(accessToken);

  const followersCount = Number.isFinite(followersCountRaw)
    ? Math.trunc(followersCountRaw as number)
    : 0;

  // Accounts the customer follows — snapshot-only (never displayed). Nullable:
  // IG may omit `follows_count` for some accounts, so store null rather than 0.
  const followingCount =
    typeof followsCountRaw === "number" && Number.isFinite(followsCountRaw)
      ? Math.trunc(followsCountRaw)
      : null;

  // 2) Audience geo. Follower breakdown is the hard-fail baseline (a thrown
  // fetch error retries the job); the reached breakdown is best-effort. One
  // geocode memo is shared so the reached→follower fallback path re-geocodes
  // overlapping cities for free.
  const geocodeMemo: GeocodeMemo = new Map();

  const followerBreakdown = await fetchAudienceCityBreakdownFromIG({
    uid: instagramUid,
    token: accessToken,
    metric: "follower_demographics",
  });

  let reachedBreakdown: AudienceCityBreakdown | null = null;
  try {
    reachedBreakdown = await fetchAudienceCityBreakdownFromIG({
      uid: instagramUid,
      token: accessToken,
      metric: "reached_audience_demographics",
      timeframe: REACHED_AUDIENCE_CAPTURE.timeframe,
    });
  } catch {
    // Best-effort: reached audience is optional — the snapshot stays
    // follower-based when the metric is unavailable.
  }

  // Choose the snapshot's audience-location source — either/or, and ONLY the
  // chosen source is geocoded + stored. Reached wins when it passes every
  // capture guard AND at least one of its cities geocodes (never commit to a
  // source we hold no usable rows for); otherwise follower; NULL = no usable
  // audience locations at all (e.g. <100 followers — IG suppresses the
  // breakdowns, or every geocode failed).
  const guards = REACHED_AUDIENCE_CAPTURE;
  const reachedPassesGuards =
    reachedBreakdown !== null &&
    reachedBreakdown.sumValue >= guards.minTotalValue &&
    reachedBreakdown.sumValue >=
      guards.minRatioOfFollowerTotal * followerBreakdown.sumValue &&
    reachedBreakdown.sumValue <=
      guards.viralMaxRatioOfFollowers * followersCount;

  let audienceLocationsSource: "FOLLOWER_AUDIENCE" | "REACHED_AUDIENCE" | null =
    null;
  let audienceLocationsTotalValue = 0;
  let audienceLocations: AudienceLocationRow[] = [];

  if (reachedBreakdown && reachedPassesGuards) {
    const reachedLocations = await selectAndGeocodeAudienceLocations({
      buckets: reachedBreakdown.buckets,
      sumValue: reachedBreakdown.sumValue,
      // Reached bands key on the window's own reach, not follower count — a
      // large account with modest monthly reach should geocode few cities.
      audienceSize: reachedBreakdown.sumValue,
      memo: geocodeMemo,
    });
    if (reachedLocations.length > 0) {
      audienceLocationsSource = "REACHED_AUDIENCE";
      audienceLocationsTotalValue = reachedBreakdown.sumValue;
      audienceLocations = reachedLocations;
    }
  }

  if (audienceLocationsSource === null) {
    const followerLocations = await selectAndGeocodeAudienceLocations({
      buckets: followerBreakdown.buckets,
      sumValue: followerBreakdown.sumValue,
      audienceSize: followersCount,
      memo: geocodeMemo,
    });
    if (followerLocations.length > 0) {
      audienceLocationsSource = "FOLLOWER_AUDIENCE";
      audienceLocationsTotalValue = followerBreakdown.sumValue;
      audienceLocations = followerLocations;
    }
  }

  // 3) Audience demographics (gender/age) - coverage/cap processed inside util
  let audienceGenderAge: { age: string; gender: string; value: number }[] = [];
  let audienceGenderAgeTotalValue = 0;
  try {
    const demoResult = await getAudienceGenderAgeFromIG(
      instagramUid,
      accessToken,
      { followerCount: followersCount },
    );
    audienceGenderAge = demoResult.buckets;
    audienceGenderAgeTotalValue = demoResult.sumValue;
  } catch {
    // Best-effort: demographics are optional for multiplier calculation
    // If this fails, the multiplier will default to 1.0x
  }

  // 4) Upsert snapshot:
  // If shareId is present → tie snapshot to that Share (reproducibility).
  // If not → create an account-level snapshot (shareId = null).
  const { snapshotId } = await prisma.$transaction(async (tx) => {
    const snapshot = share
      ? await tx.instagramSnapshot.upsert({
          where: { shareId: share.id },
          create: {
            shareId: share.id,
            instagramId: instagramDbId,
            followerCount: followersCount,
            followingCount,
            snapshotTakenAt: new Date(),
            audienceLocationsSource,
            audienceLocationsTotalValue,
            audienceGenderAgeTotalValue,
          },
          update: {
            instagramId: instagramDbId,
            followerCount: followersCount,
            followingCount,
            snapshotTakenAt: new Date(),
            audienceLocationsSource,
            audienceLocationsTotalValue,
            audienceGenderAgeTotalValue,
          },
          select: { id: true },
        })
      : await tx.instagramSnapshot.create({
          data: {
            shareId: null,
            instagramId: instagramDbId,
            followerCount: followersCount,
            followingCount,
            snapshotTakenAt: new Date(),
            audienceLocationsSource,
            audienceLocationsTotalValue,
            audienceGenderAgeTotalValue,
          },
          select: { id: true },
        });

    // Refresh the account's cached profile follower count — we just fetched a
    // fresh value from IG, so keep the display copy (drawer, account hub) current
    // for free. Following count is intentionally NOT mirrored here (snapshot-only).
    await tx.customerInstagramAccount.update({
      where: { id: instagramDbId },
      data: { followerCount: followersCount },
    });

    // (Workers no longer advance share.status — the share stays PROCESSING. The
    // snapshot row written above is what the payment worker keys on, together with
    // the insights row, approvalStatus, age, and no-open-report.)

    // Store audience gender/age demographics
    if (audienceGenderAge.length > 0) {
      // Delete existing rows for this snapshot
      await tx.instagramAudienceGenderAge.deleteMany({
        where: { snapshotId: snapshot.id },
      });

      // Insert new rows
      await tx.instagramAudienceGenderAge.createMany({
        data: audienceGenderAge.map((row) => ({
          snapshotId: snapshot.id,
          gender: row.gender,
          age: row.age,
          value: row.value,
        })),
      });
    }

    return { snapshotId: snapshot.id };
  });

  // 5) Replace audience rows for this snapshot (single batch). ALL previous
  // rows are wiped so a re-run can never leave stale rows disagreeing with the
  // stamped source; only the chosen source's rows are (re)inserted.
  await db.transaction().execute(async (trx) => {
    await sql`
    DELETE FROM "app"."instagram_audience_location"
    WHERE "snapshot_id" = ${snapshotId}
  `.execute(trx);

    if (audienceLocationsSource !== null) {
      await insertAudienceLocationRows(trx, {
        snapshotId,
        source: audienceLocationsSource,
        locations: audienceLocations,
      });
    }
  });

  // A new snapshot (reach / audience geo / demographics / follower count) is the
  // biggest reward-estimate input change → invalidate this customer's cache.
  await bumpCustomerRewardEstGen(customerId);

  // Payment is handled by the sharePaymentWorker, not here. The share stays
  // PROCESSING; with both the insights + snapshot rows present it becomes payable.

  return true;
}
