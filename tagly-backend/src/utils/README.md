# utils/

Backend utilities, organised **by purpose**, one flat tree (the `permanent/` vs `v2/` lifecycle buckets were collapsed and the tree regrouped on 2026-09-01). Only the wire contract is versioned (`controllers/v2`, `routes/v2`, models `endpoints/v2` + `dtos/v2`); everything here is shared by the API, the workers, and the webhooks alike.

```
utils/
├── core/            domain-agnostic primitives — nothing here knows about the product
│   ├── errors/      createCustomError · logError · reportError · captureServerEvent (the observability sink)
│   ├── http/        asyncHandler · fetchWithTimeout · fetchJSONWithAbort · headerOr
│   ├── db/          advisoryLock · rdsCa · applyOffsetPagination
│   ├── uids/        generateUid · getEntityFromUid · generateReferralCode · generateSecureToken
│   └── sleep.ts
├── formatting/      escapeHtml · asBigInt · bpsOfCents · validateCurrencyIsSupportedOrThrow · mime lookups
├── localization/    locale/language validation · getCountryForTimezone · localizeCatalog
├── geo/             geocoding (geocodeAddressOrThrow/OrReturn) · getTimezoneForCoordinates · resolveCzechRegion
├── clients/         third-party SDK singletons (stripe, redis, resend, posthog, aws/*)
├── aws/             s3/ (uploads, presign, copy, validation, promotePendingMedia) · rekognition/
├── auth/            sessions, OAuth/OIDC, registration resume state, password hashing · otp/
├── moderation/      assertTextAllowedOrThrow (profanity) · checkUrlSafety · upsertLink (link review)
├── money/           everything that moves or records money
│   ├── ledger/      the ledger core + events/ wrappers — always the wrappers, never direct ledger writes
│   ├── stripe/      the Stripe half: chargeAdvertiserCardOffSession (the ONE off-session charger) + its retry backoff,
│   │                PaymentIntent/SetupIntent creation, customer/Express-account provisioning, purpose vocabulary,
│   │                error classification, webhookHandlers/
│   ├── savedCard/   the account's ONE off-session card: linkCardFromSetupIntent (link only, feature-agnostic) · removeSavedCard
│   ├── payg/        pay-as-you-go period open/close + status derivation
│   ├── monthlyBudget/ period open/close, the UTC month schedule, runMonthlyBudgetTopUp, status/state reads
│   └── withdrawals/ customer payouts: transfer → settle → payout transitions (withdrawalTransitions is the ONLY
│                    writer of the withdrawal status columns), purpose vocabulary, display state
├── pricing/         the reward algorithm: calculateEstPrice / calculateFinalPrice, the est cache, helpers/
├── businesses/      businessAccessibility (the ONE visibility/shareability rule) · share tags
│   ├── write/       the create/update page pipeline: the 5 cores + their helpers (actor, geocode,
│   │                type/link/hours resolution, text gate) + media/ — private to the cores
│   └── discover/    ranking signals for the customer Discover shelves
├── shares/          shareAccess (every share-state predicate) · void/unlock · assessment claim
├── customers/ · advertisers/ · referrals/
├── instagram/       Graph API reads, tokens/, snapshots, webhooks
├── queue/           enqueue worker jobs (IG insights/snapshots, notifications, promo)
├── email/           sendEmail + the two templates, OTP + team-alert mail, send budget, unsubscribe token
├── notifications/   channel resolution, push tokens, recipient analytics id
└── hydrators/       the DB → DTO layer (see its CLAUDE.md — never throw on stored data)
```

**Rules:**

- **File by purpose, never by kind.** A `create*`/`validate*`/`hydrate*` verb lives in its domain folder; the only kind-based folders are `core/` (domain-agnostic primitives), `formatting/`, `clients/` (SDK singletons), and `hydrators/` (the DB → DTO layer).
- **`aws/` is "talks to an AWS service", `moderation/` is "the policy"** — Rekognition image checks live under `aws/rekognition`, text/link policy under `moderation/`.
- **Check `INDEX.md` first** (generated — `yarn gen:index`) before adding anything; extend what exists rather than adding a parallel.
- **Inline single-use logic; extract on reuse** (root `CLAUDE.md`). A util here should have, or be about to have, more than one caller.
- Money code (`money/`, `pricing/`) follows the Financial Operations rules in `tagly-backend/CLAUDE.md`.
