import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import {
  hashPassword,
  verifyPassword,
} from "../../../../utils/auth/hashPassword.js";
import { createAdminLoginOtpSessionAndSendEmail } from "../../../../utils/auth/otp/createAdminLoginOtpSession.js";
import type { AdminLoginBody, AdminLoginResponse } from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/public/auth/admin/login` — step 1 of admin login.
 *
 * Verifies a team email (`@taglyapp.com` or legacy `@flaer.app`) + password
 * and, on success, emails a long 64-hex verification code (step 2 = `verify`).
 * Issues **no token here** — the JWT is minted only after the emailed code is
 * verified.
 *
 * Security (preserved from the origin admin flow):
 *  - **Team-domain-only**, rejected with the same generic response as bad creds.
 *  - **Anti-enumeration:** always returns the identical generic message whether
 *    the email is unknown, inactive, non-team, or the password is wrong — the
 *    only observable difference is whether an email actually arrives.
 *  - **Timing defense:** the no-such-admin / inactive / non-team branches run a
 *    real `verifyPassword` against a pre-computed dummy hash, so response time
 *    doesn't leak account existence.
 *
 * v2 divergence from origin: no cookies (bearer-only), and no same-device
 * binding — `verify` resolves the session by email, like the customer flow.
 */
const GENERIC_RESPONSE: AdminLoginResponse = {
  message:
    "If those credentials are valid, a verification code has been sent to that email.",
};

// Pre-computed dummy hash for timing-attack prevention (lazily, once per process).
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = await hashPassword(
      "dummy_password_for_timing_attack_prevention",
    );
  }
  return dummyHash;
}

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.validatedBody as AdminLoginBody;
  const lowerCaseEmail = email.trim().toLowerCase();

  // Only team addresses can be admins — @taglyapp.com (primary) or the legacy
  // @flaer.app aliases (kept receiving in Zoho). Burn a dummy verify so a
  // rejected domain costs the same time as a real password check.
  if (
    !lowerCaseEmail.endsWith("@taglyapp.com") &&
    !lowerCaseEmail.endsWith("@flaer.app")
  ) {
    await verifyPassword(password, await getDummyHash());
    res.status(200).json(GENERIC_RESPONSE satisfies AdminLoginResponse);
    return;
  }

  const admin = await prisma.admin.findUnique({
    where: { email: lowerCaseEmail },
    select: { id: true, email: true, passwordHash: true, isActive: true },
  });

  // Unknown or deactivated admin → generic response, still burning a real verify
  // against the dummy hash to keep timing constant.
  if (!admin || !admin.isActive) {
    await verifyPassword(password, await getDummyHash());
    res.status(200).json(GENERIC_RESPONSE satisfies AdminLoginResponse);
    return;
  }

  const passwordValid = await verifyPassword(password, admin.passwordHash);
  if (!passwordValid) {
    res.status(200).json(GENERIC_RESPONSE satisfies AdminLoginResponse);
    return;
  }

  // Credentials good — email a fresh long code (upsert; no resend dance).
  await createAdminLoginOtpSessionAndSendEmail({
    adminId: admin.id,
    targetEmail: admin.email,
  });

  res.status(200).json(GENERIC_RESPONSE satisfies AdminLoginResponse);
});
