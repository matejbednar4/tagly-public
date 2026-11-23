// The hero has exactly TWO variants now — personalised (a business name is
// known) and generic — so picking one is a single ternary that lives inline in
// page.tsx rather than behind a helper. The old per-entry-point variants
// (leaflet, instagram_bio, referral "You're invited") were removed: they
// fragmented the pitch across five near-identical headings that all said the
// same thing. `utm_source` still rides the OneLink URLs for attribution.

/**
 * The "see how much others are earning" scroller. This section's whole point is
 * that the shares are REAL, so every field here must describe an actual share —
 * and as of the four below, every one of them does: real story, real venue,
 * real reach, real reward paid out.
 *
 * `business` is a proper noun and stays out of copy.json (it reads identically
 * in every locale — same rule as the brand/aria strings). The card names the
 * VENUE only, never the customer: a business is not a data subject, so this
 * needs no personal-data consent, and the venue is what makes the number feel
 * local anyway.
 *
 * Reach counts and reward amounts DO live in copy.json, because they differ per
 * locale: the ledger pays in USD, and Czech readers see the CZK equivalent (the
 * same USD-primary / CZK-for-CZ split the apps use).
 *
 * **The CZK figures are a STATIC conversion** — 1 USD = 20.985 CZK
 * (frankfurter.app, the apps' own rate source, on 2026-08-03), rounded to whole
 * crowns: $8.30 -> 174, $4.10 -> 86, $7.50 -> 157, $4.50 -> 94. Nothing
 * recomputes them, so they drift with the rate; re-derive from the same source
 * if the crown moves far enough to matter. The USD side is the paid amount and
 * never changes.
 */
export const EARNINGS_SHARES = [
  {
    index: 1,
    image: "/images/examples/1.mrdumpling.jpg",
    business: "Mr. Dumpling House",
    reachKey: "share1Reach",
    rewardKey: "share1Reward",
  },
  {
    index: 2,
    image: "/images/examples/2.karawba.jpg",
    business: "Karawba",
    reachKey: "share2Reach",
    rewardKey: "share2Reward",
  },
  {
    index: 3,
    image: "/images/examples/3.loftn8.jpg",
    business: "Loft N8",
    reachKey: "share3Reach",
    rewardKey: "share3Reward",
  },
  {
    index: 4,
    image: "/images/examples/4.s74winecafe.jpg",
    business: "S74 wine&café",
    reachKey: "share4Reach",
    rewardKey: "share4Reward",
  },
] as const;

/**
 * How it works — the SAME four slides the customer app shows in its onboarding
 * carousel (`tagly-customer/components/onboarding/Welcome`), artwork and copy
 * alike, so the page and the first screen of the app tell one story. Three
 * numbered steps plus the "why it works" payoff, which is why the label is a
 * free-text `kickerKey` ("Step 1", "Why it works") rather than a number.
 *
 * `as const` keeps the *Key fields as literal types so the typed `t` accepts
 * them; only the non-text data lives here, the copy is in copy.json.
 *
 * The artwork is app SCREENSHOTS, so it carries UI copy and is localized the
 * same way the strings are — one folder per language under
 * `public/images/step-by-step/<lang>/`, mirroring the app's asset layout. Only
 * step 2 has been shot in English so far; `hasEnglishArtwork` marks it, and
 * every other step falls back to the Czech frame for English visitors (better
 * than an empty slot, but it does mean an English reader sees Czech UI in the
 * artwork until the shots land). Drop `step-N.webp` into `en/` and flip the
 * flag when they do. Source of truth for the files:
 * `tagly-customer/assets/how-it-works/` — copy new exports from there so both
 * surfaces stay in sync.
 */
export const HOW_IT_WORKS_STEPS = [
  {
    file: "step-1.webp",
    hasEnglishArtwork: false,
    kickerKey: "step1Kicker",
    titleKey: "step1Title",
    descriptionKey: "step1Description",
  },
  {
    file: "step-2.webp",
    hasEnglishArtwork: true,
    kickerKey: "step2Kicker",
    titleKey: "step2Title",
    descriptionKey: "step2Description",
  },
  {
    file: "step-3.webp",
    hasEnglishArtwork: false,
    kickerKey: "step3Kicker",
    titleKey: "step3Title",
    descriptionKey: "step3Description",
  },
  {
    file: "step-4.webp",
    hasEnglishArtwork: false,
    kickerKey: "step4Kicker",
    titleKey: "step4Title",
    descriptionKey: "step4Description",
  },
] as const;

/** Pixel size of every step artwork file (they share one frame) — passed to the
 *  `<img>` so the browser reserves the box and the grid doesn't jump on load. */
export const STEP_IMAGE_SIZE = { width: 1097, height: 1839 } as const;

/**
 * "Why do you get paid?" — the page's core objection. Getting money for posting
 * a story sounds too good to be true, so the answer gets a section of its own
 * rather than sitting collapsed in an accordion only a half-convinced reader
 * would ever open. It started as the first FAQ entry; that FAQ has since been
 * removed entirely, and this is what replaced it.
 *
 * Two reasons, not three. The third ("it beats paying for ads") was the same
 * argument as the second, just stated from the advertiser's side. `icon` is a
 * string id resolved to an SVG in WhyWePay.tsx, matching how
 * HOW_IT_WORKS_STEPS keeps only non-JSX data.
 */
export const WHY_REASONS = [
  { titleKey: "why1Title", bodyKey: "why1Body", icon: "wallet" },
  { titleKey: "why2Title", bodyKey: "why2Body", icon: "people" },
] as const;

