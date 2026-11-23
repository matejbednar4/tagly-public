import type { RequestHandler } from "express";
import { sql } from "kysely";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { db } from "../../../../db/kysely.js";
import { generateUid } from "../../../../utils/core/uids/generateUid.js";
import { applyBusinessAccessibleFilter } from "../../../../utils/businesses/businessAccessibility.js";
import { LIVE_SHARE_WHERE } from "../../../../utils/shares/shareAccess.js";
import { deleteS3KeysOrThrow } from "../../../../utils/aws/s3/deleteS3KeysOrThrow.js";
import hydrateBusinessPublicPreviews from "../../../../utils/hydrators/businesses/hydrateBusinessPublicPreviews.js";
import { getUnsharedLiveStories } from "../../../../utils/instagram/userMedia/getUnsharedLiveStories.js";
import { uploadRemoteMediaToS3 } from "../../../../utils/aws/s3/upload/uploadRemoteMediaToS3.js";
import { createMatchCheckKey } from "../../../../utils/aws/s3/helpers/createMediaKeys.js";
import { rekognitionValidateBusinessTagged } from "../../../../utils/aws/rekognition/rekognitionValidateBusinessTagged.js";
import { APP_OPEN_PROMPT } from "../../../../constants/platform/APP_OPEN_PROMPT.js";
import type {
  GetShareOpportunityQuery,
  GetShareOpportunityResponse,
} from "@tagly/models/v2/customerApp";
import { isInstagramStoryShareable } from "@tagly/models/shared";
import type { InstagramStory } from "@tagly/models/shared";

/**
 * `GET /v2/customers/me/share-opportunity` — the app-open share nudge.
 *
 * Given the device location, decides fully server-side whether to nudge the
 * customer to create a share right now. Two scenarios (a "you posted new
 * content, want to monetize it?" nudge is deliberately NOT one of them — there
 * is no in-prompt business picker to attach loose content to):
 *
 *   - `"none"`                → nothing to nudge.
 *   - `"inBusiness"`          → exactly one shareable business is within
 *                               `NEARBY_DISTANCE_METERS`; prompt "share it?".
 *   - `"inBusinessWithStory"` → same, and exactly one of the customer's live
 *                               Instagram stories has text Rekognition matches to
 *                               that business; prompt "does this story promote
 *                               this business?" with that story pre-filled.
 *
 * Flow:
 * 1. Find accessible businesses within 50 m (PostGIS `ST_DWithin` + the shared
 *    accessibility filter). Require **exactly one** — 0 or 2+ is ambiguous → none.
 * 2. Drop it if the customer already shared it in the last 24 h (a same-day
 *    re-share is rejected downstream anyway) → none.
 * 3. Hydrate the business preview (skipped businesses with unreadable geo → none).
 * 4. Fetch the live stories (best-effort — an IG failure still yields
 *    `inBusiness`), drop ones already shared in the last 24 h, and skip the
 *    Rekognition pass entirely if there are none or too many to keep it cheap.
 * 5. OCR each story against the business's name/@handle. Only when **exactly one**
 *    story clearly tags it (0 or 2+ is ambiguous) promote to `inBusinessWithStory`.
 */
export const getShareOpportunity: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { currentLat, currentLon } =
      req.validatedQuery as GetShareOpportunityQuery;

    const none: GetShareOpportunityResponse = { scenario: "none" };

    // --- Step 1: exactly one accessible business within 50 m ---

    let nearbyQuery = db
      .selectFrom("app.local_subaccounts as ls")
      .leftJoin("app.addresses as addr", "addr.id", "ls.address_id")
      .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
      .leftJoin(
        "app.advertiser_sensitive_data as asd",
        "asd.id",
        "a.sensitive_data_id"
      )
      .select(["ls.id"])
      .where(
        sql<boolean>`ST_DWithin(
          addr.location::geography,
          ST_SetSRID(ST_MakePoint(${currentLon}, ${currentLat}), 4326)::geography,
          ${APP_OPEN_PROMPT.NEARBY_DISTANCE_METERS}
        )`
      );
    nearbyQuery = applyBusinessAccessibleFilter(nearbyQuery);

    const nearbyRows = await nearbyQuery.execute();

    // 0 or 2+ businesses within 50 m is ambiguous — never nudge a wrong business.
    if (nearbyRows.length !== 1) {
      res.status(200).json(none);
      return;
    }
    const businessId = nearbyRows[0].id;

    // --- Step 2: skip if already shared today ---

    // Same gate as createShare's per-day dedup (LIVE + postedToIgAt window): a
    // rejected/voided share doesn't block a fresh share of this business, so it
    // must not suppress the nudge either — otherwise the two would disagree.
    const alreadySharedToday = await prisma.share.findFirst({
      where: {
        customerId,
        localId: businessId,
        ...LIVE_SHARE_WHERE,
        postedToIgAt: {
          gte: new Date(Date.now() - APP_OPEN_PROMPT.ONE_DAY_MS),
        },
      },
      select: { id: true },
    });
    if (alreadySharedToday) {
      res.status(200).json(none);
      return;
    }

    // --- Step 3: hydrate the business preview ---

    const previews = await hydrateBusinessPublicPreviews({
      businessIds: [businessId],
      customerId,
    });
    const business = previews[0];
    // Hydrators skip a business with unreadable geo rather than throw, so the
    // preview can be absent even though the id matched.
    if (!business) {
      res.status(200).json(none);
      return;
    }

    // --- Step 4: fetch shareable live stories (best-effort) ---

    // Any IG error (disconnected / expired token, Graph failure) degrades to the
    // plain "share it?" nudge rather than failing the whole request. Only
    // shareable stories are nudge candidates — a story whose media Instagram
    // withholds (copyright-flagged; listed for the picker's explainer tile)
    // must never become the one-tap story, since createShare rejects it (4107).
    const stories = (
      await getUnsharedLiveStories(customerId).catch(() => [])
    ).filter(isInstagramStoryShareable);

    // Skip the Rekognition pass when there's nothing to match or too many to
    // keep it cheap — the customer still gets the plain "share it?" nudge.
    if (
      stories.length < 1 ||
      stories.length > APP_OPEN_PROMPT.MAX_REKOGNITION_ITEMS
    ) {
      res.status(200).json({
        scenario: "inBusiness",
        business,
      } satisfies GetShareOpportunityResponse);
      return;
    }

    // --- Step 5: promote to a story confirmation only on an unambiguous match ---

    const matches = await matchStoriesToBusiness(stories, businessId);
    if (matches.length === 1) {
      res.status(200).json({
        scenario: "inBusinessWithStory",
        business,
        story: matches[0],
      } satisfies GetShareOpportunityResponse);
      return;
    }

    res.status(200).json({
        scenario: "inBusiness",
        business,
      } satisfies GetShareOpportunityResponse);
  }
);

/**
 * OCRs each story against the business's name/alternative-names/@handle. Uploads
 * the story frame to a temp S3 key, runs Rekognition, and cleans the key up
 * immediately. Returns every story that clearly tags the business
 * (`PASS_STRONG`/`PASS_SOFT` — the same bar the create-share gate enforces; a
 * `SUSPECT`/`FAIL` is a rejection). A per-story failure is non-fatal.
 */
async function matchStoriesToBusiness(
  stories: InstagramStory[],
  businessId: number
): Promise<InstagramStory[]> {
  const matches: InstagramStory[] = [];

  for (const story of stories) {
    // Rekognition needs a still image: use the frame for images and the
    // thumbnail for videos. A video with no thumbnail can't be OCR'd → skip.
    const imageUrl =
      story.mediaType === "VIDEO" ? story.thumbnailUrl : story.mediaUrl;
    if (!imageUrl) continue;

    let uploadedKey: string | null = null;
    try {
      const uploaded = await uploadRemoteMediaToS3({
        url: imageUrl,
        expectKind: "IMAGE",
        makeKey: (ext) =>
          createMatchCheckKey({ mediaUid: generateUid("MEDIA"), ext }),
      });
      uploadedKey = uploaded.key;

      const { classification } = await rekognitionValidateBusinessTagged({
        s3Key: uploadedKey,
        localId: businessId,
      });
      if (classification === "PASS_STRONG" || classification === "PASS_SOFT") {
        matches.push(story);
      }
    } catch {
      // A single story's upload/OCR failing is non-fatal — try the rest.
    } finally {
      if (uploadedKey) {
        await deleteS3KeysOrThrow([uploadedKey]).catch(() => {});
      }
    }
  }

  return matches;
}
