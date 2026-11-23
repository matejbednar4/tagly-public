import type { RequestHandler } from "express";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { CreateShareBody } from "@tagly/models/v2/customerApp";
import { isInstagramStoryShareable } from "@tagly/models/shared";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { generateUid } from "../../../../utils/core/uids/generateUid.js";
import { bpsOfCents } from "../../../../utils/formatting/bpsOfCents.js";
import { s3Client } from "../../../../utils/clients/aws/s3.js";
import prisma from "../../../../prisma/prisma.js";
import { LIVE_SHARE_WHERE } from "../../../../utils/shares/shareAccess.js";
import { sql } from "kysely";
import { db } from "../../../../db/kysely.js";
import { Prisma } from "../../../../generated/prisma/client.js";
import { envVariables } from "../../../../environment/envVariables.js";
import { LOCK_BPS_OF_EST_PRICE } from "../../../../constants/rewards/PRICING.js";
import { assertCustomerNotBannedOrThrow } from "../../../../utils/customers/assertCustomerNotBannedOrThrow.js";
import { assertInstagramNotBannedOrThrow } from "../../../../utils/instagram/assertInstagramNotBannedOrThrow.js";
import { getDecryptedInstagramTokenForCustomer } from "../../../../utils/instagram/tokens/getDecryptedIgTokenForCustomer.js";
import { checkUserInstagramPermission } from "../../../../utils/instagram/permission/checkUserInstagramPermission.js";
import { getStoriesFromInstagram } from "../../../../utils/instagram/userMedia/getStoriesFromInstagram.js";
import { calculateEstPrices } from "../../../../utils/pricing/calculateEstPrice.js";
import { bumpCustomerRewardEstGen } from "../../../../utils/pricing/rewardEstCache.js";
import {
  businessAccessibleSql,
  hasOpenSubsidizationPeriodSql,
  hasActivePaygPeriodSql,
} from "../../../../utils/businesses/businessAccessibility.js";
import { uploadRemoteMediaToS3 } from "../../../../utils/aws/s3/upload/uploadRemoteMediaToS3.js";
import {
  createShareMediaKey,
  createShareThumbnailKey,
} from "../../../../utils/aws/s3/helpers/createMediaKeys.js";
import { rekognitionValidateBusinessTagged } from "../../../../utils/aws/rekognition/rekognitionValidateBusinessTagged.js";
import { queueInstagramInsightsJob } from "../../../../utils/queue/queueInstagramInsightsJob.js";
import { STORY_INSIGHTS_SCHEDULE } from "../../../../constants/instagram/INSTAGRAM.js";
import hydrateCustomerSharePreviews from "../../../../utils/hydrators/shares/hydrateCustomerSharePreviews.js";
import { queueInstagramSnapshotJob } from "../../../../utils/queue/queueInstagramSnapshotJob.js";

dayjs.extend(utc);

/**
 * `POST /v2/customers/shares/create` — create a share for a business from one of
 * the customer's **live Instagram stories**. Stories-only by design: the client
 * sends only `{ businessUid, storyId,
 * agreedToTermsOfMonetization }` — every media field (url, thumbnail, type,
 * dimensions, timestamp) is read from the authoritative live story fetched from
 * Instagram, never trusted from the client.
 *
 * Flow:
 *  1. Reject BANNED customers up front (no value-bearing action).
 *  2. Resolve + permission-check the customer's Instagram token.
 *  3. Fetch the live stories and locate the one matching `storyId`. A missing
 *     match means the story isn't live (>24h) or isn't owned → 4106. The matched
 *     story is the sole source for mediaUrl / thumbnailUrl / mediaType / timestamp;
 *     `igPostType` is always "STORY". A story whose media Instagram withholds
 *     (`media_url` omitted for copyright-flagged content, or a VIDEO story with
 *     no `thumbnail_url`) → 4107.
 *  4. Validate the story timestamp (1012 invalid, 1014 future). No 7-day check —
 *     live stories are inherently <24h old.
 *  5. Look up the ACTIVE business + the single accessibility gate (4001 not found,
 *     4003 not shareable). PAYG has no spend cap.
 *  6. 24h dedup against the customer's existing non-rejected shares for this
 *     business (1514).
 *  7. Estimate price/reward via the v2 pricer (5236 if unpriceable). The estimate
 *     arrives already capped to what the budget can fund (credits-only businesses).
 *  8. Classify funding mode: SUBSIDIZED / CREDITS (budget ≥ 1.5× lock) / PAYG
 *     (open period + card, no cap) / CREDITS with a partial lock (any budget > 0)
 *     / else reject (4002).
 *  9. Upload the story media (and thumbnail) to S3. Dimensions come from the
 *     image upload for an image story, or from the thumbnail upload for a video
 *     story (the video upload returns no dims). A video story with no thumbnail
 *     is an error (5103).
 * 10. Always run Rekognition business-tag validation on the image/thumbnail
 *     (no forceCreate escape hatch in v2) → 4100 on FAIL.
 * 11. Atomically create the Media row(s) + the Share, stamped
 *     `approvalStatus = PENDING`. Budget is NOT locked and the advertiser is NOT
 *     notified — both are deferred to admin approval (adminApproveShare). The IG
 *     insights job is scheduled on the STORY window (postedToIgAt +23h30m,
 *     validUntil +24h) so metrics are captured before the story expires.
 * 12. Hydrate the new share into its lean preview and respond 201.
 *
 * On any failure, every uploaded S3 object is best-effort deleted; a raced
 * unique-violation on `ig_post_id` (P2002) maps to 1013.
 */
export const createShare: RequestHandler = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  // BANNED customers cannot create shares. Fast-fail before any expensive work.
  await assertCustomerNotBannedOrThrow(customerId);

  // Consent is guaranteed `true` by the schema (z.literal(true)); we only need
  // the identifiers here and stamp the agreement time at creation.
  const { businessUid, storyId } = req.validatedBody as CreateShareBody;

  const { accessToken, instagramUid, instagramDbId } =
    await getDecryptedInstagramTokenForCustomer(customerId);

  // A banned Instagram (banned AFTER it was linked) must not keep earning —
  // the connect/registration gates alone don't cover an already-linked IG.
  await assertInstagramNotBannedOrThrow(instagramUid);

  await checkUserInstagramPermission(accessToken, instagramUid);

  // The live stories are the authoritative media source — never trust the client
  // for the media url / thumbnail / type / timestamp (there are none on the wire).
  const stories = await getStoriesFromInstagram(accessToken, instagramUid);
  const story = stories.find((s) => s.id === storyId);
  if (!story) {
    throw createCustomError(
      4106,
      "Story is not currently live or not owned by you",
      400,
    );
  }

  const mediaType = story.mediaType; // "IMAGE" | "VIDEO"
  const mediaUrl = story.mediaUrl;
  const thumbnailUrl = story.thumbnailUrl;
  const igPostType = "STORY" as const;

  // The Graph API omits `media_url` for copyright-flagged media (typically a
  // music sticker on the story), and a VIDEO story can also come back without
  // `thumbnail_url` (which we need for dimensions + Rekognition). Reject both
  // up front with a clean domain error — an empty URL used to reach the S3
  // uploader and crash `fetch("")` with a raw TypeError (prod PostHog noise,
  // 2026-08-13). The picker renders these as a non-selectable "copyrighted
  // music" placeholder, but an old build or stale stories cache can still
  // submit one.
  if (!isInstagramStoryShareable(story)) {
    throw createCustomError(
      4107,
      "Story media is not available from Instagram (copyright-restricted content)",
      400,
    );
  }

  const postedToIgAtDayjs = dayjs.utc(story.timestamp);
  if (!postedToIgAtDayjs.isValid()) {
    throw createCustomError(1012, "Invalid timestamp", 400);
  }
  if (postedToIgAtDayjs.isAfter(dayjs.utc())) {
    throw createCustomError(1014, "Post from future", 400);
  }
  const postedToIgAt = postedToIgAtDayjs.toDate();

  // Fast-fail: check business, accessibility, and funding before expensive
  // S3 / Rekognition work.
  const local = await prisma.localSubaccount.findFirst({
    where: { uid: businessUid, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      // Budget + PAYG-card are NOT read here — funding classification reads them
      // from the same Kysely accessibility snapshot below, so the funding
      // decision and the visibility gate can't reason about different balances.
      advertiser: { select: { id: true } },
    },
  });

  if (!local) {
    throw createCustomError(4001, "Business page not found or inactive", 404);
  }

  // Accessibility comes straight from the canonical SQL fragments in one query
  // (v2 folds visibility == shareability into `businessAccessibleSql`).
  // `hasActivePaygPeriod` is selected too, to classify funding below. The business
  // row exists (found above), so a missing accessibility row is an unexpected race:
  // `executeTakeFirstOrThrow` throws rather than defaulting to "inaccessible".
  const {
    isAccessible,
    isSubsidizedByPlatform,
    hasActivePaygPeriod,
    availableBudget: availableBudgetStr,
    hasPaygCard,
  } = await db
    .selectFrom("app.local_subaccounts as ls")
    .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
    .leftJoin(
      "app.advertiser_sensitive_data as asd",
      "asd.id",
      "a.sensitive_data_id",
    )
    .select([
      businessAccessibleSql.as("isAccessible"),
      hasOpenSubsidizationPeriodSql.as("isSubsidizedByPlatform"),
      hasActivePaygPeriodSql.as("hasActivePaygPeriod"),
      // Funding inputs, read from THIS same snapshot (Int8 selects as string).
      sql<string>`COALESCE(asd.available_budget_usd_cents, 0)`.as(
        "availableBudget",
      ),
      sql<boolean>`asd.saved_payment_method_id IS NOT NULL`.as("hasPaygCard"),
    ])
    .where("ls.id", "=", local.id)
    .executeTakeFirstOrThrow();

  // A single accessibility gate (visibility == shareability). PAYG has no spend
  // cap, so the only reason to be inaccessible-but-existing is a drained/negative
  // budget with no open PAYG period.
  if (!isAccessible) {
    throw createCustomError(4003, "Business is not currently shareable", 403);
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const shareInLast24h = await prisma.share.findFirst({
    where: {
      customerId,
      localId: local.id,
      ...LIVE_SHARE_WHERE,
      postedToIgAt: {
        gte: new Date(postedToIgAt.getTime() - DAY_MS),
        lte: new Date(postedToIgAt.getTime() + DAY_MS),
      },
    },
    select: { id: true },
  });
  if (shareInLast24h) {
    throw createCustomError(1514, "Already shared this business today", 400);
  }

  // `calculateEstPrices` resolves subsidized internally per business and is
  // batched, so we price the single business and read its entry from the map.
  const estMap = await calculateEstPrices({
    customerId,
    localIds: [local.id],
    postedToIgAt,
  });
  const estResult = estMap.get(local.id);
  // At this point the customer has verified Instagram — null price is unexpected.
  if (!estResult || estResult.price === null || estResult.reward === null) {
    throw createCustomError(
      5236,
      "Cannot calculate estimated reward: no Instagram data",
      400,
    );
  }
  const {
    price: estPrice,
    reward: estReward,
    averageReach: estAverageReach,
  } = estResult;

  // Amount lockBudgetForShare would reserve for a credit-funded share (1.5x
  // est). Deciding CREDITS vs PAYG against the lock amount — not the bare
  // estimate — guarantees that if we pick CREDITS the lock actually succeeds,
  // so a thin-but-PAYG-enabled advertiser falls back to the card cleanly.
  const lockCents = bpsOfCents(estPrice, LOCK_BPS_OF_EST_PRICE);

  // Funding mode (stamped immutably on the share):
  //  - SUBSIDIZED: platform-funded (open SubsidizationPeriod).
  //  - CREDITS:    available budget covers the full 1.5× lock — placed in full at
  //                admin approval.
  //  - PAYG:       no credits for the full lock, but an open PaygPeriod + card on
  //                file. The card funds the full price at settlement; PAYG has no
  //                spend cap. Takes precedence over the partial-credits path (the
  //                card is strictly better for the customer — full price).
  //  - CREDITS (partial): no PAYG, but any available budget > 0 — accept as CREDITS
  //                with a partial lock. At admin approval the lock is capped at the
  //                then-available budget (lockBudgetForShare capAtAvailableBudget).
  //                The customer already sees a capped "up to" reward while
  //                browsing (the pricer caps it).
  //  - else → reject 4002 (no budget, no PAYG).

  // Int8 comes back as a string — widen to bigint for cent math. Both funding
  // inputs come from the same accessibility snapshot as `isAccessible` above.
  const availableBudget = BigInt(availableBudgetStr);
  const paygActive = hasPaygCard && hasActivePaygPeriod;

  // INVARIANT: a business is EITHER platform-subsidized OR advertiser-owned,
  // never both — a subsidized business has no advertiser row. So the open-period
  // check here is sufficient to stamp SUBSIDIZED: there is no advertiser budget /
  // PAYG path that could keep an over-limit subsidized business accessible while
  // still classifying it subsidized. (A pure-subsidized business past
  // SUBSIDIZATION.SHARE_LIMIT already fails `businessAccessibleSql`'s under-limit
  // clause and was rejected at 4003 above.) If that mutual exclusivity is ever
  // relaxed, this must also gate on `subsidizedUnderShareLimit`.
  let fundingMode: "SUBSIDIZED" | "CREDITS" | "PAYG";
  if (isSubsidizedByPlatform) {
    fundingMode = "SUBSIDIZED";
  } else if (availableBudget >= lockCents) {
    fundingMode = "CREDITS";
  } else if (paygActive) {
    fundingMode = "PAYG";
  } else if (availableBudget > 0n) {
    // Partial-credits path: budget can't cover the full 1.5× lock but is > 0.
    // The advertiser learns of the share via `a.shares.created` at approval.
    fundingMode = "CREDITS";
  } else {
    // No notification here — `a.reminders.low-balance-failed-share` was
    // removed (2026-07-24): a drained account is already dark, and the
    // visibility reconciler owns that story (`a.account.visibility-change`).
    // The "running low, top up" nudge fires earlier, at the ledger
    // chokepoint, while the business is still visible.
    throw createCustomError(4002, "Insufficient available budget", 403);
  }

  const uploadedKeys: string[] = [];
  // Once the share + media rows are durably committed, the uploaded S3 objects
  // are live and must NEVER be deleted by the cleanup catch below — a transient
  // failure in the post-commit hydrate would otherwise orphan a persisted share
  // (dead media, and the customer can't retry: igPostId is taken). The catch
  // deletes uploads only while this is still false (pre-commit failures).
  let committed = false;
  const mainMediaUid = generateUid("MEDIA");

  try {
    // Both uploads live INSIDE the cleanup try: if the main upload succeeds and
    // the thumbnail upload then throws, the catch below deletes the already-
    // uploaded main object instead of orphaning it in S3.
    const mainUpload = await uploadRemoteMediaToS3({
      url: mediaUrl,
      expectKind: mediaType,
      makeKey: (ext) =>
        createShareMediaKey({ mediaUid: mainMediaUid, ext, stage: "PUBLIC" }),
    });
    uploadedKeys.push(mainUpload.key);

    let thumbUpload: Awaited<ReturnType<typeof uploadRemoteMediaToS3>> | null =
      null;
    let thumbUid: string | null = null;
    if (thumbnailUrl) {
      thumbUid = generateUid("MEDIA");
      thumbUpload = await uploadRemoteMediaToS3({
        url: thumbnailUrl,
        expectKind: "IMAGE",
        makeKey: (ext) =>
          createShareThumbnailKey({ mediaUid: thumbUid!, ext, stage: "PUBLIC" }),
      });
      uploadedKeys.push(thumbUpload.key);
    }

    // Server-measured dimensions for the main Media row. The v2 uploader only
    // returns width/height for IMAGE uploads (it never probes video). So:
    //  - IMAGE story → use the image upload's dims.
    //  - VIDEO story → the video upload has no dims; use the thumbnail upload's
    //    dims (stories are 9:16, and the thumbnail is a faithful still).
    let mainWidth: number | undefined;
    let mainHeight: number | undefined;
    if (mediaType === "IMAGE") {
      mainWidth = mainUpload.width;
      mainHeight = mainUpload.height;
    } else if (thumbUpload) {
      mainWidth = thumbUpload.width;
      mainHeight = thumbUpload.height;
    }
    if (!mainWidth || !mainHeight) {
      // A VIDEO story without a thumbnail leaves us no way to measure dims.
      throw createCustomError(
        5103,
        "No thumbnail to derive video story dimensions",
        500,
      );
    }
    const mainAspectRatio = mainWidth / mainHeight;

    // Rekognition: ALWAYS for stories (no forceCreate escape hatch in v2). Run
    // against the image key (image story) or the thumbnail key (video story).
    const validationKey =
      mediaType === "IMAGE" ? mainUpload.key : thumbUpload?.key;
    if (!validationKey) {
      throw createCustomError(
        5103,
        "No thumbnail to validate video story",
        500,
      );
    }
    const validation = await rekognitionValidateBusinessTagged({
      s3Key: validationKey,
      localId: local.id,
    });
    // Accept only a clear match — SUSPECT and FAIL are both rejected.
    if (
      validation.classification !== "PASS_STRONG" &&
      validation.classification !== "PASS_SOFT"
    ) {
      throw createCustomError(
        4100,
        "Story does not clearly tag this business",
        400,
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // THE dedup gate (E074): `monetized_instagram_posts` is the single
        // source of "this story was already monetized" — append-only, written
        // here in the same tx as the share, and NOT customer-linked, so the
        // once-only rule survives GDPR erasure nulling `Share.igPostId` on
        // paid rows. The insert IS the check: a PK conflict means the story
        // already has (or ever had) a share → 1013, same code as the legacy
        // unique-column race. Never re-derive dedup from `Share.igPostId`.
        try {
          await tx.monetizedInstagramPost.create({
            data: { igPostId: storyId },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ) {
            throw createCustomError(1013, "Share already exists", 409);
          }
          throw e;
        }

        const mainMedia = await tx.media.create({
          data: {
            uid: mainMediaUid,
            key: mainUpload.key,
            type: mediaType,
            mime: mainUpload.contentType,
            sizeBytes: mainUpload.sizeBytes,
            width: mainWidth,
            height: mainHeight,
            aspectRatio: mainAspectRatio,
          },
          select: { id: true },
        });

        let thumbMediaId: number | null = null;
        if (
          thumbUpload &&
          thumbUid &&
          thumbUpload.width &&
          thumbUpload.height
        ) {
          const thumbMedia = await tx.media.create({
            data: {
              uid: thumbUid,
              key: thumbUpload.key,
              type: "IMAGE",
              mime: thumbUpload.contentType,
              sizeBytes: thumbUpload.sizeBytes,
              width: thumbUpload.width,
              height: thumbUpload.height,
              aspectRatio: thumbUpload.width / thumbUpload.height,
            },
            select: { id: true },
          });
          thumbMediaId = thumbMedia.id;
        }

        const shareUid = generateUid("SHARE");
        const shareRecord = await tx.share.create({
          data: {
            uid: shareUid,
            customerId,
            advertiserId: local.advertiser?.id,
            localId: local.id,
            igPostId: storyId,
            igPostType,
            estimatedRewardCents: estReward,
            estimatedPriceCents: estPrice,
            estimatedAverageReach: estAverageReach,
            postedToIgAt,
            mediaId: mainMedia.id,
            thumbnailId: thumbMediaId ?? undefined,
            // rating omitted → null (unrated); it's half-stars now (1–10), not an enum.
            agreedToTermsOfMonetizationAt: new Date(),
            // Immutable funding classification, stamped once at creation.
            fundingModeAtCreation: fundingMode,
            // Every new share is held for admin review. While PENDING it is fully
            // hidden from the advertiser: no budget lock is placed (deferred to
            // approval), no `a.shares.created` is sent, and it is excluded from
            // every advertiser-facing query/stat. The lock + notification happen
            // at approval (adminApproveShare).
            approvalStatus: "PENDING",
          },
          select: { id: true, createdAt: true },
        });

        // STORY insights schedule: collect metrics just before the story expires,
        // with the job valid until IG's hard +24h window (offsets + the reasoning
        // behind the margin live in `STORY_INSIGHTS_SCHEDULE`). Kept on the
        // postedToIgAt window even while PENDING — the data is held until approval.
        await queueInstagramInsightsJob({
          tx,
          scheduledAt: new Date(
            postedToIgAt.getTime() + STORY_INSIGHTS_SCHEDULE.collectAfterMs,
          ),
          validUntil: new Date(
            postedToIgAt.getTime() + STORY_INSIGHTS_SCHEDULE.validForMs,
          ),
          shareId: shareRecord.id,
        });

        // Snapshot the customer's IG audience ~24h after the story was posted —
        // scheduled off `postedToIgAt`, consistent with the insights job (both
        // fire on the story's own clock, not `createdAt`). Enqueued here
        // (atomically with the share, on `tx`) rather than chained off the
        // insights worker: the snapshot is an independent job on its own clock,
        // so it should not depend on the insights job running/succeeding.
        await queueInstagramSnapshotJob({
          tx,
          instagramId: instagramDbId,
          shareId: shareRecord.id,
          scheduledAt: new Date(postedToIgAt.getTime() + 24 * 60 * 60 * 1000),
        });

        // NOTE: budget is intentionally NOT locked here. The share is created
        // PENDING and invisible to the advertiser; the lock is placed at admin
        // approval. The affordability checks above still run, so a customer is
        // rejected immediately if the business can't fund the share.

        return { share: shareRecord };
      },
      { timeout: 20000 },
    );

    // Past the commit: the Share + Media rows are durable. Anything that throws
    // from here (cache bump, hydrate) must not trigger the S3 cleanup below.
    committed = true;

    // A new share shifts the rolling share-frequency window that prices future
    // estimates → invalidate this customer's cached estimates.
    await bumpCustomerRewardEstGen(customerId);

    const hydrated = await hydrateCustomerSharePreviews({
      shareIds: [result.share.id],
    });

    // NOTE: the advertiser is NOT notified here. `a.shares.created` is sent only
    // once an admin approves the share — while PENDING it is fully hidden.
    //
    // Cents ride the wire as Zod-input bigints (coerced by the response schema),
    // so the JSON isn't annotated with the output type.
    res
      .status(201)
      .json({ message: "Share created successfully", share: hydrated[0] });
  } catch (err) {
    // Only clean up uploads for a PRE-commit failure. After commit the media is
    // referenced by a live share row — deleting it would orphan the share.
    if (!committed) {
      await Promise.all(
        uploadedKeys.map((Key) =>
          s3Client
            .send(
              new DeleteObjectCommand({
                Bucket: envVariables.S3_BUCKET,
                Key,
              }),
            )
            .catch(() => {}),
        ),
      );
    }

    // Handle race condition: another request created the share for this story
    // first (unique ig_post_id).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      Array.isArray(err.meta?.target) &&
      (err.meta.target as string[]).includes("ig_post_id")
    ) {
      throw createCustomError(1013, "Share already exists", 409);
    }

    throw err;
  }
});
