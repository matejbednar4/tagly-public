import { Router } from "express";
import { signOutOtherSessions } from "../../../../../controllers/v2/advertiserApp/me/security/signOutOtherSessions.js";

/**
 * `/v2/advertisers/me/security/**` — session / account-security actions.
 *   - `POST /sign-out-others`  revoke every other session (bump token version),
 *                              re-issue this device a fresh token
 */
const r = Router();

r.post("/sign-out-others", signOutOtherSessions);

export default r;
