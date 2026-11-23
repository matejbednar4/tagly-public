import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { updateBusinessMediaInitCore } from "../../../../utils/businesses/write/updateBusinessMediaInitCore.js";
import type {
  AdminBusinessUidParams,
  AdminUpdateBusinessMediaInitBody,
  AdminUpdateBusinessMediaInitResponse,
} from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/businesses/:uid/media/init` — phase 1 of an admin editing a
 * business page's banner/photos (any non-DELETED page). Keep-by-uid
 * semantics and the `BUSINESS_MAX_PHOTOS` (8) cap.
 *
 * Thin wire adapter over `updateBusinessMediaInitCore` (shared with the
 * advertiser media edit); SUPER-gated.
 */
export const updateBusinessMediaInit: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminBusinessUidParams;
    const body = req.validatedBody as AdminUpdateBusinessMediaInitBody;

    const result = await updateBusinessMediaInitCore(
      { kind: "admin" },
      uid,
      body,
    );

    res.status(201).json(result satisfies AdminUpdateBusinessMediaInitResponse);
  },
);
