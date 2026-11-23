export const TOKEN_PURPOSE = {
  session: "session",
  passwordReset: "password_reset",
  recentAuth: "recent_auth",
} as const;

export type TokenPurpose = (typeof TOKEN_PURPOSE)[keyof typeof TOKEN_PURPOSE];

export const TOKEN_ISSUER = "tagly";

// Sessions live 14 days, so tokens minted before the rebrand still carry the
// old issuer. Verification accepts both; TODO drop "flaer" once pre-rebrand
// sessions have all expired.
export const ACCEPTED_TOKEN_ISSUERS: [string, ...string[]] = [
  "tagly",
  "flaer",
];

export const TOKEN_EXPIRY = {
  session: "14d",
  passwordReset: "15m",
  recentAuth: "15m",
} as const;

export interface BaseJwtPayload {
  // Base JWT payload structure
  uid: string;
  purpose: TokenPurpose;
}

export interface SessionJwtPayload extends BaseJwtPayload {
  // Session token includes additional fields
  purpose: typeof TOKEN_PURPOSE.session;
  id: number;
  v: number; // jwtVersion for invalidation
}

export interface PasswordResetJwtPayload extends BaseJwtPayload {
  // Password reset token
  purpose: typeof TOKEN_PURPOSE.passwordReset;
  jti: string; // unique token identifier
}

export interface RecentAuthJwtPayload extends BaseJwtPayload {
  // Recent auth token (for sensitive operations)
  purpose: typeof TOKEN_PURPOSE.recentAuth;
}
