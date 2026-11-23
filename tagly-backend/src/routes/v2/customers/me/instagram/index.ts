import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import { instagramContentLimiter } from "../../../../../middleware/security/rateLimit.js";
import { ConnectInstagramBodySchema } from "@tagly/models/v2/customerApp";
import { refreshInstagram } from "../../../../../controllers/v2/customerApp/me/instagram/refreshInstagram.js";
import { getInstagramSnapshotStatus } from "../../../../../controllers/v2/customerApp/me/instagram/getInstagramSnapshotStatus.js";
import { connectInstagram } from "../../../../../controllers/v2/customerApp/me/instagram/connectInstagram.js";
import { disconnectInstagram } from "../../../../../controllers/v2/customerApp/me/instagram/disconnectInstagram.js";
import { getIgStories } from "../../../../../controllers/v2/customerApp/me/instagram/getIgStories.js";

/**
 * `/v2/customers/me/instagram/**` — the logged-in customer's Instagram surface.
 *   - `POST   /connect`         link / re-authorize IG from an OAuth code (in-app)
 *   - `DELETE /`                disconnect IG (hard delete + void in-flight shares)
 *   - `POST   /refresh`         cold-start IG probe (connection state + profile + snapshot)
 *   - `GET    /snapshot-status` poll for audience-snapshot completion
 *   - `GET    /stories`         live stories to pick from for a new share
 */
const r = Router();

r.post(
  "/connect",
  validateReq("body", ConnectInstagramBodySchema),
  connectInstagram
);
// No IG Graph call here (pure DB), so no `instagramContentLimiter` — the group's
// inherited auth + rate-limit middleware is enough.
r.delete("/", disconnectInstagram);
r.post("/refresh", refreshInstagram);
r.get("/snapshot-status", getInstagramSnapshotStatus);
// `/stories` hits the Instagram Graph API on every call, so throttle it
// per-user (`instagramContentLimiter`: ~1 req / 30s) — pull-to-refresh has no
// client cooldown, and we must not let it hammer Instagram's rate limits.
r.get("/stories", instagramContentLimiter, getIgStories);

export default r;
