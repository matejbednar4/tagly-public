import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createBusinessInitCore } from "../../../../utils/businesses/write/createBusinessInitCore.js";
import type {
  CreateBusinessInitBody,
  CreateBusinessInitResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/businesses/init` — phase 1 of creating a business
 * page (local subaccount). Money-free: type by catalog slug, photo count
 * implied by `photoMimes`, and no detail fields here (they ride the confirm
 * body).
 *
 * Thin wire adapter: the whole flow (geocode, profanity, pending row + media
 * slots, PostGIS, presigns — and the advertiser-locale ↔ business-country
 * invariant this actor gets) lives in `createBusinessInitCore`, shared with
 * the admin twin (`POST /v2/admin/businesses/init`).
 */
export const createBusinessInit: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const body = req.validatedBody as CreateBusinessInitBody;

    const result = await createBusinessInitCore(
      { kind: "advertiser", advertiserId },
      body,
    );

    res.status(201).json(result satisfies CreateBusinessInitResponse);
  },
);
