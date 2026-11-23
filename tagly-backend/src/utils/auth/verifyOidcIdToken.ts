import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createCustomError } from "../core/errors/createCustomError.js";

/**
 * Verifies a Google / Apple OpenID Connect **ID token** (an RS256 JWT) against
 * the provider's published JWKS, via `jose`.
 *
 * `createRemoteJWKSet` owns the network + key handling: it fetches the JWKS,
 * caches it, dedups concurrent fetches, and refreshes on `kid` rotation with a
 * built-in cooldown (so a flood of tokens with bad/rotated key ids can't hammer
 * the provider). `jwtVerify` then checks signature + `iss` + `aud` + expiry and
 * pins the algorithm to RS256. Returns the decoded claims the auth controllers
 * need (`sub`, `email`, …).
 */

// One cached key set per JWKS URI (Google + Apple each get their own). The
// JWKSet instance is the cache, so it must be reused across calls.
const jwksByUri = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function getJwks(uri: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksByUri.get(uri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(uri));
    jwksByUri.set(uri, jwks);
  }
  return jwks;
}

export type VerifiedIdToken = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  nonce: string | null;
};

export async function verifyOidcIdToken(opts: {
  token: string;
  jwksUri: string;
  issuer: string | string[];
  /** Accepted audiences (the configured OAuth client / bundle ids). */
  audience: string[];
}): Promise<VerifiedIdToken> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(opts.token, getJwks(opts.jwksUri), {
      issuer: opts.issuer,
      audience: opts.audience,
      algorithms: ["RS256"], // Google + Apple both sign ID tokens with RS256
    }));
  } catch {
    throw createCustomError(2233, "Identity token verification failed", 401);
  }

  if (!payload.sub) {
    throw createCustomError(2234, "Identity token missing subject", 401);
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified:
      payload.email_verified === true || payload.email_verified === "true",
    name: typeof payload.name === "string" ? payload.name : null,
    nonce: typeof payload.nonce === "string" ? payload.nonce : null,
  };
}
