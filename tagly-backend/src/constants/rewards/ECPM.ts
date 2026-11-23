// Price per 1000 LOCAL views. Since v12 the geo dimension is a 0..1 fraction
// of reach that counts as local (see multipliers/GEO.ts), not a 0.01x–2.25x
// bonus — so the premium a fully-local audience used to earn through the geo
// multiplier now lives here. Doubled in v12 (story $25 → $50) to hold a
// 100%-local account's payout at its v11 level; only diluted audiences got
// cheaper.
export const BASE_ECPMS = {
  IG_STORY_CENTS: 5000, // $50.00 per 1000 local views
  IG_POST_CENTS: 3600, // $36.00 per 1000 local views
  IG_REEL_CENTS: 3200, // $32.00 per 1000 local views
};

export const ECPM_FOR_ESTIMATES_CENTS = 5000; // $50.00 per 1000 local reach
