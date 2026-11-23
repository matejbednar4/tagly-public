// Your interest util returns BPS. Enforce global bounds here.
export const INTERESTS_BOUNDS = {
  minBps: 5_000, // 0.50x
  maxBps: 19_000, // 1.90x
  
  weakBelowBps: 8_000, // Below 0.8x is WEAK
  strongAboveBps: 12_000, // Above 1.2x is STRONG
};
