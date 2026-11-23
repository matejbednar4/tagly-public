/**
 * OpenID Connect verification config for the social sign-in providers. The
 * accepted audiences (client / bundle ids) come from env
 * (`GOOGLE_OAUTH_CLIENT_IDS` / `APPLE_OAUTH_CLIENT_IDS`); only the public,
 * stable JWKS endpoints + token issuers live here.
 */
export const OAUTH = {
  GOOGLE: {
    JWKS_URI: "https://www.googleapis.com/oauth2/v3/certs",
    // Google ID tokens carry either form of the issuer.
    ISSUERS: ["https://accounts.google.com", "accounts.google.com"],
  },
  APPLE: {
    JWKS_URI: "https://appleid.apple.com/auth/keys",
    ISSUERS: ["https://appleid.apple.com"],
  },
} as const;
