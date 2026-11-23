import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { updateBusinessMediaInitCore } from "../../../../utils/businesses/write/updateBusinessMediaInitCore.js";
import type {
  GetBusinessByUidParams,
  UpdateBusinessMediaInitBody,
  UpdateBusinessMediaInitResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/businesses/:uid/media/init` — phase 1 of editing a
 * business page's banner/photos. Keep-by-uid semantics: the client declares the replacement banner and/or new
 * photos it will upload plus which existing photos it keeps, and gets
 * presigned S3 POSTs back (short expiry — upload immediately, then confirm).
 *
 * Thin wire adapter over `updateBusinessMediaInitCore` (shared with the admin
 * twin `POST /v2/admin/businesses/:uid/media/init`); ownership + ACTIVE is
 * this actor's lookup scope.
 */
export const updateBusinessMediaInit: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const { uid } = req.validatedParams as GetBusinessByUidParams;
    const body = req.validatedBody as UpdateBusinessMediaInitBody;

    const result = await updateBusinessMediaInitCore(
      { kind: "advertiser", advertiserId },
      uid,
      body,
    );

    res.status(201).json(result satisfies UpdateBusinessMediaInitResponse);
  },
);
