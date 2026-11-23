import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import { ConfirmDeleteAccountBodySchema } from "@tagly/models/v2/advertiserApp";
import { startDeleteAccount } from "../../../../../controllers/v2/advertiserApp/me/delete-account/startDeleteAccount.js";
import { confirmDeleteAccount } from "../../../../../controllers/v2/advertiserApp/me/delete-account/confirmDeleteAccount.js";

/**
 * `/v2/advertisers/me/delete-account/**` — OTP-gated account deletion.
 *   - `POST /start`    send an ACCOUNT_DELETION code to the current email
 *   - `POST /confirm`  verify the code, forfeit budget, hard-delete the account
 * "Resend" = call `/start` again (idempotent; client gates on its cooldown).
 */
const r = Router();

r.post("/start", startDeleteAccount);
r.post(
  "/confirm",
  validateReq("body", ConfirmDeleteAccountBodySchema),
  confirmDeleteAccount,
);

export default r;
