/**
 * The keys Tagly writes into a SHARE_LOCK ledger event's `meta` JSON, single-
 * sourced so the writer (`lockBudgetForShare`) references one definition
 * instead of string literals that could silently drift.
 *
 * Since the E069 policy change (2026-08-01: advertiser-funded settles always
 * pay the customer in full, drawing available negative when the lock doesn't
 * cover the final price) these markers are AUDIT-ONLY — settlement no longer
 * reads them to classify shortfalls, because there are no advertiser-side
 * shortfalls anymore. (The old reader `wasLockCappedAtAvailableBudget` was
 * removed with it.)
 */
export const SHARE_LOCK_META_KEYS = {
  /** The est. price the 1.5× lock was sized from (audit). */
  estimatedPriceCents: "estimatedPriceCents",
  /** The lock multiplier in bps (audit). */
  lockMultiplierBps: "lockMultiplierBps",
  /** Present when the lock was floored to the 1-cent minimum (zero-est share). */
  minimumLockApplied: "minimumLockApplied",
  /** True when the lock was capped at available budget (thin-budget partial lock). */
  cappedAtAvailableBudget: "cappedAtAvailableBudget",
  /** The full 1.5× amount that would have been locked, when capped (audit). */
  requestedLockCents: "requestedLockCents",
} as const;
