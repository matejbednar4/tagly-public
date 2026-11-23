export const AUDIENCE_RELEVANCE = {
  // ACCOUNT AUTHENTICITY, PRICED OFF FOLLOWER COUNT (v12).
  //
  // This multiplier answers ONE question: how real is the relationship between
  // this account and the people who follow it? That is a property of the
  // ACCOUNT, not of the post — so the input is followerCount, not reach.
  //
  // Before v12 it read the post's reach, which was wrong twice over. It
  // double-charged performance (every view is already bought at the eCPM, so a
  // weak post is punished automatically by having fewer views to sell), and it
  // handed the full small-account boost to ANY account with a quiet post — a
  // 100k-follower account with 100 views scored the same 1.25x as a
  // 300-follower one. In reality a 5k-follower account's story lands anywhere
  // between 10 and 10 000 views; the follower count is the stable signal of
  // whether those followers are friends or strangers.
  //
  // Read a row as the price of a view from that account tier: at eCPM $50 and
  // the CZ rate, the customer nets AR × 441 Kc per 1000 LOCAL views — 2.0x ≈
  // 882 Kc, 1.1x ≈ 485 Kc, 0.35x ≈ 154 Kc.
  //
  // THE BAND IS DELIBERATELY NARROW: 2.0x down to a 0.35x FLOOR, never below.
  // Account size is already priced once by reach — our own 60 settled shares
  // show story views collapsing from a median 115% of followers under 300 to
  // 8% above 10k — so a steep multiplier on top charges the same dilution
  // twice. This curve is the light second touch, not a second penalty.
  //
  // CALIBRATED AGAINST 60 REAL PAID CZ SHARES, not guessed. Under v11 the rate
  // was almost FLAT across account sizes — a measured median of ~322 Kc/1000
  // local views under 300 followers vs ~135 Kc at 50k+, barely a 2.4x spread,
  // i.e. the platform was hardly pricing authenticity at all. These tiers widen
  // that to 5.7x. Replayed over those same 60 shares: under-500 accounts +34%,
  // 500-1k +21%, 1k-2.5k +3%, 2.5k-10k -21%, 10k+ -27%, total -8%.
  //
  // Small accounts are capped in absolute terms by design — payable STORY reach
  // is bounded at ~1.15x followers (see REACH_CAP), so a 300-follower account
  // tops out around 240 Kc per story. That is intended: people beyond a
  // personal account's own following are strangers to them, and a business
  // isn't buying a personal recommendation there.
  weakBelowBps: 4_000, // below 0.4x is WEAK (a big, diluted account)
  strongAboveBps: 12_000, // above 1.2x is STRONG (a genuinely personal account)

  // Log-interpolated between anchors (follower counts span orders of
  // magnitude), flat at the first anchor's value below it and at the last
  // anchor's value above it.
  //
  //   ≤300 personal account, followers are friends       2.00x
  //   500  still personal                                1.80x
  //   1000 the edge of personal                          1.40x
  //   2500 small creator, still fairly authentic         1.10x
  //   5000 followers are mostly strangers                0.80x
  //   10k  micro-influencer territory                    0.60x
  //   25k  0.45x · 50k 0.40x · 100k+ flat at 0.35x — the floor. A big account
  //        that genuinely delivers local views is still worth buying.
  //
  // The 0.35x floor is a floor, not a decay target: a 100k-follower account
  // delivering 5 000 local views still earns ≈ 772 Kc. It simply stops being
  // paid a personal-recommendation rate for reach that is no longer personal.
  //
  // The eCPM is NOT the lever for rebalancing this axis. Businesses have told
  // us the model reads expensive, and the content/spend value is hard to
  // explain in a sales conversation — so relative rebalancing happens here, in
  // the multiplier, and never by raising BASE_ECPMS.
  followerTiers: [
    { maxFollowers: 300, mult: 2.0 },
    { maxFollowers: 500, mult: 1.8 },
    { maxFollowers: 1_000, mult: 1.4 },
    { maxFollowers: 2_500, mult: 1.1 },
    { maxFollowers: 5_000, mult: 0.8 },
    { maxFollowers: 10_000, mult: 0.6 },
    { maxFollowers: 25_000, mult: 0.45 },
    { maxFollowers: 50_000, mult: 0.4 },
    { maxFollowers: 100_000, mult: 0.35 },
    // Flat from 100k up — the floor a huge account can never fall below. This
    // MUST equal the 100k value: the interpolator reads the last FINITE
    // anchor's mult for everything past it, so a different number here would be
    // dead code that silently lies about the tail.
    { maxFollowers: Infinity, mult: 0.35 },
  ] as const,
} as const;
