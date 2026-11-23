/**
 * Google Safe Browsing v4 Lookup API config — used by
 * `utils/moderation/checkUrlSafety` to screen business-supplied links.
 */
export const SAFE_BROWSING = {
  ENDPOINT: "https://safebrowsing.googleapis.com/v4/threatMatches:find",
  REQUEST_TIMEOUT_MS: 8000, // 8 seconds
  CLIENT_ID: "tagly",
  CLIENT_VERSION: "1.0.0",
  THREAT_TYPES: [
    "MALWARE",
    "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE",
    "POTENTIALLY_HARMFUL_APPLICATION",
  ],
} as const;
