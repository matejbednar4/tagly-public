# Tagly

Tagly was a two-sided marketplace where local businesses (cafes, restaurants, gyms...) paid their customers for posting about them on Instagram. The idea was simple: a customer walks in, orders a coffee (or anything else), takes a picture and posts it to their Instagram story, tagging the business. Then they open the Tagly app, which shows their stories from Instagram, and link the story to that business.

After 24 hours, Tagly calculated a fair reward based on the story's reach, how many of the customer's followers actually live nearby, and a few other factors, then paid the customer from the business's budget. The business got marketing without putting in any work, and the customer earned money for visiting a place they already liked.

You can see the apps in action at [matej.fyi/demos](https://matej.fyi/demos).

## About this repository

This is a public snapshot of the Tagly codebase as of 18 October 2026, published as a single commit. It does not include the project's git history.

Tagly was built in a private repository that was never meant to become public. Its history is full of internal working notes, test records and personal details from day-to-day development, so instead of publishing that history I'm sharing the code as it stands, starting fresh.

A few internal folders were also left out: security review notes, QA test runs and infrastructure records. Some docs still mention them (for example `v2-review/` or `v2-test/`), but those files aren't part of this repository.

If you want to see inside the full repo, email me at me@matej.fyi.

## At a glance

- **Backend:** Node.js, Express, Prisma and Kysely on PostgreSQL (PostGIS), Redis, and 7 background workers built from one Docker image
- **Apps:** three Expo (React Native) apps: the customer app (iOS + Android), the business app, Tagly Partner (iOS + Android), and an internal admin app (iOS)
- **Shared packages:** the API contract as Zod schemas, a typed SDK that validates against it, and a shared React Native design system
- **Web:** a referral landing page and a marketing + legal site (Next.js)
- **Payments:** Stripe, for business card payments and Connect payouts to customers
- **Infrastructure:** AWS (App Runner, ECS Fargate, RDS, S3, Secrets Manager), EAS for app builds, GitHub Actions for deploys

## Walkthrough

A short tour of how the monorepo fits together, following one *share* (a customer's Instagram Story about a business) from creation to payment. The links point at the exact lines.

### Monorepo structure

```
tagly/
├── tagly-backend/            Node + Express API and 7 background workers (one Docker image)
│   ├── prisma/               schema.prisma + migrations
│   └── src/
│       ├── routes/v2/        Express routers, one group per audience
│       ├── controllers/v2/   request handlers: customerApp / advertiserApp / adminApp / crossApp / public
│       ├── middleware/       auth, rate limiting, request validation
│       ├── utils/            business logic by domain: money/ledger, pricing, instagram, shares, businesses...
│       ├── constants/        tunables by domain: rewards, billing, workers...
│       └── workers/          sharePayment, igInsights, igSnapshot, stripe, notifications, maintenance, cleanup
│
├── tagly-customer/           Customer app       Expo (React Native), iOS + Android
├── tagly-advertiser/         Business app       Expo (React Native), iOS + Android
├── tagly-admin/              Admin app          Expo (React Native), iOS only
│
├── tagly-shared/
│   ├── models/               the API contract: Zod schemas
│   │   └── src/
│   │       ├── endpoints/v2/   request/response schemas per audience
│   │       ├── dtos/v2/        data shapes per audience
│   │       └── core/           shared enums, IDs, types
│   ├── sdk/                  typed API client, split per audience (validates with models)
│   └── client/               shared React Native code: design system, components, hooks, caller
│
├── tagly-join/               referral landing page   Next.js (standalone)
├── tagly-website/            marketing + legal site  Next.js (standalone)
├── tagly-redirect/           OAuth/Stripe redirect   static HTML
├── tagly-legal/              Terms of Service, Terms of Monetization, Privacy Policy (EN + CS)
│
└── docs/                     share lifecycle, notifications, linking
```

### Share lifecycle

```
story posted → share created (PENDING, insights + snapshot jobs queued)
  ├─ any time   admin approves → budget locked   (or rejects)
  ├─ +23h30m    insights collected
  ├─ +24h       snapshot collected
  └─ share ≥24h old + approved + no open report → payment
```

### Share creation

From contract to controller:

1. Request/response schema: [models/.../customerApp/shares/createShare.ts](tagly-shared/models/src/endpoints/v2/customerApp/shares/createShare.ts)
2. SDK function: [sdk/.../customerApp/shares/createShare.ts](tagly-shared/sdk/src/endpoints/v2/customerApp/shares/createShare.ts)
3. Middleware on every customer route: [backend/src/routes/v2/index.ts](tagly-backend/src/routes/v2/index.ts#L37-L44)
4. Controller: [backend/src/controllers/v2/customerApp/shares/createShare.ts](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts).
   - [Bans](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts#L91-L103)
   - [Story ownership](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts#L107-L117)
   - [Business accessible](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts#L167-L204): one shared rule, [businessAccessibility.ts](tagly-backend/src/utils/businesses/businessAccessibility.ts)
   - [One share per business per 24h](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts#L206-L221)
   - [Funding mode](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts#L245-L297): who pays is fixed at creation; the budget lock is placed at admin approval
   - [Rekognition](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts#L358-L383)
   - [Once-ever registry](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts#L387-L406)
   - [Insights + snapshot jobs](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts#L474-L500)

### Instagram insights

Runs at story posted + 23h30m, must finish before the story expires at 24h ([schedule](tagly-backend/src/constants/instagram/INSTAGRAM.ts#L26-L29)).

1. Worker: [workers/igInsights/run.ts](tagly-backend/src/workers/igInsights/run.ts#L17-L43)
2. Claim: [claimInsightsJobs.ts](tagly-backend/src/workers/igInsights/helpers/claimInsightsJobs.ts#L25-L63): expiring jobs first
3. Fetch + validate: [executeInsightsJob.ts](tagly-backend/src/workers/igInsights/helpers/executeInsightsJob.ts) → [getStoryInsights.ts](tagly-backend/src/utils/instagram/mediaInsights/getStoryInsights.ts#L19-L64)
4. If it keeps failing: [run.ts](tagly-backend/src/workers/igInsights/run.ts#L25-L41) → [markShareUnpayableAndUnlock.ts](tagly-backend/src/utils/shares/markShareUnpayableAndUnlock.ts#L45-L109)

### Instagram snapshot

Runs at story posted + 24h ([schedule](tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts#L495-L500)). Captures who the customer's audience is and where they live.

1. Worker: [workers/igSnapshot/run.ts](tagly-backend/src/workers/igSnapshot/run.ts#L21-L47)
2. Fetch: [executeSnapshotJob.ts](tagly-backend/src/workers/igSnapshot/helpers/executeSnapshotJob.ts#L67-L108): follower count + audience cities (followers, and the reached audience when available)
3. Choose the source: [executeSnapshotJob.ts](tagly-backend/src/workers/igSnapshot/helpers/executeSnapshotJob.ts#L110-L158), reached audience only if it passes the [guards](tagly-backend/src/constants/instagram/AUDIENCE_CAPTURE.ts#L45-L62)
4. Geocode: Instagram gives "city, region" (e.g. "Kladno, Central Bohemian Region"), never a country
   - How many cities, by account size: [selectAndGeocodeAudienceLocations.ts](tagly-backend/src/utils/instagram/accountInsights/helpers/selectAndGeocodeAudienceLocations.ts#L56-L88)
   - City → coordinates: [geocodeAudienceLocations.ts](tagly-backend/src/utils/instagram/accountInsights/helpers/geocodeAudienceLocations.ts#L10-L76)
5. If it keeps failing: same as insights ([run.ts](tagly-backend/src/workers/igSnapshot/run.ts#L29-L45))

### Share payment

1. Worker: [workers/sharePayment/run.ts](tagly-backend/src/workers/sharePayment/run.ts#L26-L53)
2. Which shares are ready: [findSharesReadyForPayment.ts](tagly-backend/src/workers/sharePayment/helpers/findSharesReadyForPayment.ts#L31-L56)
3. Orchestrator: [executeSharePayment.ts](tagly-backend/src/workers/sharePayment/helpers/executeSharePayment.ts)
   - [Guards](tagly-backend/src/workers/sharePayment/helpers/executeSharePayment.ts#L70-L95)
   - [Final price](tagly-backend/src/workers/sharePayment/helpers/executeSharePayment.ts#L97-L100) → [calculateFinalPrice.ts](tagly-backend/src/utils/pricing/calculateFinalPrice.ts#L118-L199)
   - [Subsidized: the platform pays](tagly-backend/src/workers/sharePayment/helpers/executeSharePayment.ts#L102-L124)
   - [Pay-as-you-go: charge the card](tagly-backend/src/workers/sharePayment/helpers/executeSharePayment.ts#L134-L154)
   - [Credits](tagly-backend/src/workers/sharePayment/helpers/executeSharePayment.ts#L161-L180): [claim the share first](tagly-backend/src/workers/sharePayment/helpers/markSharePaidOrThrow.ts#L37-L67), then settle (below)
   - [Errors](tagly-backend/src/workers/sharePayment/helpers/executeSharePayment.ts#L183-L247): lost the claim, temporary, permanent
4. Settle: [settleSharePayoutAndUnlockRemainder.ts](tagly-backend/src/utils/money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.ts)
   - [Guards + currency from the lock](tagly-backend/src/utils/money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.ts#L64-L99)
   - [Spend order](tagly-backend/src/utils/money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.ts#L101-L110): lock first, then available
   - [Platform fee + payment event](tagly-backend/src/utils/money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.ts#L199-L288)
   - [Referral payouts](tagly-backend/src/utils/money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.ts#L290-L345)

     ```
     Share price $10.00, paid by the business
     ├── Customer: 60% .................................... $6.00
     └── Tagly fee: 40% ................................... $4.00
         ├── whoever referred the business: 40% of the fee  $1.60
         ├── whoever referred the customer: 20% of the fee  $0.80
         └── Tagly keeps the rest ......................... $1.60

     A referrer can be a business or a customer.
     Referral cuts halve 6 months after the referred account signed up.
     ```
   - [Release the rest of the lock](tagly-backend/src/utils/money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.ts#L347-L380)
5. The ledger core: [createLedgerEvent.ts](tagly-backend/src/utils/money/ledger/createLedgerEvent.ts#L107-L200) → [applyBalancesFromEvent.ts](tagly-backend/src/utils/money/ledger/applyBalancesFromEvent.ts)

### One endpoint, multiple audiences

`GET .../businesses/:uid`: same request, three controllers. Each one decides who can read the business and what comes back.

|          | Customer: [getBusinessByUid.ts](tagly-backend/src/controllers/v2/customerApp/businesses/getBusinessByUid.ts#L36-L46) | Owner: [getBusinessByUid.ts](tagly-backend/src/controllers/v2/advertiserApp/businesses/getBusinessByUid.ts#L27-L33) | Admin: [getBusinessByUid.ts](tagly-backend/src/controllers/v2/adminApp/businesses/getBusinessByUid.ts#L17-L23) |
| -------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Path     | `/v2/customers/businesses/:uid`                                                                                      | `/v2/advertisers/me/businesses/:uid`                                                                                | `/v2/admin/businesses/:uid`                                                                                    |
| Can read | visible businesses only, banned = 404                                                                                | own businesses only, banned stays visible                                                                           | any business                                                                                                   |
| Returns  | public details + reward estimate for this customer                                                                   | owner details, links with moderation status                                                                         | full admin view                                                                                                |

## How it was deployed

| Component   | Platform                            | Deploy                                                  |
| ----------- | ----------------------------------- | ------------------------------------------------------- |
| Backend API | AWS App Runner                      | GitHub Actions: staging on push, production manual      |
| Workers     | AWS ECS (Fargate)                   | GitHub Actions, chained after each backend deploy       |
| Mobile apps | EAS Build → TestFlight / Google Play | GitHub Actions, manual                                  |
| Websites    | AWS Amplify                         | GitHub Actions: staging on push, production manual      |

- [Dockerfile](Dockerfile): one multi-stage image for the API and all workers
- [.aws/ecs/](.aws/ecs/): ECS task definitions, one per worker per environment
- [.github/workflows/](.github/workflows/): deploy and build pipelines

## Further reading

- [CLAUDE.md](CLAUDE.md) and the `CLAUDE.md` in each package: architecture, conventions and gotchas
- [docs/](docs/): share lifecycle, transactional notifications, linking and redirects, referral attribution
