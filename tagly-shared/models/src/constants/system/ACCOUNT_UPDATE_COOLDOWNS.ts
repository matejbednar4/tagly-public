export const ACCOUNT_UPDATE_COOLDOWNS = {
  interestsMs: 60 * 24 * 60 * 60 * 1000, // 60 days
  referralCodeMs: 180 * 24 * 60 * 60 * 1000, // 180 days
  referrerCodeSinceCreatedMs: 24 * 60 * 60 * 1000, // 24 hours
} as const;
