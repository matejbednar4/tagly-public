/**
 * Utilities for signing and verifying one-click email unsubscribe tokens.
 *
 * Tokens are signed JWTs using NOTIFICATION_UNSUBSCRIBE_SECRET (separate from
 * JWT_SECRET so they can be rotated independently without invalidating sessions).
 * No expiry — unsubscribe links must remain valid indefinitely (CAN-SPAM).
 */
import jwt from "jsonwebtoken";
import { envVariables } from "../../environment/envVariables.js";

export type UnsubscribeTokenPayload = (
  | { kind: "customer"; customerId: number }
  | { kind: "advertiser"; advertiserId: number }
  | { kind: "pendingCustomer"; pendingCustomerId: number }
  | { kind: "pendingAdvertiser"; pendingAdvertiserId: number }
) & {
  /**
   * Promo event slug of the email that carried the link — analytics only
   * (attributes `email_unsubscribed` to the step that drove the opt-out).
   * Absent on links sent before slug stamping; never used for authorization.
   */
  slug?: string;
};

export function signUnsubscribeToken(payload: UnsubscribeTokenPayload): string {
  // `noTimestamp` drops the default `iat` claim: the token carries no expiry
  // semantics anyway (unsubscribe links stay valid forever), and omitting it
  // makes the token — and therefore the whole email body — DETERMINISTIC per
  // (recipient, slug). That determinism is load-bearing: promo sends use a
  // per-job Resend Idempotency-Key, and Resend rejects a key reuse whose
  // payload changed, so a retried job must render byte-identical HTML.
  return jwt.sign(payload, envVariables.NOTIFICATION_UNSUBSCRIBE_SECRET, {
    noTimestamp: true,
  });
}

export function verifyUnsubscribeToken(
  token: string,
): UnsubscribeTokenPayload | null {
  try {
    const decoded = jwt.verify(
      token,
      envVariables.NOTIFICATION_UNSUBSCRIBE_SECRET,
    ) as UnsubscribeTokenPayload & { iat?: number };
    const slug =
      typeof decoded.slug === "string" ? { slug: decoded.slug } : {};
    if (decoded.kind === "customer" && typeof decoded.customerId === "number")
      return { kind: "customer", customerId: decoded.customerId, ...slug };
    if (decoded.kind === "advertiser" && typeof decoded.advertiserId === "number")
      return { kind: "advertiser", advertiserId: decoded.advertiserId, ...slug };
    if (decoded.kind === "pendingCustomer" && typeof decoded.pendingCustomerId === "number")
      return { kind: "pendingCustomer", pendingCustomerId: decoded.pendingCustomerId, ...slug };
    if (decoded.kind === "pendingAdvertiser" && typeof decoded.pendingAdvertiserId === "number")
      return { kind: "pendingAdvertiser", pendingAdvertiserId: decoded.pendingAdvertiserId, ...slug };
    return null;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(
  payload: UnsubscribeTokenPayload,
): string {
  const token = signUnsubscribeToken(payload);
  // Canonical path since 2026-08-02: the permanent webhooks namespace. The
  // legacy `/public/unsubscribe` mount keeps serving forever for links already
  // in the wild (tokens never expire) — additive migration, never remove it.
  //
  // Host comes from UNSUBSCRIBE_BASE_URL, not API_BASE_URL: in development the
  // latter is a portless `.local` machine name that yields a dead `http://`
  // link inside a real email. See the constant for why pointing dev at staging
  // is safe (per-env signing secret ⇒ fails closed).
  return `${envVariables.UNSUBSCRIBE_BASE_URL}/webhooks/email/unsubscribe?token=${encodeURIComponent(token)}`;
}
