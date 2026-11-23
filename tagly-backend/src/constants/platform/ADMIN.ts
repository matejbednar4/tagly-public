/**
 * Admin authentication tunables.
 *
 * OTP_EXPIRATION_MS: How long the magic link OTP is valid.
 * TOKEN settings: Admin JWT session duration.
 */
export const ADMIN = {
  // OTP / Magic link settings
  OTP_EXPIRATION_MS: 3 * 60 * 1000, // 3 minutes

  // JWT session settings
  TOKEN_EXPIRY: "1h", // String format for jwt.sign (1 hour)
} as const;
