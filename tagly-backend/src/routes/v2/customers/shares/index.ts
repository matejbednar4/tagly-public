import { Router } from "express";
import { validateReq } from "../../../../middleware/request/validateRequest.js";
import { instagramContentLimiter } from "../../../../middleware/security/rateLimit.js";
import { blockDuringShutdown } from "../../../../middleware/shutdown/blockDuringShutdown.js";
import {
  CreateShareBodySchema,
  GetMySharesBodySchema,
  GetShareByUidParamsSchema,
} from "@tagly/models/v2/customerApp";
import { createShare } from "../../../../controllers/v2/customerApp/shares/createShare.js";
import { getShares } from "../../../../controllers/v2/customerApp/shares/getShares.js";
import { getShareByUid } from "../../../../controllers/v2/customerApp/shares/getShareByUid.js";

/**
 * `/v2/customers/shares/**` — the logged-in customer's own shares.
 *   - `POST /create` create a share from one of the customer's live IG stories
 *                    (@shutdown: CLOSED in prod — `blockDuringShutdown`, 2026-10 wind-down)
 *   - `POST /`       offset-paginated list of the customer's shares (newest first)
 *   - `GET  /:uid`   a single share's detail view
 */
const r = Router();

// `/create` hits the Instagram Graph API (to fetch the live story), so throttle
// it per-user (~1 req / 30s) like the other IG-fetching routes.
// @shutdown: share creation is closed; the list + detail below stay readable.
r.post(
  "/create",
  blockDuringShutdown, // @shutdown
  instagramContentLimiter,
  validateReq("body", CreateShareBodySchema),
  createShare,
);
r.post("/", validateReq("body", GetMySharesBodySchema), getShares);
r.get(
  "/:uid",
  validateReq("params", GetShareByUidParamsSchema),
  getShareByUid,
);

export default r;
