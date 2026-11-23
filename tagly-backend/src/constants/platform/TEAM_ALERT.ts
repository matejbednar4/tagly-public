/**
 * Ops team-alert tunables (the `sendTeamAlertEmail` channel). Permanent: not
 * version-coupled.
 */
export const TEAM_ALERT = {
  // Cross-instance dedupe window: the same `dedupeKey` won't re-email within this
  // period (enforced in Redis so all API + worker instances share the throttle).
  // Scope keys per (callsite + entity) so a recurring anomaly — e.g. a stuck
  // withdrawal hit every reconciliation pass — alerts once per window instead of
  // every pass, while two DISTINCT incidents still each alert.
  DEDUPE_WINDOW_MS: 6 * 60 * 60 * 1000, // 6 hours
};
