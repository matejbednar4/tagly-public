import { Router } from "express";
import { validateReq } from "../../../middleware/request/validateRequest.js";
import {
  LogOutBodySchema,
  SubmitFeedbackBodySchema,
  SubmitSupportBodySchema,
} from "@tagly/models/v2/crossApp";
import { submitFeedback } from "../../../controllers/v2/crossApp/feedback.js";
import { submitSupport } from "../../../controllers/v2/crossApp/support.js";
import { agreeWithTos } from "../../../controllers/v2/crossApp/agreeWithTos.js";
import { agreeWithPrivacyPolicy } from "../../../controllers/v2/crossApp/agreeWithPrivacyPolicy.js";
import { logOut } from "../../../controllers/v2/crossApp/logout.js";

/**
 * `/v2/cross` — authed cross-app group (a valid JWT from either app). Mounted in
 * `routes/v2/index.ts` behind `verifyJwt, authedUserLimiter, gentlePerRouteLimiter`.
 */
const r = Router();

// In-app feedback / feature request → emailed to the team.
r.post(
  "/feedback",
  validateReq("body", SubmitFeedbackBodySchema),
  submitFeedback,
);

// Support / help request (e.g. ban appeal) → emailed to the support inbox.
r.post("/support", validateReq("body", SubmitSupportBodySchema), submitSupport);

// Re-accept the latest legal docs (stamps the agreed-at timestamp). No body —
// the acting user comes from the JWT. Powers the blocking app-open modals.
r.post("/terms-of-service/agree", agreeWithTos);
r.post("/privacy-policy/agree", agreeWithPrivacyPolicy);

// Logout — disable this device's push token. The client drops its own bearer
// JWT; this is the server-side half.
r.post("/logout", validateReq("body", LogOutBodySchema), logOut);

export default r;
