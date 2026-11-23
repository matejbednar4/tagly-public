import jwt, { type SignOptions } from "jsonwebtoken";
import { envVariables } from "../../environment/envVariables.js";
import {
  SessionJwtPayload,
  TOKEN_EXPIRY,
  TOKEN_ISSUER,
  TOKEN_PURPOSE,
} from "../../constants/auth/JWT.js";

/**
 * Signs a session JWT for any account type (customer or advertiser). The single
 * place v2 auth controllers mint session tokens, so the payload shape +
 * expiry/issuer stay consistent across the login, OTP, OAuth, and Instagram
 * paths.
 *
 * The payload carries no account-type discriminator — the entity is resolved
 * from the `uid` prefix at verify time (`verifyJwt` → `getEntityFromUid`), so
 * the same shape serves customers and advertisers alike.
 *
 * `expiresIn` overrides the default 14-day session window. Admin sessions MUST
 * pass `ADMIN.TOKEN_EXPIRY` (1h) — an admin token is far more dangerous than a
 * customer one, so it is deliberately short-lived. Composing this util without
 * the override silently gave admins the 14-day customer window.
 */
export function issueSessionJwt(
  account: {
    id: number;
    uid: string;
    jwtVersion: number;
  },
  options?: { expiresIn?: SignOptions["expiresIn"] },
): string {
  const payload: SessionJwtPayload = {
    uid: account.uid,
    purpose: TOKEN_PURPOSE.session,
    id: account.id,
    v: account.jwtVersion,
  };

  return jwt.sign(payload, envVariables.JWT_SECRET, {
    expiresIn: options?.expiresIn ?? TOKEN_EXPIRY.session,
    issuer: TOKEN_ISSUER,
  });
}
