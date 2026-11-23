import { Router } from "express";
import { validateReq } from "../../../../middleware/request/validateRequest.js";
import {
  GetAdvertiserSharesBodySchema,
  ShareUidParamsSchema,
  ShareAssessmentBodySchema,
} from "@tagly/models/v2/advertiserApp";
import { getShares } from "../../../../controllers/v2/advertiserApp/shares/getShares.js";
import { getUnratedShares } from "../../../../controllers/v2/advertiserApp/shares/getUnratedShares.js";
import { getShareByUid } from "../../../../controllers/v2/advertiserApp/shares/getShareByUid.js";
import { submitShareAssessment } from "../../../../controllers/v2/advertiserApp/shares/submitShareAssessment.js";

/**
 * `/v2/advertisers/shares/**` — the logged-in advertiser's shares (across all
 * their businesses). Auth/capability middleware is applied at the group mount in
 * `routes/v2/index.ts`.
 *   - `POST /`               offset-paginated list of the advertiser's shares
 *   - `GET  /unrated`        oldest unrated shares (home strip) + outstanding count
 *   - `GET  /:uid`           a single share's detail view
 *   - `POST /:uid/assessment` rate OR report the share (discriminated body)
 *
 * `/unrated` is declared before `/:uid` so the literal path wins over the param.
 */
const r = Router();

r.post("/", validateReq("body", GetAdvertiserSharesBodySchema), getShares);
r.get("/unrated", getUnratedShares);
r.get("/:uid", validateReq("params", ShareUidParamsSchema), getShareByUid);
r.post(
  "/:uid/assessment",
  validateReq("params", ShareUidParamsSchema),
  validateReq("body", ShareAssessmentBodySchema),
  submitShareAssessment
);

export default r;
