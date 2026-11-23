# Backend Development Guide

This file provides backend-specific guidance for Claude Code when working in `tagly-backend/`.

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/upsert/backfill; any DDL (`CREATE`/`ALTER`/`DROP` on schemas, tables, columns, indexes, enums, extensions, roles, grants); `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, `yarn db:*` writes, and every script under [src/seed/](src/seed/) — including `dev_fake_data`; **resetting/wiping/dropping/re-creating the prod DB**, even a single table; snapshot/PITR restores, data imports, RDS instance or parameter-group changes; and running any controller, worker, job, or one-off script against prod credentials that writes. "Quick one-off fix script" is still a prod write.

Allowed against prod: pure reads only — `SELECT`, `EXPLAIN` (never `ANALYZE`), `information_schema`/`pg_catalog`, `\d`. Prefer a read-only role or replica.

Guards: before running anything against a database, identify which environment its `DATABASE_URL` belongs to and say so; migrations reach prod only through the deploy pipeline, never from a session; never test against prod. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../CLAUDE.md).

## Check Before You Build

Before writing any utility, helper, Prisma select, constant, or middleware — **check what already exists**. Duplicate utils/constants are the #1 source of drift in this codebase.

**Read the index first.** [`src/utils/INDEX.md`](src/utils/INDEX.md) and [`src/constants/INDEX.md`](src/constants/INDEX.md) are **generated manifests** of every util/constant (exports + one-line purpose). Read the relevant one before adding anything; if something close exists, reuse or extend it instead of creating a parallel. **Regenerate with `yarn gen:index`** after adding/removing/renaming a util or constant.

Key directories:

| Directory                 | What's inside                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/<purpose>/`    | Every backend helper, grouped by purpose (full map in [`src/utils/README.md`](src/utils/README.md)): `core/` (errors, http, db, uids), `formatting/`, `localization/`, `geo/`, `clients/`, `aws/`, `auth/` (+ `otp/`), `moderation/`, **`money/`** (`ledger/` — the core + `events/` wrappers, always the wrappers, never bypass; `stripe/` — `chargeAdvertiserCardOffSession`, the one off-session charger, + the webhook handlers; `savedCard/`; `payg/`; `monthlyBudget/`; `withdrawals/`), `pricing/` (the reward algorithm), `businesses/`, `shares/`, `customers/`, `advertisers/`, `referrals/`, `instagram/`, `queue/`, `email/`, `notifications/`, `hydrators/` (DB → DTO) |
| `src/prisma/selects/`     | Reusable Prisma leaf select objects; DTO-shaped composites are inlined in their hydrator (see the selects guidance below); check before writing inline selects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/constants/<domain>/` | tunables/config by domain (`auth`, `billing`, `rewards`, `workers`, …), `UPPER_SNAKE.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

**Where new code goes:** a util → the `utils/<purpose>/` folder it serves (money movement → `money/<area>/`, pricing → `pricing/`, …); a constant → `constants/<domain>/`. That's the whole rule.

**Folder organization is purpose-first.** File a util by what it is **for** (`instagram/`, `pricing/`, `auth/otp/`, `email/`, `customers/`, `money/stripe/`, `money/withdrawals/`, `money/ledger/`, `queue/`, …), not by the _kind_ of function it is — the verb prefix in the filename already carries the kind (`create*`/`validate*`/`hydrate*`/`queue*`/`send*`/`get*`). This matches every other layer (`constants/<domain>`, `controllers/<audience>/<domain>`, `routes/<resource>`). Do **not** create kind-based grab-bag folders (`writers/`, `validators/`, `senders/`) — they scatter one feature across many folders. The only kind-based folders are: `core/` (domain-agnostic primitives — errors, http, db, uids), `formatting/`, and the two **layer folders** `hydrators/` (DB→DTO) and `clients/` (third-party SDK singletons). `aws/` is "talks to an AWS service", `moderation/` is "the policy".

**Reuse Prisma selects.** If a controller queries the same shape as an existing select in `src/prisma/selects/`, use it. Inline select shapes that duplicate an existing one drift when the source changes.

**Reuse types from `@tagly/models`.** Before defining a local TypeScript type or Zod schema in the backend, check `tagly-shared/models/src/core/` (enums, UIDs, time, etc.) and `tagly-shared/models/src/dtos/v2/` (DTOs are versioned). If the type belongs to the shared contract, it must live in `@tagly/models` — not locally in the backend.

**Share state — ALWAYS via `utils/shares/shareAccess.ts`.** Never determine a share's state (advertiser-visible, unassessed, rejected-like, live/dead, pending approval, report-blocked, paid, in-flight) by writing an `approvalStatus`/`status`/`report.status`/`ratedAt` literal into a query or condition — compose the named predicates from `shareAccess.ts` (each rule exists as a Prisma `where` fragment, a Kysely/SQL fragment, and an in-memory twin). Client-facing statuses come only from `deriveCustomerShareStatus` / `deriveAdvertiserShareStatus` (`utils/hydrators/shares/`), which compose `isRejectedLikeShare` from the same file. The only sanctioned raw literals are state-transition **writes** (`data: { status: "PAID" }` etc.) and the four documented moderation-agnostic reads (see the Share Approval Gate section below for the full predicate catalog).

## Versioning — only the wire is versioned (read before adding backend code)

**`controllers/v2/` + `routes/v2/`** (and models `endpoints/v2` + `dtos/v2`) are the current client generation's **wire contract**, kept append-only so shipped builds never break (see Client Compatibility below). **Everything behind the wire is a single flat tree**: `utils/<domain>/`, `constants/<domain>/`, `prisma/selects/`, `middleware/`, `workers/`, `db/`, `prisma/`, `environment/`, `seed/`, `app.ts`, and the external-caller `controllers/webhooks/`. There are no lifecycle buckets — the `permanent/` vs `v2/` split was collapsed on 2026-09-01, the day after the v1 generation was deleted (2026-08-31): one version, one tree. A future generation adds `controllers/v3` + `routes/v3` + its models trees alongside `v2`; the shared code behind them evolves in place, and a retired generation is deleted by removing its wire trees + orphan-scanning what only they referenced.

**Two facts about `constants/rewards/` that used to justify a bucket still hold as rules:** the **scoring algorithm** (ECPM, multipliers/*, META, CUSTOMER_RATING) re-prices every share the moment it changes, so it moves only with an algo-version bump (next paragraph); the **settlement economics** (`PRICING` — lock %, platform take, subsidized pricing, max price — and `REFERRAL_TAKES`) and the **moderation penalties** (`content/REPORT_PENALTIES`) are platform policy, changed deliberately and rarely. **The business-type/vertical `rewardMultiplierBps` values live in the shared `@tagly/models` verticals catalogs** (catalog-only — the old write-only DB columns were dropped at algo v11, so a deploy is the only update path): they are consumed by `calculateTypeBps` (`utils/pricing/helpers/`, est + final, recorded on `FinalPrice.typeMultiplierBps`), so retuning a catalog multiplier re-prices and needs an algo-version bump.

**The reward algo version IS the release version.** `LOCAL_REWARD_ALGO_VERSION`
(`constants/rewards/META.ts`) is a semver **string** matching
`tagly-backend/package.json` — `"2.0.2"`, not a counter. Every `FinalPrice` row
stamps it, so `git checkout v<value>` lands on the exact constants that produced
any historical price, with no counter→release lookup table. **The rule: any change
that alters a computed price — an eCPM, any multiplier constant, the pipeline
itself — must bump `tagly-backend/package.json` AND set this constant to that new
version, in the same commit.** It moves only when _pricing_ moves, so two rows
sharing a value were priced by identical rules and a release that doesn't touch
pricing correctly leaves it behind. Rows written before the switch hold the old
integer scheme as text (`"1"`..`"12"`; the deleted v1 pricer stamped `"5"`).

**Prisma selects.** Generic **leaf** projections composed widely (`media.preview` → many consumers, `address.withId(.preview)`, …) live in `prisma/selects/`. **Composite, DTO-shaped** selects mirror one wire response, so **inline them in their hydrator** (the hydrator already owns the output shape; a select with a single consumer is single-use — root `CLAUDE.md` "inline single-use"); only extract one if a second caller of the same shape actually appears.

**External-caller endpoints are never client-versioned:** `controllers/webhooks/` — **Stripe** and **Instagram/Meta compliance** (the caller is Stripe/Meta, not an app build; mounted directly in `app.ts`, URLs frozen because the Stripe/Meta dashboards point at them; Stripe handlers live in `utils/money/stripe/webhookHandlers/`, the Instagram deauthorize + data-deletion + deletion-status callbacks in `controllers/webhooks/instagram/`) and the **email unsubscribe endpoint** (`controllers/webhooks/email/unsubscribeEmail.ts`, GET+POST mounted directly in `app.ts` on the canonical `/webhooks/email/unsubscribe` AND the legacy `/public/unsubscribe` — both frozen forever: the URL is baked into every sent email + the RFC 8058 `List-Unsubscribe` headers with non-expiring tokens, and its callers are humans/mail providers — a dead unsubscribe URL converts opt-outs into spam reports and burns sender reputation).

**Workers are one fleet.** The `workers/` tree is flat (one folder per worker) and never rides a client cutover; its jobs import `utils/` and `constants/` like everything else (the sharePayment worker settles via `utils/pricing/calculateFinalPrice`; PAYG + monthly-budget charging via `utils/money/stripe/chargeAdvertiserCardOffSession`).

**The cutover recipe** (deleting a retired generation — done for v1 on 2026-08-31, the same for v2 → v3): raise the min-version wall and wait out the safety window; `rm -rf controllers/<gen> routes/<gen>` + the generation's models trees/barrels; **orphan-scan** `utils/`, `constants/`, `prisma/selects/`, `middleware/`, `seed/` for files only that generation referenced and delete those; drop the schema columns/tables only that generation wrote (one Prisma migration); purge the `@deprecated` back-compat symbols whose readers were in the deleted generation; regenerate the INDEX files (`yarn gen:index`); tsc; update the docs.

> **Worker launch path:** each worker compiles to `dist/workers/<name>/run.js` and is self-executing (the process entry lives at the bottom of `run.ts`); `ops/entrypoint.sh` maps `$WORKER` → the right `run.js`.

## Shared Packages

**Use this package:**

- `@tagly/models` - DTOs, Zod schemas for request/response validation

**Do NOT import from:**

- `@tagly/sdk` - Client-side only (makes HTTP requests)
- `@tagly/client` - React Native only
- `tagly-shared/client/` - React Native only

The backend defines the API that the SDK consumes. Import schemas from `@tagly/models/*` for validation.

## Database Access Patterns

**Prisma Client:**

- Generated client lives in `src/generated/prisma/`
- Import via `import prisma from './prisma/prisma.js'`
- Schemas define two PostgreSQL schemas: `app` and `jobs`
- All models use explicit `@@map()` and `@map()` for snake_case DB columns

**Kysely (Type-Safe SQL):**

- Used for complex queries where Prisma falls short
- Types generated via `yarn db:types`
- Geospatial queries use PostGIS extension

**NEVER use Prisma raw queries (`$queryRaw`, `$executeRaw`, `$queryRawUnsafe`, `$executeRawUnsafe`) for table data.**
TypeScript provides no type-checking on raw query results or column names — bugs like referencing a renamed column are invisible until runtime. If you need raw SQL (PostGIS, window functions, complex aggregations), use Kysely's `sql` template tag or query builder instead.

Acceptable exceptions (these call PostgreSQL system functions, not table data):

- Health-check `SELECT 1` in `app.ts`
- Advisory lock calls (`pg_try_advisory_lock`, `pg_advisory_unlock`) in maintenance workers

```typescript
// ❌ WRONG — no type safety, column renames are silent runtime errors
const rows = await prisma.$queryRaw<
  { id: number }[]
>`SELECT id FROM app.locals`;

// ✅ CORRECT — Kysely with generated types
const rows = await db.selectFrom("app.locals").select("id").execute();

// ✅ CORRECT — Kysely sql tag for PostGIS / raw expressions
import { sql } from "kysely";
await db
  .updateTable("app.addresses")
  .set({
    location: sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography`,
  })
  .where("id", "=", addressId)
  .execute();
```

**Key Database Features:**

- PostGIS for location-based queries (required in first migration)
- `citext` extension for case-insensitive email comparisons
- Two-phase commits for media uploads (pending → confirmed)

### ⚠️ LOCAL DEV ONLY — the local Postgres timezone skews app-written timestamps

Matej's local Postgres reports `SHOW timezone` = **`Europe/Prague`**, not UTC.
The consequence, observed 2026-09-03 while testing the monthly top-up:

- Timestamps written **by the app** (Prisma) land **one local UTC offset early**
  — 2h in CEST, 1h in CET. `nextMonthlyBudgetRunAt` builds `Date.UTC(..., CHARGE_HOUR_UTC=6)`
  and the row stored `04:00 UTC`. Same for `upcomingNoticeSentAt` etc.
- Timestamps written **by SQL** (`now()`, an explicit `TIMESTAMPTZ '…+00'`) are
  correct. So app-written and SQL-written values silently disagree by the offset.
- Worst symptom: a worker's due-check (`nextRunAt: { lte: now }`) is shifted the
  same way, so **a row you make due with SQL `now()` is never picked up**. Verified:
  a period due at 13:14 UTC sat unprocessed for minutes; moved to 10:20 UTC the
  stripe worker took it in ~5s.

**Testing workaround** — when you want something to run "now", set it to
`now() - interval '<local UTC offset>'` (e.g. `now() - interval '2 hours'` in
summer). **Permanent local fix:** `ALTER DATABASE flaer SET timezone = 'UTC';`
then restart the workers.

**This is a local-machine artifact, and the boundary is absolute.** Prod/staging
RDS is expected to be UTC, which is why the skew doesn't exist there. You may
freely edit values in the **local** dev DB to set up a test — including shifting
timestamps by the offset. You may **NEVER** change anything in staging or
production: no DDL, no `ALTER DATABASE`, no timestamp fixups, no "just this one
row". If a read shows staging or prod is *not* on UTC, that is a real bug —
report it with the statements and let a human run them (see the HARD RULE at the
top of this file).

## Redis (shared state + caching)

The backend runs as **many processes** — App Runner auto-scales the API to N
instances and each worker is its own Fargate task. So any state that must be
consistent _across_ processes can't live in process memory; it lives in **Redis
(ElastiCache Valkey)**, reached via the singleton `utils/clients/redis.ts`
(`REDIS_URL` is required in every env; TLS is inferred from the `rediss://` scheme).

**Reach for Redis whenever something is either:**

1. **Cross-relation / cross-instance dependent** — a value that's wrong if each
   process keeps its own copy. E.g. **rate limits** (`middleware/security/rateLimit.ts`
   is backed by `rate-limit-redis`, so a caller's limit is enforced across _all_
   instances instead of `limit × N`), distributed locks, any shared token bucket. If
   you catch yourself adding a module-level `Map`/counter that other instances also
   need to see, it belongs in Redis.
2. **Heavy backend work worth caching** — an expensive computation many requests
   repeat. E.g. **reward calculation** (see the read-through cache below — it turns a
   ~200-query batch pricing into a couple of Redis ops on repeat loads).

**Always fail open.** Every Redis consumer must degrade gracefully when Redis is
unreachable — rate limiters use `passOnStoreError: true` (allow the request), caches
fall back to computing fresh. A Redis outage costs performance, never correctness or
availability.

### Reward-estimate cache — bump the generation or serve stale prices

Display estimates are cached read-through in `utils/pricing/getEstPricesCached.ts`
(share _creation_ never reads the cache — it prices fresh). **If you write anything
that feeds `calculateEstPrices`, you MUST bump the matching generation counter**
(`utils/pricing/rewardEstCache.ts`): per-customer
`bumpCustomerRewardEstGen` (IG snapshot/state change, new share, interests, rating,
story-views), per-business `bumpBusinessRewardEstGen` (address/type/subsidization),
per-advertiser `bumpAdvertiserBudgetGen` (bumped automatically by
`applyBalancesFromEvent` on every ledger movement + explicitly by the PAYG card
endpoints). A missed bump only falls back to the 24h TTL. Full trigger list, key
schema (`s2` token), and current wiring:
[docs/backend/REWARD_EST_CACHE.md](../docs/backend/REWARD_EST_CACHE.md).

## Authentication & Authorization

> **`middleware/` is grouped into `auth/`, `security/`, `request/`, `shutdown/`** (all permanent — `middleware/` is never versioned): `auth/` = `verifyJwt`, `requireCapability` (token type), `requireAdminRole` (admin sub-role); `security/` = `rateLimit`, `enforceMinVersion`; `request/` = `validateRequest`, `errors`; `shutdown/` = the 2026-10 wind-down gates, **production only** (`APP_STAGE === "production"`; staging/dev pass through) — `blockDuringShutdown` (503 on share creation + advertiser billing writes; withdrawals, webhooks, reads and billing DELETEs stay open) and `noShareOpportunityDuringShutdown` (app-open nudge always "none"). Outside middleware, `adminSendBlast`'s `fetchShutdownEmailIds` narrows the CUSTOMER blast's EMAIL leg to customers with ≥1 share or a balance > 0 (push unfiltered; prod only). Every wind-down block is tagged `@shutdown`: `grep -rn "@shutdown" tagly-backend/src`.

**JWT-based, bearer-only.** Every client is a native app sending `Authorization: Bearer <jwt>`; there is no cookie session, no CORS layer, and nothing sets or clears cookies (the browser surfaces — join page, website — call only unauthenticated `/v2/public/*`, server-side).

- Customer JWTs contain `customerId` and `capability: "customer"`
- Advertiser JWTs contain `advertiserId` and `capability: "advertiser"`
- Middleware: `verifyJwt` → `requireCustomerCapability`, `requireAdvertiserCapability`, or `requireAdminCapability` (token type), then optionally `requireSuperAdmin` / `requireSuperOrOpsAdmin` / `requireSuperOrSupportAdmin` (admin sub-role)

### ⚠️ `req.user.id` is a per-table PK — the capability gate is what makes it safe

`verifyJwt` sets `req.user = { id, uid }`. The **`uid` is the only thing that
carries the principal's type** (it is prefix-namespaced — `c-` / `a-` / `admin-`,
resolved by `getEntityFromUid`); `req.user.id` is a bare integer that is a primary
key **in whichever table that prefix names**. `Customer`, `Advertiser` and `Admin`
are independent `autoincrement()` sequences all starting at 1, so the same integer
identifies three different real accounts.

Nearly every `/v2/customers/**` and `/v2/advertisers/**` controller scopes by
`req.user.id`. That is only correct because **the capability gate at the mount
guarantees the principal type** — `requireCustomerCapability` admits CUSTOMER
only, `requireAdvertiserCapability` ADVERTISER only. Rules that follow:

- **Never add `"ADMIN"` back to those two allow-lists.** It re-arms an
  account-takeover class across every controller behind the mount at once (an
  admin then operates as whichever customer/advertiser shares their PK). Admins
  get their data through the role-gated `/v2/admin/*` routes.
- **A mount with no capability gate must assert the entity in the handler.**
  `/v2/cross/**` takes any valid JWT, and its controllers do exactly this — see
  `crossApp/agreeWithTos.ts` (`getEntityFromUid(uid)` → 4785) for the pattern.
- **Anything keyed on the principal across principal types uses `uid`, not `id`** —
  rate-limit buckets, cache keys, dedupe keys. The uid is globally unique; the
  integer is not.
- **Where the output is a credential, select the row by `uid`** and take the
  token's `id` claim from the matched row, so id/uid/version can never describe
  different accounts (`me/security/signOutOtherSessions.ts`).

**Rate Limiting:**

- `appIpLimiter` - IP-based for public routes
- `authedUserLimiter` - JWT-based for authenticated routes (keyed on `req.user.uid`)
- `gentlePerRouteLimiter` - Per-route specific limits (keyed on `req.user.uid` + method + path)

## App Routing

Everything client-facing lives under the `/v2` router, mounted once in `app.ts`; it owns its own per-group middleware (see `routes/v2/index.ts`):

- `/v2/public/*` - Unauthenticated endpoints (auth entry points, suggest-locale, public stats/stickers)
- `/v2/customers/*` - Customer app endpoints (`verifyJwt` + `requireCustomerCapability`)
- `/v2/advertisers/*` - Advertiser app endpoints (`verifyJwt` + `requireAdvertiserCapability`)
- `/v2/admin/*` - Admin app endpoints (`verifyJwt` + `requireAdminCapability`, data routes also `requireSuperAdmin`)
- `/v2/cross/*` - Cross-app endpoints (any valid JWT; handlers assert the entity)

Mounted directly in `app.ts`, outside the versioned router: the Stripe + Instagram webhooks, `/health`, and the permanent email-unsubscribe paths (`/webhooks/email/unsubscribe` and the legacy `/public/unsubscribe`). See `src/app.ts` for routing setup.

## Customer & Instagram Bans

Customers have a `status` (`ACTIVE | BANNED`). A BANNED customer can log in but not
perform value-bearing actions — call `assertCustomerNotBannedOrThrow(customerId)`
at the top of any such controller. `BannedInstagram`
block-lists the IG itself — call `assertInstagramNotBannedOrThrow(instagramUid, tx?)`
wherever an IG is assigned/reassigned to an account (wired into
`createCustomerWithUniqueUid` and the IG connect flow; do NOT add it
to plain login of an already-bound account). Ban/unban happens only via
`PATCH /v2/admin/customers/:uid/banned`. Error codes are named constants:
`CUSTOMER_BANNED` (1540) / `INSTAGRAM_BANNED` (1541) — thrown via the constant,
mapped centrally in `tagly-shared/client/api/caller.ts`. Ban scope (E059), the
`customerUid` audit-pointer rule, and client-facing ban state:
[docs/backend/SHARE_MODERATION_AND_BANS.md](../docs/backend/SHARE_MODERATION_AND_BANS.md).

## Share Approval Gate

Every share carries `approvalStatus` (`PENDING | APPROVED | REJECTED`), orthogonal
to the pipeline `status`. New shares are `PENDING` and **fully hidden from the
advertiser** (no lock, no notification, excluded from every advertiser-facing
query/stat). Admin moderation: `POST /v2/admin/shares/:uid/approve` (flips to
APPROVED + places the deferred lock; CREDITS locks capped at then-available budget,
1-cent minimum) / `.../reject` (REJECTED + multiplier penalty; **rejection is the
only way to kill a bad share — there is no hard-delete**); both are CAS-guarded on
`status = "PROCESSING"`. The payment worker requires `approvalStatus = "APPROVED"`
and a 24h minimum share age (the review window).

**Every share-axis predicate comes from `utils/shares/shareAccess.ts`**
(see Check Before You Build) — never re-inline a share-state literal in a query;
the only sanctioned raw literals are state-transition **writes**
(`data: { status: "PAID" }` etc.) and the documented moderation-agnostic reads. A
story is monetizable **ONCE, EVER** via the append-only `monetized_instagram_posts`
registry (E074) — never re-derive "already monetized" from `Share.igPostId`, never
add a delete path to the registry. Voiding always goes through
`markShareUnpayableAndUnlock` (typed `ShareVoidReason` in `reason`; raw error text
only in `detail`).

Full surface — Review-tab endpoints, report review, links moderation,
approve/reject edge cases, the complete predicate catalog, registry rationale, and
client-facing ban state:
[docs/backend/SHARE_MODERATION_AND_BANS.md](../docs/backend/SHARE_MODERATION_AND_BANS.md).

## Input Validation & IDOR Protection

**All requests must be validated using Zod schemas:**

```typescript
// Route definition
import { validateReq } from "../../middleware/request/validateRequest.js";

r.post("/create", validateReq("body", CreateBodySchema), createHandler);
r.get("/search", validateReq("query", SearchQuerySchema), searchHandler);
r.get("/:id", validateReq("params", IdParamsSchema), getHandler);
```

**Access validated data (never raw `req.body`):**

```typescript
// ✅ CORRECT - Use validated data
const { name, typeId } = req.validatedBody as CreateBody;
const { q, limit } = req.validatedQuery as SearchQuery;
const { id } = req.validatedParams as IdParams;

// ❌ WRONG - Bypasses validation
const { name } = req.body;
```

**IDOR Protection - Always filter by owner:**

```typescript
// ✅ CORRECT - Ownership filter prevents accessing other users' resources
const advertiserId = req.user.id;
const resource = await prisma.resource.findFirst({
  where: { id: resourceId, advertiserId }, // Ownership filter
});
if (!resource) throw createCustomError(1001, "Resource not found", 404);

// ❌ WRONG - IDOR vulnerability, can access any resource
const resource = await prisma.resource.findUnique({
  where: { id: resourceId },
});
```

## Error Code Conventions

**CRITICAL: Error codes under 1000 are RESERVED for generic/system errors.**

Error codes are defined in `tagly-shared/models/src/constants/system/ERROR_CODES.ts`:

```typescript
ERROR_CODES = {
  SDK: { ... },        // 1-70: Client-side SDK errors
  SERVER: { ... },     // 100-310: Generic server errors (auth, OTP, validation)
  DOMAIN: { ... },     // 1000+: Domain-specific business logic errors
}
```

**When throwing custom errors in controllers:**

- **Always use codes >= 1000** for domain-specific errors
- Codes < 1000 are reserved for generic errors like auth failures, validation, rate limits
- Use `createCustomError(code, message, httpStatus)` from `utils/core/errors/createCustomError.js`. The
  positional `status` form is the everyday case; there's also an **options form** —
  `createCustomError(code, message, { status?, permanent?, expected?, errors?, cause?, notify?, notifyKey? })` —
  used by workers (`{ permanent: true }` to fail a job terminally), to force-mute a benign ≥500 tracker report
  (`{ expected: true }`), to attach a root-cause for the tracker without leaking it to the client
  (`{ cause: err }` — the client message stays clean, the cause rides to PostHog), and to **escalate a
  "shouldn't happen, a human must act" error to a team email** (`{ notify: true, notifyKey: "...:{entityId}" }`
  — see below). Both overloads produce the same `CustomError` shape.

**Error tracking (observability).** All errors ship to PostHog via the single sink
`utils/core/errors/reportError.ts`; the API central handler and the
worker runtime call it for you — never call the PostHog client directly, never
reintroduce a DB error table. The classifier is **`track = !expected`**: everything
is captured unless the throw-site passes `{ expected: true }` (reserve that for
operational noise — validation, auth/session, rate-limit, the wrong-OTP typo; OTP
_flow_ errors stay tracked). Backend product events (not errors) go through
`captureServerEvent.ts` (pseudonymous `distinctId`, never PII). For
money-integrity / invariant violations ONLY, escalate with
`{ notify: true, notifyKey: "<reason>:{entityId}" }` — a deduped team email on top
of the capture; routine rejections and self-healing transients must never set it,
and never call `sendTeamAlertEmail` ad-hoc for errors. Full mechanics (audience
property, sanctioned direct-call case, `notifyLines`, the muted edge-case list):
[docs/backend/OBSERVABILITY.md](../docs/backend/OBSERVABILITY.md).

```typescript
// ✅ CORRECT - Domain error with code >= 1000
throw createCustomError(4008, "Selected type must have 'LOCAL' in scope", 400);
throw createCustomError(2202, "No pending account found", 404);

// ❌ WRONG - Never use codes < 1000 for domain errors
throw createCustomError(100, "Invalid type", 400); // 100 is reserved for ZOD errors
```

## Controller Design Patterns

Controllers follow a consistent pattern. Always reference existing controllers as examples.

**1. Basic Structure:**

```typescript
import type { RequestHandler } from "express";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";

export const myController: RequestHandler = asyncHandler(async (req, res) => {
  // 1. Extract validated data
  const { field1, field2 } = req.validatedBody as MyRequestBody;
  const userId = req.user.id;

  // 2. Business logic with proper error handling
  const record = await prisma.model.findFirst({ where: { ... } });
  if (!record) {
    throw createCustomError(1001, "Record not found", 404);
  }

  // 3. Return typed response
  res.status(200).json({
    message: "Success",
    data: record,
  } satisfies MyResponse);
});
```

**2. Key Patterns:**

- **Always use `asyncHandler`**: Wraps async handlers to catch errors properly
- **Type the request body**: Cast `req.validatedBody as YourBodyType` (validated by middleware)
- **Access user via `req.user`**: Contains `id` and other JWT payload data
- **Use `createCustomError`**: For all error responses with proper codes (>= 1000)
- **Use `satisfies` for responses**: Ensures type safety on JSON responses

**3. Database Operations:**

```typescript
// Use Prisma transactions for atomic operations
const result = await prisma.$transaction(async (tx) => {
  const created = await tx.model.create({ data: { ... } });
  await tx.otherModel.update({ where: { id: ... }, data: { ... } });
  return created;
});

// Use Kysely's `sql` tag for PostGIS operations — NEVER Prisma raw queries
import { sql } from "kysely";
await db.updateTable("app.addresses")
  .set({ location: sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography` })
  .where("id", "=", addressId)
  .execute();
```

**4. Utility Functions:**

- Extract reusable logic into `utils/` (e.g., `geocodeAddressOrThrow`, `verifyOtpForSessionOrThrow`)
- Name throwing utilities with `OrThrow` suffix to indicate they throw on failure
- Use `generateUid("PREFIX")` for unique identifiers

**5. File Organization:**

```
src/controllers/
├── webhooks/               # PERMANENT — external-caller endpoints (Stripe + Instagram/Meta).
│   ├── stripe/             #   Stripe calls these, not app clients, so they are not
│   │                       #   client-versioned and survive every cutover.
│   └── instagram/          #   Meta compliance callbacks (deauthorize / delete-data /
│                           #   deletion-status) — same rationale: dashboard-frozen URLs.
└── v2/                     # The current wire contract (versioned — deleted wholesale at the next cutover)
    ├── adminApp/           # Admin dashboard endpoints
    ├── advertiserApp/      # Advertiser-specific endpoints
    ├── crossApp/           # Cross-app endpoints
    ├── customerApp/        # Customer-specific endpoints
    └── public/             # Unauthenticated endpoints
```

## Two-Phase Init/Confirm Pattern

Media uploads and complex creations use a two-phase pattern:

- **Init** — creates a pending record with an `expiresAt`, returns presigned S3
  upload URLs.
- **Confirm** — atomically claims the pending row (an `updateMany` CAS on status →
  `PROCESSING`), copies media from the pending to the final S3 location, creates
  the permanent record, deletes the pending row; on failure it best-effort deletes
  the copied keys and resets the pending status, then rethrows.

Reference implementation:
`controllers/v2/advertiserApp/businesses/createBusinessInit.ts` +
`createBusinessConfirm.ts` (the admin twins follow the same shape).

## Concurrency Safety

**Use atomic operations to prevent race conditions:**

```typescript
// ✅ CORRECT - Atomic claim with conditions
const claimed = await prisma.resource.updateMany({
  where: {
    id: resourceId,
    ownerId: req.user.id,
    status: "PENDING", // Only claim if still pending
  },
  data: { status: "PROCESSING" },
});
if (claimed.count === 0) {
  throw createCustomError(4091, "Invalid state or already claimed", 409);
}

// ❌ WRONG - Race condition between find and update
const resource = await prisma.resource.findFirst({
  where: { id, status: "PENDING" },
});
if (resource) {
  // Another request could claim it here!
  await prisma.resource.update({
    where: { id },
    data: { status: "PROCESSING" },
  });
}
```

**Handle P2002 (unique constraint) for race conditions:**

```typescript
try {
  await prisma.record.create({ data: { uniqueField: value, ... } });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    // Another request created it first - handle gracefully
    throw createCustomError(4092, "Already exists", 409);
  }
  throw e;
}
```

## Cleanup Patterns

**On Success - Delete temporary resources:**

```typescript
// After successful promotion
await prisma.pendingRecord.delete({ where: { id: pendingId } });
await deleteS3Keys([`pending/${pendingId}/media`]).catch(() => {});
```

**On Failure - Best-effort cleanup:**

```typescript
const copiedKeys: string[] = [];
try {
  copiedKeys.push(await copyToS3(pending, final));
  await prisma.resource.create({ data: { ... } });
} catch (err) {
  // Best-effort cleanup - don't let cleanup errors mask the original error
  await deleteS3Keys(copiedKeys).catch(() => {});
  await prisma.pendingRecord.delete({ where: { id } }).catch(() => {});
  throw err;
}
```

## Constants

**`src/constants/` is organised by domain, `UPPER_SNAKE.ts` filenames** (no separate `tunables/` folder — every config value, tunable or static, lives here):

```
constants/
├── auth/                  JWT, OAUTH, OTP, RATE_LIMITS, UID_COLLISION, PASSWORD_HASH (admin passwords)
├── billing/               PAYG, STRIPE, MONTHLY_BUDGET (top-up retry ladder, 06:00 UTC run hour, 3-day notice)
├── catalogs/              notification catalogs + weight catalogs (reference data)
├── content/               MEDIA, REKOGNITION, ADVERTISER_SHARES, PROFANITY, REPORT_PENALTIES (+ SHARE_REJECTION_PENALTY_BPS — moderation-penalty policy)
├── instagram/             INSTAGRAM, AUDIENCE_CAPTURE
├── integrations/          EXPO_PUSH, SAFE_BROWSING, RESEND
├── localization/          TIMEZONE_TO_COUNTRY
├── platform/              ADMIN, ADMIN_REVIEW (moderation-queue page size), ACCOUNT_UPDATES, APP_OPEN_PROMPT, TERMS, POSTGRES_LOCKS
├── rewards/               PRICING (lock/take/subsidized/max-price), REFERRAL_TAKES — settlement economics;
│                          ECPM, META, CUSTOMER_RATING + multipliers/* — the scoring algorithm (bump the algo version when these move)
└── workers/               DB_CLEANUP, IG_INSIGHTS, … (one per worker)
```

**Example:**

```typescript
// src/constants/auth/OTP.ts
export const OTP = {
  HASH_ROUNDS: 12,
  MAX_ATTEMPTS: 5,
  EXPIRATION_MS: 15 * 60 * 1000, // 15 minutes
};
```

**Rules:**

1. **Never hardcode config values in controllers/utilities** — always import from `constants/<domain>/`.
2. **Put a new value in the right domain folder**, `UPPER_SNAKE.ts`. Add a new domain folder if none fits; don't recreate a `tunables/` bucket.
3. **One exported object per domain concept** (e.g. `OTP`, `ADMIN`, `JWT`); merge same-purpose values into one file rather than scattering 1-liners.
4. **Add comments for time values** (`// 15 minutes`); suffix with `_MS`, `_SECONDS`, etc.
5. The reward **scoring algorithm** (`rewards/{ECPM,multipliers,CUSTOMER_RATING,META}`) re-prices every share when it changes — it moves only together with an algo-version bump (see the Versioning section above); the settlement economics `rewards/{PRICING,REFERRAL_TAKES}` and the moderation penalties `content/REPORT_PENALTIES` are platform policy, changed deliberately and rarely.

## DTO Notes

- `AdvertiserMe` exposes `locale` (ISO alpha-2, `"US"` / `"CZ"`) — same shape as `CustomerMe.locale`. Used by the client for currency display localization. Hydrators read it as-is (`as SupportedLocale`) — the value is writer-guaranteed at registration; never re-validate it at read time (see `utils/hydrators/CLAUDE.md`).

## Code Organization

**One function per file** - Controllers and utilities should export a single main function per file.

**File locations:**

| Type                        | Location                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Prisma select objects       | `src/prisma/selects/` (reusable leaves; DTO-shaped composites are inlined in their hydrator) |
| Utility functions           | `src/utils/<domain>/` (one flat tree, domain-first — see `src/utils/README.md`)              |
| Hydrators (data enrichment) | `src/utils/hydrators/` (see the `CLAUDE.md` there)                                           |
| Environment variables       | `src/environment/envVariables.ts`                                                            |
| Constants                   | `src/constants/<domain>/`                                                                    |
| Request validation          | Routes via `validateReq` middleware                                                          |

**Environment Variables:**

All env variables must be declared in `src/environment/envVariables.ts`. Never use `process.env` directly elsewhere.

```typescript
// ✅ CORRECT
import { envVariables } from "../environment/envVariables.js";
const secret = envVariables.JWT_SECRET;

// ❌ WRONG
const secret = process.env.JWT_SECRET;
```

## Financial Operations (CRITICAL)

**Money movements are CRITICAL SECURITY. Always get explicit approval before modifying financial code.**

### Rules

1. **Never create ledger events directly** - Always use wrapper functions from `src/utils/money/ledger/events/`
2. **Always ask before changing** - Show plan and get approval before modifying any financial code
3. **Verify money integrity** - Ensure funds don't get stuck, doubled, or moved to wrong accounts
4. **Never charge a card twice** - the charge-idempotency model (effect refs vs per-attempt refs, the 1337/1342 boundary, when an attempt counter may advance, who books a PENDING row) lives in [src/utils/money/stripe/CLAUDE.md](src/utils/money/stripe/CLAUDE.md). **Read it before touching anything that charges a card**, and see [src/utils/money/withdrawals/withdrawals.md](src/utils/money/withdrawals/withdrawals.md) for the payout-side twin.

### Ledger Event Wrappers

```
src/utils/money/ledger/events/
├── sharePayment/
│   ├── lockBudgetForShare.ts                    # Reserve funds for a share
│   ├── settleSharePayoutAndUnlockRemainder.ts   # Pay customer, release excess
│   ├── settleSubsidizedSharePayout.ts           # Platform-funded payout
│   ├── unlockLockedBudgetForShare.ts            # Release advertiser lock
│   └── unlockPlatformBudgetForShare.ts          # Release platform lock
├── creditPurchase/
│   ├── createAdvertiserCreditPurchaseEvent.ts   # Advertiser buys credits
│   └── refundAdvertiserCreditPurchase.ts        # Refund a credit purchase
├── withdrawals/
│   ├── lockBalanceForWithdrawal.ts              # Lock customer balance
│   └── createWithdrawalFromLocked.ts            # Customer withdraws balance
├── payg/createPaygChargeEvent.ts                # PAYG card charge
├── createReferralPayoutEvent.ts                 # Referral bonus payment
└── ... (other wrappers)
```

**Correct Pattern:**

```typescript
import { lockBudgetForShare } from "../utils/money/ledger/events/sharePayment/lockBudgetForShare.js";

// Use wrapper - handles idempotency, validation, notifications
const { event, lockCents } = await lockBudgetForShare(tx, {
  advertiserId,
  shareId,
  estimatedPriceCents,
});
```

**Anti-Pattern:**

```typescript
// NEVER create ledger events directly
await prisma.transactionLedgerEvent.create({
  data: { kind: "SHARE_LOCK", ... }  // WRONG
});

// NEVER use createLedgerEvent directly for business logic
await createLedgerEvent(tx, { kind: "SHARE_LOCK", ... });  // WRONG - use wrapper
```

### Withdrawal state transitions — one owner

`StripeWithdrawal` has two lifecycles: the **ledger** `status` (`PENDING`/`FAILED`/`COMPLETED`/`REVERSED`) and the **payout** leg (`payoutStatus` `NONE`/`IN_FLIGHT`/`PAID`/`FAILED`/`CANCELED`), plus `settledAt`, `payoutAttempts`, `nextPayoutRetryAt`, `reversedCents`, `stripeAccountId`, `purpose`. **The only code allowed to write `status` / `payoutStatus` / `failureCode` / `failureMessage` / `settledAt` / `payoutAttempts` / `nextPayoutRetryAt` / `stripePayoutId` is the `record*` helpers in `utils/money/withdrawals/withdrawalTransitions.ts`** — never update those columns inline. The orchestrator, the payout util, the Connect webhook handlers, and (from WP-2) the reconciliation worker all route through them (`recordTransferSucceeded`/`recordTransferFailed`/`recordSettled`/`recordPayoutCreated`/`recordPayoutPaid`/`recordPayoutFailed`/`recordPayoutCanceled`/`recordPayoutCreateFailed`/`recordPayoutCreateDeferred`/`recordReversal`/`scheduleImmediatePayoutRetryForAccount`/`parkPayoutRetries`), so the transfer→settle→payout→reversal transitions can never disagree. **The payout attempts budget counts REAL failures only (W-21):** funds still `pending` on the connected account throw the typed 1723 deferral _before_ `payouts.create` and reschedule against Stripe's `available_on` via `recordPayoutCreateDeferred` — no attempt consumed, no idempotency key burned; never route a funds-availability wait through the W-19 backoff. Stripe errors around money movement are classified by the shared `utils/money/stripe/stripeErrorClassification.ts` (`isDefinitiveStripeRejection`: only a definitive rejection may release locked funds; anything ambiguous keeps state and reconciles against Stripe later) — never hand-roll that split at a call site. The withdrawal `purpose` vocabulary (DB enum ↔ the frozen lower-snake wire strings in Stripe metadata + idempotency keys) is single-sourced in `utils/money/withdrawals/withdrawalPurpose.ts` — writers use `toWire`/`toDb`, webhook handlers gate with `parseWireWithdrawalPurpose`; never write the literals inline. Customer-facing display collapses `(status, payoutStatus, payoutAttempts, nextPayoutRetryAt)` via `utils/hydrators/billing/deriveWithdrawalDisplayState.ts` (the single collapse point; a create-side **parked** row — attempts > 0, no retry scheduled — renders DELAYED, never "on its way"). **Payout denomination is W-20:** `createStandardWithdrawalPayoutOrThrow` derives the payout amount/currency from the transfer's **destination payment** on the connected account (balance-txn `net` in its currency, minus destination `amount_refunded`), never from the USD ledger figures — echoing the ledger produced a guaranteed `balance_insufficient` on every non-USD (CZ) account; on USD accounts the derivation is value-identical. The derived figure is never persisted (DB stays USD-only) and the customer absorbs the FX fee by policy. Full rationale + transition table: [src/utils/money/withdrawals/withdrawals.md](src/utils/money/withdrawals/withdrawals.md).

### Critical Validations

1. **No stuck funds** - Every lock must have an unlock path (success or failure)
2. **No duplicate transactions** - Use `externalRef` for idempotency
3. **Correct account ownership** - Validate IDs before charging/paying
4. **Zero-sum integrity** - Use `enforceZeroSum: true` for internal transfers
5. **Terminal share transitions are CAS-guarded** - a settle claims `PROCESSING → PAID` first-in-tx (`workers/sharePayment/helpers/markSharePaidOrThrow.ts`); a void claims `PROCESSING → UNPAYABLE` (`markShareUnpayableAndUnlock`). Whoever loses the claim must not move money or release locks — the winner owns the terminal state. Never flip `Share.status` to a terminal value with an unguarded `update`.
6. **Locked funds are released only on a DEFINITIVE Stripe rejection** — classify every money-moving Stripe error with `utils/money/stripe/stripeErrorClassification.ts` (`isDefinitiveStripeRejection`); this governs withdrawals, the PAYG off-session charge (1337 definitive / 1342 ambiguous), AND the admin refund failure leg. An ambiguous outcome (timeout/5xx — the request may have succeeded) keeps state and alerts (`notify`) instead of releasing. A compensating unlock must additionally be **capped at the recomputed pending state** (see `unlockBudgetForFailedCreditPurchaseRefund` — the refund webhook consumes pending locks, so an uncapped unlock double-credits; E021).
7. **Advertiser-funded settles always pay the customer in full** (E069 policy, 2026-08-01) — `settleSharePayoutAndUnlockRemainder` draws the lock remainder from `available` past zero; a negative `availableBudgetUsdCents` is the advertiser receivable, netted by their next top-up / PAYG charge. Never reintroduce a cap-at-available on an advertiser settle path. Only the SUBSIDIZED settle keeps a cap (`PLATFORM_BALANCE` — the platform pool has no one to hold a receivable against), and its top-up clamps a negative unassigned Stripe balance at 0 (a customer must never be debited by a settle).

### The saved card, PAYG, and the monthly budget

An advertiser has **ONE saved off-session card** —
`AdvertiserSensitiveData.savedPaymentMethodId` (+ the MIT-mandate consent
stamp `offSessionChargeAuthorizedAt`), linked under a `usage: "off_session"`
SetupIntent — shared by the two features that charge it. Whether each feature
is **on** is tracked by its own period model (`PaygPeriod`,
`MonthlyBudgetPeriod`; each "at most one open per advertiser" via a partial
unique index); a card on file enables neither by itself. Rules:

- **Three billing resources, each exactly read / add / remove** —
  `controllers/v2/advertiserApp/billing/{paymentMethod,payg,monthlyBudget}/`
  (`paymentMethod` add is the two-step PaymentSheet handshake, setup-intent +
  reconcile). Turning a feature on/off never touches the card; removing the
  card turns both features off. The `payg/setupPaygCard` + `removePaygCard`
  controllers and the `/payg/{setup-intent,reconcile,payment-method}` routes
  are `@deprecated` shims for pre-2026-09 builds.
- **Card writes go through `utils/money/savedCard/linkCardFromSetupIntent` /
  `removeSavedCard` only.** `removeSavedCard` is the single card-clearer and
  closes BOTH periods (`CARD_REMOVED`) in the same tx, upholding the
  "period only while a card is on file" invariant that `openPaygPeriod` /
  `openMonthlyBudgetPeriod` enforce on the way in. Turning one feature off
  while keeping the card is `closePaygPeriod` / `closeMonthlyBudgetPeriod`
  with `DISABLED`. A succeeded card-link SetupIntent becomes DB state in ONE
  place, `utils/money/savedCard/linkCardFromSetupIntent` — called by both
  the reconcile endpoint (fast path, polled by the app; `/payg/reconcile`
  and `/payment-method/reconcile` share the handler) and the
  `setup_intent.succeeded` webhook (guaranteed path) — and the intent's
  `purpose` decides the effect: `payg_setup` = card + open a PaygPeriod;
  `card_setup` = card only. Never branch on the purpose anywhere else.
- **Monthly budget = a `CREDIT_PURCHASE` on a schedule.** On the 1st
  (`CHARGE_HOUR_UTC`, 06:00 UTC) the stripe worker charges `target − available` (a negative available —
  the E069 receivable — makes the charge bigger and settles the debt) via the
  ONE off-session charger `chargeAdvertiserCardOffSession` (never forked; a
  caller names its `flow` — `PAYG_SHARE` = `PAYG_CHARGE` + the 30¢ surcharge,
  settle-path-owned; `MONTHLY_BUDGET_TOPUP` = `CREDIT_PURCHASE` + 0,
  worker-reconciled — and passes the per-attempt `attemptRef` that is both
  the Stripe idempotency key and the row's `externalRef`; the row's terminal
  writes go through `offSessionChargeRow.ts`), books it with the same
  `stripe_pi_{id}` ledger ref the
  `payment_intent.succeeded` webhook uses (whichever lands first wins), and
  shares settle from CREDITS exactly as after a manual top-up. Its PI purpose
  is `monthly_budget_topup` — booked like `credit_purchase` (see
  `CREDIT_PURCHASE_PURPOSES`) but the payment-failed webhook leaves the
  notification to the run's own retry ladder.
- **Periods are immutable, and ACTIVATION NEVER CHARGES (2026-09-03).**
  `PUT /monthly-budget` never edits a period: a new target closes the open one
  (`TARGET_CHANGED`) and opens a new one, the same target is a no-op, and the
  period list is the target history. A new period is scheduled for the **next
  1st** at `CHARGE_HOUR_UTC` (`nextMonthlyBudgetRunAt`, always the following
  month — never "the next 1st that hasn't happened yet", so enabling at 05:00
  on the 1st waits a month rather than charging an hour later). The stripe
  worker (`reconcileMonthlyBudgets` → `runMonthlyBudgetTopUp`, under its
  singleton lock) is the ONE writer of monthly charges, and it only ever runs
  on that schedule.
  **This one rule dissolves a whole class of timing bugs**, which is why it is
  worth protecting: no charge can be triggered by a user action, and none can
  land near a UTC month boundary (the retry ladder caps at 24h, putting the
  last possible attempt on the 2nd). Specifically it makes unreachable: a
  target change colliding with an in-flight ambiguous charge (which
  over-collected), and a `PUT` after a `CHARGE_FAILED` pause bypassing
  `MAX_CHARGE_ATTEMPTS` and the backoff by opening a period that charges on
  demand. If activation charging is ever reintroduced, both return — and the
  monthly path would then also need PAYG's pending-charge sweep
  (`recoverPendingPaygCharges` in `settlePaygShare`), which it deliberately
  does not have.
- **Double-charge protection:** the charge identity is
  `monthly-budget:{YYYY-MM}:{periodId}:attempt:{n}:v1` — the `externalRef`
  unique index + Stripe idempotency key on that row (a racing second runner
  hits P2002 → 1342 → defers → its recheck finds the winner's completed row),
  on top of the stripe worker's singleton lock. **The key is persisted on the
  period (`currentAttemptRef`), never recomputed** (2026-09-02): it embeds the
  run's UTC month, so an ambiguous outcome (1342) whose recheck lands after a
  month rollover would otherwise recompute a different key, miss the
  maybe-collected charge and place a second. Nor can that be fixed by dropping
  the month from the lookup — `chargeAttempts` resets monthly, so
  `(periodId, attempt)` also matches LAST month's charge and a month-blind
  check would skip a real charge every other month. The invariant is: **mint
  once, reuse while the attempt is unresolved, clear on every terminal outcome**
  (`completeMonth` and both `handleDecline` branches clear it; the two deferral
  paths — 1342 and a post-charge booking failure — deliberately keep it). 1337/1342 are handled exactly as in
  `settlePaygShare` (ambiguous = no attempt consumed, key kept). `nextRunAt`
  is the single scheduling truth and every outcome moves it forward.
- **Each ladder closes only its own period (decision 2026-09-01).** A charge
  declining past `MAX_CHARGE_ATTEMPTS` closes the period of the feature that
  was charging — never the other one, even though both charge the same card.
  PAYG closes on its first decline, the monthly budget at its max; each
  discovers a bad card from its own next charge. Cross-closing was considered
  and rejected as inconsistent (and the two features are rarely on together).
  Only card removal (`removeSavedCard`) ever closes both.
- **The monthly budget does NOT grant visibility.** `businessAccessibleSql`
  counts an open _PAYG_ period because PAYG funds a share on the spot; an open
  monthly-budget period can't (at $0 on the 20th there's nothing to pay
  with). Don't add it there.
- Status derivations live once: `utils/hydrators/billing/derivePaygStatus` (a card with
  PAYG off is `NOT_LINKED`; `CARD_FAILED` needs `lastEndedReason`) and
  `utils/hydrators/billing/deriveMonthlyBudgetStatus`.
- **User-facing name: "Monthly top-up" / CS "Měsíční dobíjení" (2026-09-02).** All
  copy — app strings, the notification templates in `transactionalCatalog.ts`, the
  catalog labels in `@tagly/models` `notificationEventsCatalog`, admin labels — says
  top-up/dobíjení, never "monthly budget"/"měsíční rozpočet" (it collided with the
  generic budget concept and read too close to PAYG's "Průběžné platby").
  `monthlyBudget`/`MonthlyBudgetPeriod` and the `/monthly-budget` routes stay the
  frozen internal + wire identifiers.

### Share Funding Mode & the Subsidized Invariant

Every share is stamped at creation with an **immutable** `fundingModeAtCreation` (`CREDITS | PAYG | SUBSIDIZED`), derived at creation from whether the local had an open `SubsidizationPeriod` (→ `SUBSIDIZED`), else whether the advertiser's available budget covers the full 1.5× lock (→ `CREDITS`), else whether the advertiser has an open `PaygPeriod` + card on file (→ `PAYG`), else whether any available budget > 0 exists (→ `CREDITS` with a **partial lock**: at admin approval the lock is capped at the then-available budget; settlement pays the customer in full regardless, drawing available negative past the lock — the advertiser receivable, netted by their next top-up). This is the **canonical per-share signal** — read it instead of re-deriving from the period or from `advertiserId`.

**A share is subsidized if and only if `fundingModeAtCreation === "SUBSIDIZED"`.** The `SubsidizationPeriod` overlap (`startedAt <= createdAt AND (endedAt IS NULL OR endedAt >= createdAt)`) remains the _definition_ and is how the value is derived **at creation** — but every per-share check afterwards (settlement, admin, hydration) must read the stored field:

```typescript
// ✅ CORRECT — the immutable signal stamped at creation
const wasSubsidized = share.fundingModeAtCreation === "SUBSIDIZED";

// ❌ WRONG — advertiserId is not a subsidization signal
const isSubsidized = share.advertiserId === null;
```

`share.advertiserId` is still NOT a reliable signal (it's set on subsidized shares after `adminSetLocalAdvertiser`, and nulled on advertiser deletion). For DB-level queries filter on `funding_mode_at_creation = 'SUBSIDIZED'` (see `adminGetUnratedShares.ts`). The one legitimate ledger-derived exception remains the maintenance worker's stuck platform budget recovery (`SUM(delta_platform_locked_cents) > 0` — only subsidized share locks ever write that column).

**Funding-mode lifecycle invariant (creation → settlement):**

- `SUBSIDIZED` at creation → **must** settle subsidized (platform pays). Never changes.
- `CREDITS` at creation → **must** settle from credits (advertiser budget). Never changes. The customer is always paid in full: when lock + available can't cover the final price, `available` goes **negative** (a receivable netted by the advertiser's next top-up) — E069 policy, 2026-08-01.
- `PAYG` at creation → settles via `settlePaygShare`, and the **actual money source can differ** from the card: if available/promo credits already cover the final price the card isn't touched (settles from available), and if the card was removed while the share was in-flight the customer is still **paid in full** while the advertiser's available balance goes **negative** (an uncollectable receivable). In-flight PAYG shares are **never** converted to locked-credit shares — they stay lock-less; card removal (`removePaygPaymentMethod`) closes the period but leaves the shares as-is. So only `PAYG`'s settlement source is variable; `SUBSIDIZED` and `CREDITS` are immutable across the lifecycle. (`fundingModeAtCreation` itself never changes — it's the _money source at settlement_ that varies.)

The **actual** funding source at settlement is deliberately **not** denormalized onto the share — derive it from the ledger when needed (the `SHARE_PAYMENT` deltas: platform-funded ⇒ subsidized, advertiser-debited ⇒ credits; a `PAYG_CHARGE` event ⇒ card-funded). The ledger stays the single source of truth for how money moved.

## Database Index Validation

For frequently-executed queries, verify `prisma/schema.prisma` has appropriate indexes:

```typescript
// Query in controller
await prisma.share.findMany({
  where: { customerId, status: "PAID" },
  orderBy: { createdAt: "desc" },
});

// Needs indexes in schema.prisma
@@index([customerId, status])
@@index([customerId, createdAt])
```

**Common index patterns:**

- Ownership: `@@index([advertiserId])`, `@@index([customerId])`
- Status filters: `@@index([status, createdAt])`
- UID lookups: `@@index([uid])`
- Composite: `@@index([advertiserId, status])`
- Geospatial: `@@index([location], type: Gist)`

## Worker Architecture

Background workers live under `src/workers/` (flat, single-version; the entrypoint runs `dist/workers/<name>/run.js`):

- `notifications/` - Push notification delivery
- `igInsights/` - Instagram metrics sync
- `igSnapshot/` - Instagram content snapshots
- `sharePayment/` - Share payout processing
- `stripe/` - Credit purchase + withdrawal reconciliation, and the **monthly-budget top-ups** (phase 3 of its tick: `helpers/reconcileMonthlyBudgets.ts` runs every open `MonthlyBudgetPeriod` whose `nextRunAt` has passed through `runMonthlyBudgetTopUp`). It charges and nothing else — the 3-day upcoming-charge notice moves no money and lives in `maintenance/`
- `maintenance/` - Nudges + queue health monitoring, plus the monthly top-up's 3-day upcoming-charge notice (`tasks/scheduleMonthlyBudgetNotices.ts`)
- `cleanup/` - Database + S3 cleanup (expired OTPs, orphaned rows/objects)

Each worker folder is a single `run.ts` (the `run*Worker()` logic **plus** a self-executing process entry at the bottom) alongside a `helpers/` dir. There is no separate launcher file — `ops/entrypoint.sh` maps `$WORKER` straight to the folder's `run.js`.

### The `runtime/` framework — build every worker on it, never hand-roll a loop

`workers/runtime/` centralizes the loop machinery. **No worker contains its own
`while` loop, SIGTERM handler, retry block, claim CAS, or `console.*` call.**
Domain-poll workers (cleanup, maintenance, stripe, sharePayment) use
`runWorkerLoop` (graceful shutdown, idle pacing, error backoff, optional
advisory-lock singleton, process crash handlers); queue workers (igInsights,
igSnapshot, notifications) use `runJobQueue` on top (claim → execute → markDone,
jittered exp-backoff retries, `DeferJob` for "not now, later", terminal-failure
hook). Log via `workerLogger(name)`, never `console.*`. Fail a job terminally with
`createCustomError(code, msg, { permanent: true })` (8xxx code block; add
`expected: true` to mute a benign terminal) — plain throws are retryable by
default. Tunables live in `constants/workers/<WORKER>.ts` and must
`satisfies WorkerLoopTunables` / `JobQueueTunables`.

Framework internals, the igSnapshot **audience-location source** rules (either/or
stamp on every snapshot, CZ geocoding special-case):
[docs/backend/WORKERS.md](../docs/backend/WORKERS.md).

**Share Processing:**
For detailed documentation on how shares flow through the system (creation → insights → snapshot → payment), see [SHARE_LIFECYCLE.md](../docs/SHARE_LIFECYCLE.md).

## Webhook Patterns

**The dispatcher catch must rethrow `CustomError`s INTACT (E031).** Every money-integrity throw inside a webhook handler carries `notify`/`notifyKey` (the deduped team-alert escalation) and a specific domain code — replacing it with a synthetic wrapper error kills the alert and anonymizes the PostHog capture. Both Stripe dispatchers do `if (isCustomError(err)) throw err;` and wrap only unknown throws (1312 + `cause`). Follow that shape in any new external-caller webhook.

**Chargebacks:** the platform dispatcher routes `charge.dispute.created`/`charge.dispute.closed` to `webhookHandlers/platform/handleDisputeEvent.ts` (E066) — alert on open, book the clawback through `refundAdvertiserCreditPurchase` (`stripe_dispute_{id}`, advertiser may go negative) on loss; the dispute fee stays a platform cost. ⚠️ The handler is inert until both events are subscribed on the Stripe platform endpoint of each environment. **Both events are subscribed in BOTH environments as of 2026-08-10** — staging verified by reading `enabled_events` on the TEST-mode platform endpoint (`https://staging.api.tagly.dev/webhooks/stripe/platform`), production confirmed by Matej from the live dashboard. The handler is therefore live everywhere and this is no longer a gap. Still untested is the handler's _behaviour_ (alert on open, clawback on loss) — that needs a real dispute, e.g. Stripe's `4000 0000 0000 0259` test card. If a webhook endpoint is ever recreated, re-check both events: without them a lost chargeback is silently never clawed back.

**Stripe webhooks require signature verification:**

```typescript
// Route setup - use express.raw() for webhooks
r.post(
  "/stripe/connect",
  express.raw({ type: "application/json" }),
  stripeConnectWebhook,
);

// Controller
export const stripeConnectWebhook: RequestHandler = asyncHandler(
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        envVariables.STRIPE_CONNECT_WEBHOOK_SECRET,
      );
    } catch (err) {
      throw createCustomError(4001, "Invalid signature", 400);
    }

    // Handle event with idempotency (check if already processed)
    const existing = await prisma.webhookEvent.findFirst({
      where: { externalId: event.id },
    });
    if (existing) {
      res.status(200).json({ received: true });
      return;
    }

    // Process event...
    await prisma.webhookEvent.create({
      data: { externalId: event.id, type: event.type },
    });

    res.status(200).json({ received: true });
  },
);
```

## HTTP Status Codes

| Status | Usage                               |
| ------ | ----------------------------------- |
| `200`  | GET/PUT/PATCH success               |
| `201`  | POST creation success               |
| `204`  | DELETE with no content              |
| `304`  | Cache hit (ETag)                    |
| `400`  | Validation error                    |
| `401`  | Authentication error                |
| `403`  | Authorization error                 |
| `404`  | Not found                           |
| `409`  | Conflict (duplicate, invalid state) |
| `429`  | Rate limited                        |

## Boot-time catalog seeders (verticals + notifications) — deploy/rollback sharp edges

`app.ts` runs `seedNotifications()` + `seedVerticals()` on every instance boot.
Two standing gotchas (E341 + E196; full detail in
[docs/backend/WORKERS.md](../docs/backend/WORKERS.md)):

- **Adding a catalog row (vertical / advertiser type / interest) arms a rollback
  crash-loop one image back** — older images die at boot on the DB→catalog orphan
  check, so rolling back past that deploy needs the new row deleted first.
- **Removing a notification event slug destroys opt-out state on remove+re-add** —
  treat event-slug removals as permanent and never reuse a retired slug
  (soft-retire via `NotificationEvent.status = INACTIVE` if ever needed).

## Notifications

> Full pipeline architecture + invariants (opt-out prefs, resolution rule,
> consent, escaping, send budgeting, retries):
> [docs/TRANSACTIONAL_NOTIFICATIONS.md](../docs/TRANSACTIONAL_NOTIFICATIONS.md).
> This section is the day-to-day rulebook.

**The sender is `utils/queue/queueNotificationJobs.ts`** — one call, one
audience (`customerIds` XOR `advertiserIds` + a matching event slug). It resolves
per-recipient channel prefs (mandatory channels always send), writes
`NotificationQueue` rows, and **never throws** (failures are reported to PostHog and
return `0`), so call sites `await` it without a `.catch`.

**Two queueing modes:**

```typescript
// 1) DEFAULT — queue AFTER the transaction commits (best-effort side effect):
await prisma.$transaction(async (tx) => { /* the main work */ });
await queueNotificationJobs({
  customerIds: [customerId],
  eventSlug: "c.shares.rejected",
  payload: { shareUid },
  dedupeKey: `share-rejected-${shareId}`,
});

// 2) OUTBOX — pass `tx` when the notification must be atomic with a state
// change (rollback erases the queue row; the worker only sees it post-commit).
// Used by `markShareUnpayableAndUnlock` and `handleTransferReversed`.
await queueNotificationJobs({ ..., tx });
```

**Rules:**

- Always provide a `dedupeKey` — the queue's unique constraint absorbs retries.
  Day-bucketed keys (`...-${YYYY-MM-DD}`) cap potentially-bursty events at one per
  recipient per day (share-unpayable, multiplier-updated, business ban).
- Slugs + display metadata live in the shared catalog
  (`@tagly/models` `notificationEventsCatalog`); push/email render templates (en+cs)
  in `constants/catalogs/notifications/transactionalCatalog.ts`. Adding an
  event = both files, **nothing else** — preferences are **opt-OUT**
  (`NotificationEventOptOut`, one merged customer+advertiser table on the PushToken
  pattern): a missing row means every available channel is on, so a newly seeded
  event is on-by-default for every existing account with no backfill, no version
  stamp, and no per-account seeding at registration (the old
  `NOTIFICATION_CATALOG_UPDATED_AT` + `ensureNotificationDefaults` +
  `backfillNotificationDefaults` machinery is gone; E011). Channel resolution has
  ONE rule, `utils/notifications/resolveEffectiveChannels.ts`
  ((mandatory ∩ available) ∪ (requested ∩ available − disabled), no IN_APP), shared
  by `queueNotificationJobs` and the worker's
  `isChannelEnabledForRecipient` — never re-inline it. The startup seeder
  enforces slug↔template completeness, prunes DB events whose slug was removed
  (opt-out rows cascade with them), and prunes SCHEDULED queue rows for slugs no
  longer in any catalog. Removing an event therefore needs NO manual migration: the
  seeder cleans the DB, the settings endpoints stop listing it, and
  `updateNotificationPreferences` rejects its stale eventId. `NotificationEventOptOut`
  is the only preference storage (the legacy opt-in tables were dropped at the v1
  cutover).
- **Advertiser visibility transitions are NEVER notified at call sites.** The
  maintenance worker's `reconcileAdvertiserVisibility` task diffs the canonical
  accessibility rule against `Advertiser.lastKnownVisible` (CAS-claimed, cause
  ladder, daily dedupe) and owns the single two-way slug
  `a.account.visibility-change` (payload `{visible, cause?}` — the template
  branches copy and the mandatory email surfaces the reason). Don't reintroduce
  visible/hidden edge detection in controllers or the ledger helper — any new
  path that flips visibility is covered automatically. The one sanctioned
  ledger-side band check is `a.reminders.low-balance` ("ending soon, top up" —
  same constants as the customer `isLowBudget` pill), which fires at the exact
  debit that enters the warning band; that band only moves via ledger events,
  so the chokepoint is complete for it.
- **Admin blasts** (`POST /v2/admin/notifications/blast`, SUPER-only; revived
  2026-08-13) queue NotificationQueue rows directly with payload-driven,
  per-language content (`{ en, cs? }`, CS falls back to EN) rendered by
  `adminCatalog.ts` — audience filtering (promo opted-in vs everyone) happens
  at queue time in the controller, and the worker's promo/preference gates are
  skipped for `notificationType: "admin"`. Every blast email is bulk mail
  (marketing "ink masthead" template + one-click unsubscribe — the link opts
  out of promo mail only), and an optional `senderDomain` override (verified
  live
  against `resend.domains.list()` before queueing) sends from
  `notifications@<domain>`. Per-blast tracking: push payload slug
  `admin.blast:<blast slug>` (PostHog `push_opened`) + the email
  `blast` Resend tag. Full mechanics:
  [docs/TRANSACTIONAL_NOTIFICATIONS.md](../docs/TRANSACTIONAL_NOTIFICATIONS.md)
  §Admin blasts.
- **Account-deletion confirmations are direct `sendEmail` calls**, not queue jobs —
  the recipient row (and prefs) are deleted in the same transaction, so the queue
  could never resolve them.
- **Null consent is never promo consent (E056).** `promoNotificationsEnabled` is
  nullable on both pending tables (null = the consent step was never answered).
  Every promo gate requires an explicit `true` — the scheduler where-clauses,
  `queuePromoNotificationJobsOrReturn`'s `optedOut` (`!== true`), and the
  send-time `mayReceivePromo` (`=== true`). Three layers of one rule; never
  loosen any of them individually.
- **Escape payload values in catalog `html()` bodies (E055).** Anything from a
  payload that lands in email HTML goes through `escapeEmailHtml`. Do NOT
  escape push bodies/subjects/preheaders (plain-text contexts; preheaders are
  escaped downstream in `renderEmailShell`).
- **Worker email sends are budgeted below the Resend account limit (E057)** —
  the email leg awaits `acquireEmailSendBudget()`; OTP mail stays inline and
  deliberately bypasses the budget (never enqueue OTPs). ⚠️ The send-time
  quiet-hours re-snap must NEVER pass `spreadInWindow` (it would defer every
  in-window send forever). Details: [docs/backend/EMAIL.md](../docs/backend/EMAIL.md).
- **Promo delivery, retries, and Resend invariants:** occurrence-scoped
  `PromoNotificationLog`, send-time re-checks (skip vs `DeferJob`), the 8-attempt
  backoff + PostHog dead-letter alerting (never `notify`), and the env-tag
  invariant (E104 — never remove the `env` tag from `sendEmail`; any future Resend
  webhook must filter strict match-only on it). Details:
  [docs/backend/EMAIL.md](../docs/backend/EMAIL.md).

### Email templates — two looks, one chrome

`sendEmail` wraps every product email in `buildTransactionalEmailHTML` ("the
note" — the default) or `buildMarketingEmailHTML` ("the ink masthead" — promo
sends only; when `template` isn't passed it's derived from `unsubscribeUrl`).
**Every send is multipart** — `sendEmail` always passes a `text` part from
`buildPlainTextEmail` (HTML-only mail is a spam-score penalty at iCloud and
friends); its chrome is imported from the HTML renderers, never restated, so the
two parts can't drift. Shared parts: `renderEmailShell` / `renderEmailFooter` / `renderEmailButton`
(takes `app: "customer" | "advertiser"`, NOT a URL — email CTAs only ever open
the recipient's app) / `escapeEmailHtml`; every color/link/asset comes from
`constants/platform/EMAIL_BRAND.ts`, and money figures use
`EMAIL_BRAND.COLOR.SUCCESS`. Catalog emails get their CTA via `showCta: true`
(one email, one action — never on security/legal/ban mail, never combined with a
direct `renderEmailButton` in the same `html()`). Pass `lang` wherever the
recipient's language is known. Full template anatomy, hosted-asset provenance,
and the tagly-redirect `/open` deploy-order warning:
[docs/backend/EMAIL.md](../docs/backend/EMAIL.md).

## Documentation Requirements

Every controller must have a docblock describing what it does, its flow, and any non-obvious invariants. **Update the docblock whenever you change the controller's behavior** — a stale docblock is worse than none.

Add inline comments for:

- Complex queries with multiple conditions
- Business logic that isn't obvious from variable names
- Race condition handling or atomic operations
- Error codes and why specific codes are used

## Client Compatibility

**Convention — deployed endpoints are frozen contracts (append-only).** Once an endpoint ships, treat its behaviour and schema as immutable. You may add **backwards-compatible** extensions in place (a new _optional_ request field handled gracefully when absent; a new response field old clients ignore), but you may **never** change what an endpoint does or break its shape. Any behaviour-changing or breaking change is a **new endpoint**, with the live one left untouched. The only in-place behaviour change is a genuine **bugfix** — and only after confirming no client relies on the buggy behaviour. This takes the "is this change safe?" judgment out of every PR: **deployed = don't touch its contract.** (Deprecated endpoints accumulate; they're garbage-collected by the periodic forced cutover that raises the min-version gate and then deletes the dead batch — see the cutover recipe in the Lifecycle section above.)

**Old clients must always keep working.** Mobile app users cannot be force-updated _for routine changes_ — old builds are in the wild for weeks after a release. Never modify an existing endpoint in a way that breaks them. (The deliberate exception is a major **forced cutover** — raising the min-version gate so old builds hit the update wall — which is reserved for releases like the v2 migration, not day-to-day work.)

**What counts as a breaking change:**

- Removing a field from a request or response schema
- Renaming a JSON field (old clients still send/expect the old name — rename only the internal Prisma field/variable if needed, keep the wire name)
- Changing the type of a field
- Removing or renaming an endpoint or changing its HTTP method

**If a breaking change is genuinely needed:** create a new endpoint (e.g. `/v2/...`) and keep the old one working. Do not modify the existing one.

**Safe changes:**

- Adding new optional fields to responses (old clients ignore unknown fields)
- Adding new optional request fields the backend handles gracefully when absent

### To STOP returning a field, null it — don't delete it

When you need a response field to stop carrying data (a privacy fix, a removed
feature), check how the **shipped** DTO declares it before touching the query.
A field declared `z.…().nullable()` is still **required**: Zod accepts `null`
but rejects the key being _absent_. So dropping it from the `select` changes a
value the old client tolerates into a shape it does not.

**Emit `null` and keep the key.** Tag it `@deprecated` with the removal trigger,
and delete the field together with its DTO at the next cutover, once no old build
is left. (The v1 `hydrateShareAdvertiserOwnerDetails` `customer: null` shim was the
worked example — the customer's uid stopped reaching advertisers without changing
the shipped wire shape; it was purged with v1.)

> ⚠️ **Don't lean on the SDK's leniency.** `shared/sdk/src/client/request.ts`
> currently treats a failed **response** schema check as non-blocking — it warns
> and passes the raw data through — so a missing field degrades instead of
> erroring today. That is an implementation detail of one SDK version already
> compiled into shipped bundles, not a contract. Write server changes so they
> satisfy the old schema on their own.

### Exception: admin endpoints (`/v2/admin/*`)

`tagly-admin` deploys in lockstep with the backend (single source, no app-store distribution), so admin endpoints + DTOs in `tagly-shared/models/src/{dtos,endpoints}/v2/adminApp/` are **not** bound by client back-compat. Drop deprecated fields outright when renaming; don't keep dual-write aliases on admin hydrators. See [tagly-admin/CLAUDE.md](../tagly-admin/CLAUDE.md#no-back-compat-for-admin-endpoints--dtos).

This exception applies _only_ to admin-scoped DTOs. Anything under `customerApp/`, `advertiserApp/`, or `crossApp/` still needs the full back-compat treatment (deprecated aliases, dual-writes, etc.).

**When modifying backend endpoints, keep SDK and Models in sync:**

1. **Update schemas** - If request/response changes, update `tagly-shared/models/src/endpoints/`
2. **Update SDK** - If path, method, or params change, update `tagly-shared/sdk/src/endpoints/`
3. **Rebuild models** - Run `yarn build` in `tagly-shared/models` (SDK doesn't need building)
4. **Test clients** - Verify mobile apps and `tagly-admin` still work

**Which apps to validate:**

| Endpoint Location               | Apps to Validate                    |
| ------------------------------- | ----------------------------------- |
| `controllers/v2/customerApp/`   | `tagly-customer/`                   |
| `controllers/v2/advertiserApp/` | `tagly-advertiser/`, `tagly-admin/` |
| `controllers/v2/crossApp/`      | All client apps                     |
| `controllers/v2/adminApp/`      | `tagly-admin/`                      |

## Common Anti-Patterns

Each covered in its section above — the recurring review catches: raw `req.body`
access (use `req.validatedBody`), a missing ownership filter (IDOR), a non-atomic
find-then-update state change (use an `updateMany` CAS claim), and missing
S3/pending cleanup on the failure path. One client-side sibling to remember when
touching app code: reset loading flags on every exit path (`try/finally`).

See [README.md](README.md) for commands.
