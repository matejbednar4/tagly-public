export const CUSTOMER_RATING_MULTIPLIER = {
  minBps: 1250, // 0.125x
  maxBps: 12500, // 1.25x

  // Rolling-multiplier delta applied to the customer when a share is rated, keyed by
  // the half-star value (1–10 = ½★–5★). v2 rates in half-stars, so each value gets
  // its own delta: neutral at 3★, scaling up toward 5★ and down toward ½★.
  // Tune freely, but bump the algo version (META) in the same commit — this is
  // reward economics.
  //
  // THE DOWNSIDE IS DELIBERATELY STEEP AND ASYMMETRIC (v12). A low rating is a
  // deliberate act — a business that disliked a share has to choose that value —
  // whereas a high rating is the courteous default. So a bad rating moves the
  // account several times further than a good one, and one ½★ is enough to drop
  // a customer below the ACCOUNT_RATING_LOW threshold (0.75x) where the app
  // tells them their rating is hurting their rewards.
  //
  // Sized for how much history people actually have: most customers have 2–3
  // rated shares, so a delta that needs ten ratings to register would never fire
  // at all. One ½★ takes 1.0x → 0.65x; two floor the account outright.
  //
  // ⚠️ This is a RANDOM WALK — the long-run distribution is set by the EXPECTED
  // delta per rating (Σ P(star) × delta), not by the extremes. Neutral sits at
  // 3★; if the real median rating turns out to be 4–4½★ the population drifts
  // upward and pins at maxBps, at which point the multiplier stops discriminating
  // and the fix is to RECENTRE the neutral point on the observed median, not to
  // deepen the negatives further. Re-check against the real rating distribution
  // once there is enough of one to measure.
  //
  // Recovery is deliberately slower than the fall: climbing back from one ½★
  // (0.65x) to 1.0x takes ~6 five-star shares.
  DELTAS_BY_STARS: {
    1: -3500, // ½★   −0.35x   one rating → 0.65x, below the "rating low" warning
    2: -2500, //  1★   −0.25x
    3: -1750, //  1½★  −0.175x
    4: -1000, //  2★   −0.10x
    5: -400, //   2½★  −0.04x
    6: 0, //      3★   neutral
    7: 150, //    3½★  +0.015x
    8: 300, //    4★   +0.03x
    9: 500, //    4½★  +0.045x
    10: 750, //   5★   +0.06x
  } as Record<number, number>,
};
