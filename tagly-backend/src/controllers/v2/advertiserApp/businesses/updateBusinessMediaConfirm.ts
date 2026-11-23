import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { updateBusinessMediaConfirmCore } from "../../../../utils/businesses/write/updateBusinessMediaConfirmCore.js";
import hydrateBusinessOwnerDetails from "../../../../utils/hydrators/businesses/hydrateBusinessOwnerDetails.js";
import type {
  GetBusinessByUidParams,
  UpdateBusinessMediaConfirmBody,
  UpdateBusinessMediaConfirmResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/businesses/:uid/media/confirm` — phase 2 of
 * editing a business page's banner/photos. Keep-by-uid semantics: `keepPhotoUids` is
 * the authoritative keep list — every current photo NOT in it is removed.
 * A pure removal calls confirm directly (no init, no pending ids).
 *
 * Thin wire adapter: the whole flow (pending-row validation, banner 16:9 +
 * Rekognition, atomic promote/swap tx, S3 cleanup) lives in
 * `updateBusinessMediaConfirmCore`, shared with the admin twin
 * (`POST /v2/admin/businesses/:uid/media/confirm`); this controller only
 * hydrates the owner-details response.
 */
export const updateBusinessMediaConfirm: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const { uid } = req.validatedParams as GetBusinessByUidParams;
    const body = req.validatedBody as UpdateBusinessMediaConfirmBody;

    const { localId } = await updateBusinessMediaConfirmCore(
      { kind: "advertiser", advertiserId },
      uid,
      body,
    );

    const business = await hydrateBusinessOwnerDetails({ businessId: localId });
    if (!business) throw createCustomError(4604, "Business not found", 404);

    res
      .status(200)
      .json({ business } satisfies UpdateBusinessMediaConfirmResponse);
  },
);
