import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { updateBusinessCore } from "../../../../utils/businesses/write/updateBusinessCore.js";
import hydrateBusinessOwnerDetails from "../../../../utils/hydrators/businesses/hydrateBusinessOwnerDetails.js";
import type {
  GetBusinessByUidParams,
  UpdateBusinessBody,
  UpdateBusinessResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `PATCH /v2/advertisers/me/businesses/:uid` — edit one of the advertiser's
 * own business pages. Field semantics: omitted = unchanged, `null` = clear
 * (clearable fields only), `openingHours` present = replace-all. Ownership is
 * the query filter (IDOR-safe); only ACTIVE pages are editable —
 * DELETED/BANNED 404 (the 404 deliberately doesn't reveal BANNED).
 *
 * Thin wire adapter: the whole flow (profanity, re-geocode + the locale ↔
 * country invariant this actor gets, Link registry, atomic address+PostGIS
 * write, business-row tx, reward-est cache bump) lives in
 * `updateBusinessCore`, shared with the admin twin
 * (`PATCH /v2/admin/businesses/:uid`); this controller only hydrates the
 * owner-details response.
 */
export const updateBusiness: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;
  const { uid } = req.validatedParams as GetBusinessByUidParams;
  const body = req.validatedBody as UpdateBusinessBody;

  const { localId } = await updateBusinessCore(
    { kind: "advertiser", advertiserId },
    uid,
    body,
  );

  const business = await hydrateBusinessOwnerDetails({ businessId: localId });
  if (!business) throw createCustomError(4604, "Business not found", 404);

  res.status(200).json({ business } satisfies UpdateBusinessResponse);
});
