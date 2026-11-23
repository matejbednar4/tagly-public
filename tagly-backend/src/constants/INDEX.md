# backend constants — index

> Every constant/tunable, grouped by domain. Check here before adding a constant; put new ones in the matching domain folder.
> **Auto-generated** by `yarn gen:index` (tagly-backend/scripts/genIndex.mjs). Do not edit by hand; re-run after changes.

## auth/

| Exports | File | Purpose |
| --- | --- | --- |
| `TOKEN_PURPOSE, TokenPurpose, TOKEN_ISSUER, ACCEPTED_TOKEN_ISSUERS, TO…` | auth/JWT.ts | Sessions live 14 days, so tokens minted before the rebrand still carry the |
| `OAUTH` | auth/OAUTH.ts | OpenID Connect verification config for the social sign-in providers. The |
| `OTP` | auth/OTP.ts | — |
| `PASSWORD_HASH_TUNABLES` | auth/PASSWORD_HASH.ts | Argon2id password-hash tunables (admin passwords). Argon2 self-describes its |
| `RATE_LIMITS` | auth/RATE_LIMITS.ts | Instagram content endpoints - 2 requests per 30 s per user |
| `MAX_UID_COLLISION_RETRIES` | auth/UID_COLLISION.ts | — |

## billing/

| Exports | File | Purpose |
| --- | --- | --- |
| `MONTHLY_BUDGET_TOPUP` | billing/MONTHLY_BUDGET.ts | Tunables for the monthly-budget top-up (the recurring "top my credits back |
| `PAYG_SETTLEMENT` | billing/PAYG.ts | Tunables for pay-as-you-go (PAYG) settlement card charging. |
| `STRIPE_MIN_CHARGE_CENTS` | billing/STRIPE.ts | Stripe's minimum charge amount for USD. Any PaymentIntent below this is rejected. |

## businesses/

| Exports | File | Purpose |
| --- | --- | --- |
| `DISCOVER` | businesses/DISCOVER.ts | Tunables for the customer Discover shelves (`/v2/customers/businesses/*`). |

## catalogs/

| Exports | File | Purpose |
| --- | --- | --- |
| `LocalizedAdminEvent, adminEventsRaw, AdminEventSlug` | catalogs/notifications/adminCatalog.ts | Admin blast events — one-off announcements initiated from the admin app |
| `pickTransactionalTemplate, pickPromoTemplate, pickAdminTemplate, pick…` | catalogs/notifications/notificationRegistry.ts | Notification registry — single source of truth for all event slugs and templates. |
| `PushTemplate, EmailTemplate, BaseEvent, TransactionalEvent, PromoEven…` | catalogs/notifications/notificationTypes.ts | Shared types for notification catalogs. |
| `promoEventsRaw, PromoEventSlug, PcPromoEventSlug, CustomerPromoEventS…` | catalogs/notifications/promoCatalog.ts | Promo / onboarding notification catalog. |
| `transactionalTemplates, TransactionalTemplateSlug` | catalogs/notifications/transactionalCatalog.ts | The monthly-budget "upcoming charge" date, from the payload's ISO stamp |
| `AgeRange, GenderWeights, TargetDemographicsDef, advertiserTypeTargetD…` | catalogs/weights/advertiserTypeTargetDemographicsCatalog.ts | Get target demographics for a business type. |
| `InterestTypeWeightDef, interestToTypeWeights, getInterestTypeWeightBps` | catalogs/weights/interestsToAdvertiserTypesCatalog.ts | Compiled constants only — there is NO DB table for these weights. The |
| `DEFAULT_SAME_VERTICAL_BPS, VerticalToVerticalWeightDef, verticalToVer…` | catalogs/weights/verticalToVerticalCatalog.ts | Only verticals present in @tagly/models verticalsCatalog can appear here. |

## content/

| Exports | File | Purpose |
| --- | --- | --- |
| `ADVERTISER_SHARES` | content/ADVERTISER_SHARES.ts | Advertiser-facing share surfaces (home strips, rating). Invariant UX config. |
| `MAX_IMG_BANNER_SIZE, MAX_IMG_PHOTO_SIZE, MAX_VID_LENGTH_MS, MAX_SHARE…` | content/MEDIA.ts | — |
| `CS_PROFANITY` | content/PROFANITY.ts | Czech profanity/slur list for the text content check |
| `SHARE_TEXT_MATCH, REKOG_BLOCK_PATTERNS, moderationBlockKey, REKOG_MIN…` | content/REKOGNITION.ts | The moderation block vocabulary, as PATTERNS rather than exact AWS label |
| `REPORT_PENALTIES, SHARE_REJECTION_PENALTY_BPS` | content/REPORT_PENALTIES.ts | Flat penalty applied to the customer's reward multiplier when an admin REJECTS |

## instagram/

| Exports | File | Purpose |
| --- | --- | --- |
| `AUDIENCE_LOCATION_CAPTURE, REACHED_AUDIENCE_CAPTURE, AUDIENCE_DEMOGRA…` | instagram/AUDIENCE_CAPTURE.ts | Audience-capture breadth for Instagram snapshots — how many top |
| `LIMIT_IG_STORY_FETCH, LIMIT_IG_POST_FETCH, TOKEN_REFRESH_BEFORE_EXPIR…` | instagram/INSTAGRAM.ts | When a STORY's insights are collected, relative to `postedToIgAt`. |

## integrations/

| Exports | File | Purpose |
| --- | --- | --- |
| `PUSH_NOTIFICATIONS` | integrations/EXPO_PUSH.ts | — |
| `RESEND` | integrations/RESEND.ts | Resend account-level send budgeting. |
| `SAFE_BROWSING` | integrations/SAFE_BROWSING.ts | Google Safe Browsing v4 Lookup API config — used by |

## localization/

| Exports | File | Purpose |
| --- | --- | --- |
| `CZECH_REGIONS` | localization/CZECH_REGIONS.ts | Czech regions (kraje) — variant labels → the canonical region name we hand to |
| `TIMEZONE_TO_COUNTRY` | localization/TIMEZONE_TO_COUNTRY.ts | IANA-timezone → ISO alpha-2 country code, for the supported locales only |

## notifications/

| Exports | File | Purpose |
| --- | --- | --- |
| `PROMO_DELIVERY` | notifications/PROMO_DELIVERY.ts | Promo (marketing) delivery policy — quiet hours + the push→email waterfall. |

## platform/

| Exports | File | Purpose |
| --- | --- | --- |
| `REFRESH_INSTAGRAM_SNAPSHOT_INTERVAL` | platform/ACCOUNT_UPDATES.ts | — |
| `ADMIN_REVIEW` | platform/ADMIN_REVIEW.ts | Admin moderation-queue tunables (the Review tab). Queues serve a fixed page |
| `ADMIN` | platform/ADMIN.ts | Admin authentication tunables. |
| `APP_OPEN_PROMPT` | platform/APP_OPEN_PROMPT.ts | — |
| `CONTACT` | platform/CONTACT.ts | Tagly email addresses — the single source of truth for every team inbox and |
| `EMAIL_BRAND` | platform/EMAIL_BRAND.ts | Email branding — the single source of truth for everything the email |
| `LOCK_KEYS` | platform/POSTGRES_LOCKS.ts | Every ECS service deploys with maximumPercent=200 (live-audited, all 14), |
| `TEAM_ALERT` | platform/TEAM_ALERT.ts | Ops team-alert tunables (the `sendTeamAlertEmail` channel). Permanent: not |
| `LATEST_TERMS_OF_SERVICE_RELEASE_DATE, LATEST_PRIVACY_POLICY_RELEASE_D…` | platform/TERMS.ts | — |

## rewards/

| Exports | File | Purpose |
| --- | --- | --- |
| `CUSTOMER_RATING_MULTIPLIER` | rewards/CUSTOMER_RATING.ts | Rolling-multiplier delta applied to the customer when a share is rated, keyed by |
| `BASE_ECPMS, ECPM_FOR_ESTIMATES_CENTS` | rewards/ECPM.ts | Price per 1000 LOCAL views. Since v12 the geo dimension is a 0..1 fraction |
| `LOCAL_REWARD_ALGO_VERSION` | rewards/META.ts | LOCAL_REWARD_ALGO_VERSION is the RELEASE that priced a share — the |
| `ACCOUNT_QUALITY` | rewards/multipliers/ACCOUNT_QUALITY.ts | Decrease-only account-quality multiplier, driven by the follower:following |
| `ACTION_BONUSES` | rewards/multipliers/ACTION_BONUSES.ts | Ordered tiers; first match wins based on reach <= maxReach |
| `AUDIENCE_RELEVANCE` | rewards/multipliers/AUDIENCE_RELEVANCE.ts | ACCOUNT AUTHENTICITY, PRICED OFF FOLLOWER COUNT (v12). |
| `COUNTRY_REWARD_MULTIPLIER_BPS, DEFAULT_COUNTRY_REWARD_MULTIPLIER_BPS` | rewards/multipliers/COUNTRY.ts | Country-specific multiplier applied to the final share price, after the cap |
| `DEMOGRAPHICS_MULTIPLIER, DEMOGRAPHICS_BOUNDS, DEMOGRAPHICS_SCORING` | rewards/multipliers/DEMOGRAPHICS.ts | Map Match% (audience within target age+gender bins) → multiplier |
| `FREQUENCY_MULTIPLIER` | rewards/multipliers/FREQUENCY.ts | — |
| `GEO_MULTIPLIER, NO_IG_GEO_BASE_BPS_BY_COUNTRY, NO_IG_GEO_BASE_DEFAULT…` | rewards/multipliers/GEO.ts | Base geo value (in bps) used when the customer has no Instagram connected |
| `INTERESTS_BOUNDS` | rewards/multipliers/INTERESTS.ts | Your interest util returns BPS. Enforce global bounds here. |
| `REACH_FROM_FOLLOWER_COUNT, REACH_CAP` | rewards/multipliers/REACH.ts | Ceiling on the STORY reach a customer can be paid for, expressed as a |
| `LOCK_BPS_OF_EST_PRICE, SUBSIDIZED, REWARD_TAKES, MAX_SHARE_PRICE_CENTS` | rewards/PRICING.ts | Per-share pricing / payout tunables — lock %, platform take, subsidized pricing, max pric… |
| `REFERRAL_TAKES_BPS, REFERRAL_FULL_REWARD_DURATION_MS, REFERRAL_DECAYE…` | rewards/REFERRAL_TAKES.ts | Referral economics — the referrer's cut of Tagly's platform take, plus the |

## workers/

| Exports | File | Purpose |
| --- | --- | --- |
| `dbCleanupTunables` | workers/DB_CLEANUP.ts | Tunables for the database cleanup worker. |
| `insightsWorkerTunables` | workers/IG_INSIGHTS.ts | Tunables for the Instagram insights worker. |
| `snapshotWorkerTunables` | workers/IG_SNAPSHOT.ts | Tunables for the Instagram snapshot worker. |
| `jobMaintenanceTunables` | workers/JOB_MAINTENANCE.ts | Tunables for the maintenance worker. |
| `notificationsWorkerTunables` | workers/NOTIFICATIONS.ts | Tunables for the notifications worker. |
| `sharePaymentWorkerTunables` | workers/SHARE_PAYMENT.ts | Tunables for the share payment worker. |
| `stripeWorkerTunables` | workers/STRIPE.ts | Tunables for the Stripe reconciliation worker. |
| `WorkerLoopTunables, JobQueueTunables` | workers/types.ts | Shared shapes that every worker's tunables conform to. |

