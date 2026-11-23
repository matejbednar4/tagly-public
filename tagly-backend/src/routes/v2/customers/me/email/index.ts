import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import {
  StartChangeEmailBodySchema,
  VerifyChangeEmailBodySchema,
} from "@tagly/models/v2/customerApp";
import { startChangeEmail } from "../../../../../controllers/v2/customerApp/me/email/startChangeEmail.js";
import { verifyChangeEmail } from "../../../../../controllers/v2/customerApp/me/email/verifyChangeEmail.js";

/**
 * `/v2/customers/me/email/**` — the dual-OTP email change.
 *   - `POST /start-change`   send codes to the current + new email
 *   - `POST /verify-change`  verify both codes, swap the email
 * "Resend" = call `/start-change` again (idempotent; client gates on its cooldown).
 */
const r = Router();

r.post(
  "/start-change",
  validateReq("body", StartChangeEmailBodySchema),
  startChangeEmail,
);
r.post(
  "/verify-change",
  validateReq("body", VerifyChangeEmailBodySchema),
  verifyChangeEmail,
);

export default r;
