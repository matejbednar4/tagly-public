import crypto from "node:crypto";

/**
 * Generates a cryptographically-secure random token: a 64-char hex string
 * (256 bits of entropy). Used wherever we need an unguessable opaque token —
 * e.g. pending-account `registrationToken`s.
 *
 * Version-agnostic primitive with no feature coupling (a random token is a
  * random token), alongside `generateUid` /
 * `generateReferralCode`.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
