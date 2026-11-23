// LOCAL_REWARD_ALGO_VERSION is the RELEASE that priced a share — the
// tagly-backend/package.json version at the moment the pricing pipeline last
// changed. It is NOT a counter.
//
// ⚠️ THE RULE: changing anything that alters a computed price — eCPMs, any
// multiplier constant, the pipeline itself — REQUIRES bumping
// tagly-backend/package.json AND setting this to that new version, in the same
// commit. That is what makes the stamp useful: `git checkout v<value>` puts you
// on the exact constants that produced any FinalPrice row, with no lookup table
// from counter to release.
//
// The value only moves when PRICING moves, so two rows sharing a value were
// priced by identical rules — a release that doesn't touch pricing leaves this
// alone and the two versions drift apart, which is correct and expected.
//
// History below is kept as the old integer scheme (v1..v11 were counters);
// rows written under it hold "1".."12" as text in `FinalPrice.algoVersion`.
// v3: country multiplier applied after the cap.
// v4: MAX_SHARE_PRICE_CENTS lowered 8334 → 5000 ($30.00 max customer reward).
//     Shipped as a v1 hotfix from staging — production rows stamped 4 mean this
//     change, so the branch-only versions below were renumbered up by one.
// v5: geo multiplier prices the snapshot's chosen audience-location source —
//     reached_audience_demographics (this_month) when the capture guards pass,
//     follower_demographics otherwise (see REACHED_AUDIENCE_CAPTURE) — and the
//     under-coverage proximity top-up was removed (rows price as reported; the
//     unseen tail is assumed to mirror the seen rows).
// v6: STORY payable reach capped at followerCount × multiplier (declining with
//     account size) so a business re-sharing a customer's story can't inflate
//     the reach/price beyond the customer's own audience (see REACH_CAP).
// v7: decrease-only account-quality penalty from the follower:following ratio
//     (follow-for-follow / bot signal), size-faded and gated (see ACCOUNT_QUALITY).
// v8: cafe type multiplier lowered 1.0x → 0.8x (low margins, high volume);
//     "bistro" type added (1.0x food-drink baseline).
// v9: audience-relevance retuned much less generous — tiny personal audiences
//     BOOSTED (1.25x ≤250 reach, gliding to 1.0 at 500), then decay: 1k 0.7x
//     → 2k 0.55x → 5k 0.4x → 10k 0.25x → 100k 0.07x, floor 0.04x (was: flat
//     1.0x to 1k, 0.7x at 10k). Also fixed
//     the tier interpolation (segment floor was anchored one tier early,
//     cliffing the multiplier right after each anchor) and flattened the
//     decaying tail — payout is now strictly increasing in reach everywhere.
//     Base eCPMs lowered in the same pass: story $25 → $21, post
//     $27.50 → $18, reel $23 → $16 (estimate eCPM $25 → $21).
// v10: weekly frequency window excludes the share being priced (E071) — the
//      24h window always did, but weekCount counted the share's own row at
//      settlement (inclusive `lte: anchor` on its own postedToIgAt), so from
//      the 3rd weekly share on, settlement priced one tier lower than the
//      estimate had quoted (4th share: quoted 0.85×, paid 0.55×). Estimate
//      and settlement now count the same window.
// v11: business-type multiplier (`rewardMultiplierBps` — type catalog override
//      else primary vertical — cafes discounted, sports/beauty verticals boosted,
//      "other" heavily discounted; values live in the models catalogs) wired into est + final pricing via
//      calculateTypeBps + recorded on FinalPrice.typeMultiplierBps. The values
//      existed in the catalogs/DB since the beginning (v8 even retuned cafe)
//      but no pricer ever read them — the type was only ever used as a MATCH
//      key (interests×type, demo×type). The v1 estimate/lock path mirrors it
//      (approved freeze exception, same rationale as E036) so old-client
//      quotes match v2 settlement. In the same (unreleased) version: story +
//      estimate eCPM restored $21 → $25 (v9's cut overshot once the type
//      multiplier landed; post/reel stay at v9 values), and the whole
//      vertical/type/interest multiplier table was retuned in the catalogs.
// 2.0.2 (was counter v12): GEO REWORKED FROM BONUS MULTIPLIER TO LOCAL-REACH FRACTION. It used to
//      be a 0.01x-2.25x bonus applied to raw reach, which paid real money for
//      audiences hundreds of km away - a share whose audience was only 23%
//      Prague still scored 0.94x. It is now "what share of these views counts
//      as local", clamped to 0..1: 100% same-city, 90% at 10km, 55% at 25km,
//      20% at 50km, 5% at 70km, 0% from 85km out (continuous piecewise-linear,
//      no cliffs). The same 23%-Prague share now scores 0.23 - it pays for its
//      ~50 local views, not its 220 total. Base eCPMs DOUBLED in the same pass
//      (story $25 -> $50, post $18 -> $36, reel $16 -> $32, estimate $25 ->
//      $50): the premium a fully-local audience used to earn via the 2.25x geo
//      bonus now lives in the price of a local view, so a 100%-local account's
//      payout is unchanged from v11 and only diluted audiences got cheaper. The
//      no-audience-data fallbacks were cut for the same reason (NO_IG CZ 1.7 ->
//      0.85, US/default 1.3 -> 0.65 — both exactly halved; noGeo 0.35 -> 0.20,
//      deliberately NOT the 0.175 a straight halving gives). The v1 copies were
//      deliberately NOT re-synced (the
//      E036 rule is retired): v1 is being deleted at the imminent Phase-3
//      cutover, so v1-client estimates quote the old geo/eCPM until then while
//      settlement — which always runs the v2 pricer — uses these values.
//      Shipped in the same (unreleased) version: AUDIENCE RELEVANCE REKEYED
//      FROM REACH TO FOLLOWER COUNT. It is an ACCOUNT-authenticity multiplier,
//      so it must read a property of the account. Keyed on reach it did two
//      wrong things: it charged post performance twice (every view is already
//      bought at the eCPM, so a weak post is punished by having fewer views to
//      sell), and it gave the full small-account boost to any big account with
//      a quiet post - 100k followers at 100 views scored the same 1.25x as a
//      300-follower account. New tiers (log-interpolated): 1.6x <=300 - 1.45x
//      500 - 0.80x 1k - 0.60x 2.5k - 0.40x 5k - 0.20x 10k - 0.12x 25k - 0.09x
//      50k - 0.40x, 0.35x from 100k up (flat floor). The band is deliberately
//      NARROW (2.0x -> 0.35x, 5.7x total) because account size is ALREADY priced
//      once by reach: across those 60 shares story views fall from a median
//      115% of followers under 300 to 8% above 10k, so a steep multiplier on
//      top charges the same dilution twice. Replayed over the 60 shares the
//      whole v12 change (geo + eCPM + this) is -8% in total and is mostly
//      redistribution: under-500 accounts +34%, 500-1k +21%, 1k-2.5k +3%,
//      2.5k-10k -21%, 10k+ -27%. What still loses meaningfully is a non-local
//      audience, which is the intended ordering. NOTE: rebalancing between
//      account tiers is done HERE, never by raising BASE_ECPMS - businesses
//      already report the model reads expensive.
//      Absent follower data (the no-IG manual-story-views path) returns a
//      neutral 1.0x, matching the other multipliers on that path.
//      Also in v12: CUSTOMER_RATING_MULTIPLIER.DELTAS_BY_STARS made far steeper
//      on the DOWNSIDE (half-star deltas were -1000..-125; now -3500..-400),
//      upside left near where it was. Rationale: a business rating a share is
//      the signal we already trust precisely BECAUSE the rater gains nothing
//      from it - the delta moves the CUSTOMER's rolling multiplier, affecting
//      their future shares at any business, so there is no incentive to rate
//      low. (A per-share rating discount was proposed and rejected for exactly
//      that reason: it would make the rater the direct beneficiary of its own
//      low rating, and settlement does not wait for a rating anyway - the
//      payment worker fires 24h after createdAt while a share stays rateable
//      while ratedAt is null, i.e. after paidAt.) Old deltas were too small to
//      register for a population whose customers have 2-3 rated shares: one
//      1/2-star moved 1.00x -> 0.90x. Now one 1/2-star is 1.00x -> 0.65x, below
//      the ACCOUNT_RATING_LOW warning threshold, and three floor the account.
export const LOCAL_REWARD_ALGO_VERSION = "2.0.2";
