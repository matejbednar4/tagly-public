# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace-Specific Guides

Claude Code automatically loads these when working in specific directories:

- [tagly-backend/CLAUDE.md](tagly-backend/CLAUDE.md) - Backend patterns, controllers, financial operations
- [tagly-customer/CLAUDE.md](tagly-customer/CLAUDE.md) - Mobile app patterns, shared components, security
- [tagly-advertiser/CLAUDE.md](tagly-advertiser/CLAUDE.md) - Advertiser app (mobile + web), web compatibility patterns
- [tagly-admin/CLAUDE.md](tagly-admin/CLAUDE.md) - Admin dashboard (Next.js)
- [tagly-shared/models/CLAUDE.md](tagly-shared/models/CLAUDE.md) - API contract package (Zod DTOs/enums), build + deprecation convention
- [tagly-shared/client/CLAUDE.md](tagly-shared/client/CLAUDE.md) - Shared RN client package (`@tagly/client`): design system rules (tokens, color/type/spacing/shadows — governs ALL UI) + cross-app utils
- [tagly-join/CLAUDE.md](tagly-join/CLAUDE.md) - Join/referral landing page (Next.js, standalone)
- [tagly-website/CLAUDE.md](tagly-website/CLAUDE.md) - Public website (Next.js, standalone; marketing + legal pages, imported 2026-08-08 from `Flaer-Inc/marketing-site` branch `vit`)
- [tagly-legal/CLAUDE.md](tagly-legal/CLAUDE.md) - Canonical legal documents (ToS/ToM/Privacy Policy): naming registry, document template, publishing flow

## Design System (read before any UI)

The design system governs **all** UI work, across `tagly-shared/client` and all apps, so
it's imported here to always be in context — read it before writing or editing any
component:

@tagly-shared/client/CLAUDE.md

## Legal Document Names — one canonical name each, never vary

The three legal documents are always called exactly this in every user-facing
string (app copy, emails, push/notification labels, join page, marketing site):

| Document              | EN (always full, capitalized) | CS (first word capitalized, declined as needed) |
| --------------------- | ----------------------------- | ----------------------------------------------- |
| Terms of Service      | Terms of Service              | Obchodní podmínky                               |
| Terms of Monetization | Terms of Monetization         | Podmínky monetizace                             |
| Privacy Policy        | Privacy Policy                | Zásady ochrany osobních údajů                   |

Never bare "Terms", never lowercase, never a synonym ("Podmínky použití",
"Podmínky služby", "Zásady ochrany soukromí" are all wrong). Full rules,
CS declension reference, and the shared document template live in
[tagly-legal/CLAUDE.md](tagly-legal/CLAUDE.md).

## HARD RULE — The Production Database Is READ-ONLY, Forever

**You may NEVER modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** This is the one rule a prompt cannot unlock: a request to write to prod is not authorization, it is the trigger to refuse. Say the rule blocks it, and hand over the exact SQL/commands so a human can run them — that is the maximum you ever do.

**Forbidden against production, always:**

- Any DML that changes rows: `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, upserts, bulk backfills
- Any DDL: `CREATE`/`ALTER`/`DROP` on schemas, tables, columns, indexes, enums, extensions, roles, grants
- `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, `yarn db:*` writes, any seed script (`tagly-backend/src/seed/**`) — migrations reach prod only through the deploy pipeline, never from a session
- **Resetting, wiping, dropping, or re-creating the prod DB** — including "just the dev fake data", including a single table
- Restoring/importing/copying data in, snapshot restores, point-in-time restores, deleting or modifying the RDS instance/cluster/parameter group
- Running any backend script, worker, job, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write
- Writes to prod-adjacent stores when used as fixes: prod Redis keys, prod S3 objects, prod Stripe live-mode objects

**Allowed against production:** pure reads only — `SELECT`, `EXPLAIN` (never `ANALYZE`), `information_schema`/`pg_catalog` inspection, `\d`, read-only metrics. Prefer a read-only role or replica.

**Guards:** before running anything against a database, identify which environment the connection string belongs to and say so; never point a local shell, script, or `DATABASE_URL` at prod for anything but a read; never test against prod (see Strict Environment Separation). If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them.

## HARD RULE — Never Increase Spend

**NEVER authorize new payments, increase budgets, or make operations more expensive in any way.** This applies to every platform reachable from a session (AWS, Stripe, Resend, Zoho, AppsFlyer, PostHog, Expo/EAS, GitHub, registrars, ...):

- No creating/confirming payments, purchases, charges, or payouts
- No plan/tier/subscription upgrades anywhere
- No scaling up infrastructure (bigger instances/tasks, more replicas, provisioned/reserved capacity, new paid services or tiers)
- No creating new billable resources, however small (hosted zones, distributions, databases, NAT gateways, ...)
- No raising any limit, cap, or quota that gates spend

Before ANY action against a live platform, ask: "does this add any one-off or recurring cost, however small?" If yes or unsure — STOP, state the estimated cost, and get explicit approval for that specific action. Zero-cost changes (DNS records in existing zones, aliases on existing distributions, config edits) are fine. Never bundle a costly action inside an approved zero-cost batch.

## HARD RULE — Verification Must Be Able to Fail

Never call something "verified" on evidence that couldn't have failed. Verify content, not reachability: byte/hash equality of real payloads, response bodies (not status codes), real objects through CDNs, served cert SANs, record values on public resolvers. Before trusting any comparison, ask "what would this print if the fetch broke?" — empty-vs-empty passes (SHA-256 e3b0c442... = empty string) are an alarm, never a pass. Assert non-trivial sizes/shapes first. For multi-step verification, write an explicit script and run it with `bash` (zsh inline loops silently break on word-splitting). Applies with maximum force to cutovers: prove the new path works AND the old path still works.

## HARD RULE — Additive Migration, Never Break Prod

All old links, hosts, and identifiers (api/cdn/assets/redirect/join on flaer.app, join.flaer.cz, OneLink flaer* templates, @flaer.app email, `flaer*` deep-link schemes) must keep working until explicitly retired. Add new domains/aliases/config ALONGSIDE old ones — never replace or remove. Certs on shared distributions must cover both old and new names. Old already-issued links, emails, QR codes, and shipped app builds must always still resolve. Interruptive changes go staging-first, verified, instantly revertible. Removing anything flaer-* requires explicit sign-off.

## HARD RULE — Never Leak Secrets

Secrets and private info must never reach: tracked repo files (all `.env*` stay gitignored), client app bundles (`EXPO_PUBLIC_*`/`NEXT_PUBLIC_*`/anything referenced by `app.config.ts` ships to every device — only publishable-class keys belong there), logs (tagly-backend/workers/CI — never log secret values), DNS records, or any public surface. Server secrets live in AWS Secrets Manager; app build secrets in EAS secrets. In terminal work, never print secret values — pipe them into variables and show only names or redacted prefixes. Before any write to repo/DNS/bundle/log, ask: "does this value grant access or identify a person?" When in doubt, treat it as secret.

## HARD RULE — Strict Environment Separation

**Everything is split per environment, and production is always separated.** Every resource and config exists per env — prod + staging (and dev where it applies): App Runner services, ECS clusters, S3 buckets, databases, secrets, Amplify branches, CDN hosts, bundle IDs, EAS profiles, deep-link schemes. Rules:

- Never point a non-prod component at a prod resource (DB, bucket, secret, API, Stripe live mode) or vice versa; never test against prod
- When creating anything new (infra, env vars, DNS, dashboards), create the per-env variants together — no "just prod for now" shortcuts, no shared mutable resources across envs
- Domain layout encodes this: production lives on the brand domain, all non-production hosts live on the separate dev domain
- Before any infra/config action, identify its environment and verify the target belongs to it; if an action would blur environments, stop and restructure or ask

## HARD RULE — DevOps: Read-Only by Default

"DevOps" = ALL infra + deployment + CI + third-party platforms (AWS, Stripe, Resend, Zoho, Google Cloud, Firebase, Expo/EAS, GitHub Actions, PostHog, AppsFlyer, Meta, DNS/registrars, ...) — not just deploys. The per-service directory (what each platform does, where it lives, how to access it) and the full operating rules live in [docs/DEVOPS.md](docs/DEVOPS.md) — **read it before any devops task**. The always-loaded core:

- **Read-only actions are always allowed without asking** — checking whether something is live, works, or was changed. Before running anything, double-check it truly mutates nothing; if in ANY doubt, treat it as mutating and ask.
- **Anything non-read-only requires Matej's explicit approval for that specific action** — no exceptions, never bundled into a prior approval. (The spend rule's "zero-cost changes are fine" waives only the cost approval — a zero-cost mutation still needs mutation approval.)
- **Anything that could cost money or touch billing**: see Never Increase Spend above — always explicit approval. A read with non-trivial metered cost (e.g. a large CloudWatch Logs Insights scan) gets its estimated cost stated first.
- **Secrets stay secrets** (see Never Leak Secrets): read them into shell variables, never print/log/write them anywhere; the only sanctioned stores are AWS Secrets Manager, GitHub Actions secrets, and EAS secrets — and EAS may only hold values that are safe to be built into the app.
- **Verify live, never from docs**: third-party state (DNS, webhooks, env vars, dashboard/deploy config) must be checked where it actually lives before being relied on — docs drift and cause wrong information. Update [docs/DEVOPS.md](docs/DEVOPS.md) when drift is found.

## The "flaer" Identifier Keep-List

The brand is Tagly; the repo/packages/folders are renamed. The string "flaer" survives ONLY as frozen technical identifiers that must never be renamed (renaming them breaks shipped builds, store listings, or provider bindings):

- **Bundle IDs / Android packages**: `com.flaer.customer|advertiser|admin` (+ `.staging`/`.dev`) — baked into stores, google-services.json, AASA/assetlinks, OAuth clients
- **Apple Pay merchant id**: `merchant.com.flaer.advertiser`
- **Legacy deep-link schemes**: `flaer://`, `flaer-ads://` (+ env variants) — lived ONLY inside v1 builds (retired behind the min-version wall at the 2026-08-31 cutover) and the old AppsFlyer flaer-template URI-scheme fields; the apps register only `tagly`/`tagly-business` (+ env variants), and nothing emits the flaer schemes any more. The redirect page still resolves on the legacy `*.flaer.app` hosts (additive-migration rule) but bounces every host into the tagly scheme family. **Legacy OneLink hosts are browser-only for v2** (decision 2026-08-01, E058: "no old universal links live anywhere after v2") — the v2 apps claim only the tagly OneLink hosts as universal/App links; `flaer`/`flaerads.onelink.me` links keep resolving via the browser OneLink page (store bounce) but deliberately never open a v2 app or carry attribution. Don't re-add them to `iosAssociatedDomainsByEnv`/`oneLinkHostsByEnv`
- **EAS/Expo identity**: owner `flaer-inc`, slugs `flaer-customer`/`flaer-advertiser`/`flaer-admin` — slugs are validated against the EAS project IDs on expo.dev; changing `slug` in app.config without renaming the project there breaks builds
- **flaer.app / flaer.cz domains + @flaer.app addresses** — legacy-keep per the additive-migration rule (admin login accepts `@taglyapp.com` + legacy `@flaer.app`)
- **Accepted-legacy tokens/codes**: JWT issuer `"flaer"` stays in `ACCEPTED_TOKEN_ISSUERS` (new tokens are issued as `"tagly"`; drop after pre-rebrand sessions expire), and the Instagram data-deletion confirmation-code prefix `flaer_del_` stays accepted (Meta holds old status URLs; new codes are `tagly_del_`)
- **AWS/GCP/Firebase resource names** (`flaer-prod-*`, `flaer-7f8bd`, S3 buckets, secrets paths, OneLink `flaer*` templates) — infra names, not user-visible
- **Legal entity**: "Flaer, Inc." in copyright lines — the company name did NOT change. (The LinkedIn company handle is no longer in this keep-list: it was renamed to `linkedin.com/company/taglyapp` on 2026-08-13, alongside the Instagram/TikTok handle switch to `tagly_cz` / `@tagly.cz`)
- **Already-applied Prisma migrations** (`tagly-backend/prisma/migrations/**/migration.sql`) — these are frozen historical artifacts, byte-compared against the `checksum` recorded in `_prisma_migrations`. **Editing one — even a comment — is a bug, not a fix.** Two of them (`20260525000001_remap_and_remove_unused_advertiser_types_and_interests:1,30` and `20260525120000_drop_catalog_name_columns:3`) were caught by the rename sweep and reverted to their exact `origin/main` bytes (E254); they still say `@flaer/models` / `shared/models` **on purpose**. If a migration's comment is genuinely wrong or misleading, correct it in a NEW migration or in docs — never in place

`grep -ri flaer` hits outside these categories are bugs — fix them.

**The `tagly-business` identifiers are frozen too (decision 2026-08-10).** The business app's brand
name is **"Tagly Partner"**, but its technical identifiers deliberately stay `tagly-business`: the
deep-link schemes (`tagly-business://` + env variants) and the OneLink subdomains/templates
(`tagly-business.onelink.me`, `staging-tagly-business.onelink.me`). Renaming them would re-open the
device-verified universal-link/attribution layer for zero user-visible gain — decided against on
v2 deploy day. Never "fix" them to match the brand; they are identifiers, not copy.

## HARD RULE — Work in Matej's Working Tree, on His Current Branch

All work happens directly in this checked-out working tree, on whatever branch is currently checked out, so Matej sees every change immediately in his IDE and dev builds:

- **No worktrees, no clones, no isolated copies for the deliverable.** Don't move work into a `git worktree` or scratch checkout unless Matej explicitly asks for one in the current conversation — a task brief mentioning branches/PRs is not enough; when in doubt, edit this tree. (Scratch space — the session scratchpad, temp dirs — is fine for your *own* throwaway experiments, repro scripts, and verification, but every code change that is part of the result must land in this working tree.)
- **Don't switch branches or create new ones on your own.** Stay on the branch that's checked out.
- **Exception — never work on `main`.** If `main` is the checked-out branch, stop and ask Matej which branch to use (or for the go-ahead to create one) before changing anything.
- **Leave changes uncommitted.** No `git commit`, `git push`, and no PRs unless Matej explicitly asks in the current conversation. The deliverable is the edited working tree, not a branch or PR.
- **Parallel sessions share this tree.** Re-read files right before editing, touch only the files your task needs, and merge around other sessions' uncommitted changes — never revert or overwrite work you didn't do.

## Before You Implement Anything

Three rules that apply to every task, no exceptions.

> **Diffing / auditing a branch?** Baseline against **`origin/main`** (run `git fetch` first), not the stale local `main` — the local copy is often behind and produces misleading diffs.

### 1. Ask when not 100% sure of the requirement

If anything is ambiguous — scope, intended behavior, which files to touch, whether a DB migration is needed, what the output should look like — **stop and ask before writing code**. One focused question ("Did you mean X or Y?") costs nothing. Building the wrong thing costs hours and creates commits that need reverting.

This is especially non-negotiable for:

- Database schema changes and migrations
- Breaking changes to the API contract (adding, removing, or renaming fields clients send or receive)
- Financial logic — anything touching the ledger, credits, or payouts
- Changes that affect multiple apps simultaneously

### 2. Check for existing implementations before building new ones

Before writing any utility, Zod schema, type, component, or helper — **search the codebase first**. Duplicate infrastructure creates divergent behavior and compounds maintenance cost as the team grows.

| You need                      | Check here first                                              |
| ----------------------------- | ------------------------------------------------------------- |
| A Zod schema or enum          | `tagly-shared/models/src/core/` — enums, UIDs, time, password, etc. |
| A shared TypeScript type      | `tagly-shared/models/src/dtos/` and existing endpoint schemas       |
| A backend utility or helper   | `tagly-backend/src/utils/<domain>/` — check the generated `tagly-backend/src/utils/INDEX.md` (and `tagly-backend/src/constants/INDEX.md`) first |
| A React Native component      | `tagly-shared/client/components/`                                   |
| A client-side utility or hook | `tagly-shared/client/`                                               |
| An API call pattern           | `tagly-shared/client/api/`                                           |

**One canonical definition, used everywhere.** Every type, schema, enum, and constant must have exactly one source of truth. Export it from the right shared package and import it everywhere — never redefine it locally, even "just for now." If an existing definition almost fits but not quite, extend or generalize it rather than creating a parallel version.

### 3. Update CLAUDE.md when you introduce something worth knowing

When you add something that future developers should be aware of — a new utility, a new pattern, a new gotcha — update the relevant CLAUDE.md in the same pass. The guide is only useful if it reflects the current state of the codebase. An outdated guide is worse than no guide.

Update when you:

- Add a new utility to `tagly-backend/src/utils/` → add a row to the table in `tagly-backend/CLAUDE.md`
- Add a new utility to any of the clients or to `tagly-shared/client/` → mention it in the correct CLAUDE.md file
- Add a new reusable component or hook to `tagly-shared/client/` → mention it in the relevant app CLAUDE.md files
- Discover a new gotcha or sharp edge → add it to the "Common Gotchas" section of the relevant file
- Establish a new pattern that others should follow → document it where it applies

---

## API Backward Compatibility

All changes to the backend API, `tagly-shared/models` schemas, and `tagly-shared/sdk` functions must remain compatible with old clients. Mobile app users cannot be force-updated — old builds will be in the wild for weeks after a release.

**What counts as a breaking change:**

- Removing a field from a request or response schema
- Renaming a field (old clients still send/expect the old name)
- Changing the type of a field
- Removing or renaming an endpoint
- Changing an endpoint's HTTP method or path

**Rules:**

- Never modify an existing endpoint in a way that breaks old clients
- If a breaking change is genuinely needed, **create a new endpoint** (e.g. `/v2/...`) and keep the old one working until old clients are gone
- Adding new _optional_ fields to responses is safe — old clients ignore unknown fields
- Adding new _optional_ fields to requests is safe if the backend handles their absence gracefully
- Before any schema change, ask: "will an old client that doesn't know about this change still work?"

The `wantsPromoEmails` → `promoNotificationsEnabled` rename is the canonical example of how this plays out over a full cycle: the DB column and internal Prisma field were renamed first, while the JSON wire name had to stay `wantsPromoEmails` on every request schema that shipped builds still sent it to (the v1 customer/advertiser registration flows). The v2 flows were built with the new wire name from day one, and the old key finally disappeared when the v1 schemas were deleted at the 2026-08-31 cutover. A wire rename is never a single edit — it is a new field on a new endpoint version plus a deletion of the old one at the next cutover.

### Always mark deprecated things `@deprecated`

When a field/schema/enum is kept **only** for back-compat (a removed feature whose wire shape must stay for old clients), tag it with a `@deprecated` JSDoc so the whole back-compat surface is greppable and obvious at the call site:

- **Models DTOs / enums** (`tagly-shared/models`): `/** @deprecated Back-compat only — <why>; always <default>. Stop returning once old clients roll off. */` directly above the Zod field, schema, or enum.
- **Backend code that emits the default** (hydrators/controllers): a `// @deprecated back-compat: <why>` comment above the literal (`shareType: "AUTHENTIC"`, `campaign: null`, `scope: ["LOCAL"]`, etc.).

State the trigger for removal (usually "once old clients roll off / min-version bump"). One search — `grep -rn "@deprecated" tagly-shared/models/src tagly-backend/src` — must surface every shim so the eventual purge is mechanical. The campaigns/non-locals removal is the canonical example: the DB models are gone, but the DTO fields (`shareType`, `campaign`, `campaigns`, `nonLocals`, `pendingShares`, `campaignsTotalStatistics`, `scope`, …) and the backend defaults that feed them are all `@deprecated`-tagged rather than removed.

---

## Engineering & Design Principles

**Industry standard always.** Whether it's auth flows, DevOps patterns, or UX — default to what the industry has established, not something custom to Tagly. If a well-known pattern exists for a problem, use it.

**No hardcoded derived values.** Never hardcode a value that is ultimately owned by another component or system (e.g. a pixel height for a button that is defined by `CustomButton`). If a layout depends on the size of a reusable component, either let the layout auto-size to content, make the `height` prop optional, or measure it dynamically with `onLayout`. Hardcoded copies drift silently when the source changes.

**Inline single-use logic; extract on reuse.** Don't create a standalone helper/util/file for logic that has exactly one caller and no concrete, imminent second one. Keep it inside its caller until a second call site actually appears, then extract. A one-call-site "util" buys no reuse — it just adds a file and an import hop — and it's far cheaper to extract later than to un-sprawl the filesystem. Before extracting, count the real call sites: a genuine second caller justifies a file; "might need it someday" does not.

This is a rule about _private, app-internal helpers_ — it does **not** loosen the "one canonical definition, used everywhere" rule above. Cross-package contracts still live in their shared package even with a single consumer today, because the monorepo's architecture requires one source of truth across apps + backend: Zod schemas/enums (`tagly-shared/models/src/core/`), DTOs (`tagly-shared/models/src/dtos/`), endpoint schemas, SDK functions (`tagly-shared/sdk/`), and `@tagly/client` components/hooks. Single-use extraction is also still fine when it materially untangles a large function, is needed to unit-test logic in isolation, or the logic is a self-contained concept clearly about to grow. Judgment over dogma — but default to inlining.

**UX goals (non-negotiable):**

- **Customers** must be able to finish onboarding and feel motivated and equipped to create their first Share.
- **Businesses** must be able to finish onboarding and feel compelled to add budget.

Every UX decision should be evaluated against these goals. If a design choice creates friction in these flows, it's wrong regardless of how clean it looks.

## Project Overview

Tagly is a monorepo containing a Node.js backend, two React Native mobile apps (customer and advertiser), a Next.js admin dashboard, and shared packages. The project connects businesses/creators with customers through location-based campaigns and Instagram integration.

**Technology Stack:**

- Backend: Node.js + Express + Prisma + PostgreSQL
- Mobile Apps: React Native (Expo) + React 19 — **all three apps are native mobile** (tagly-customer + tagly-advertiser: iOS + Android; tagly-admin: iOS only). No web target anywhere.
- Admin Dashboard: React Native (Expo) — **iOS only**, distributed to the internal team via TestFlight (not hosted).
- Database: PostgreSQL with PostGIS extension for geospatial queries
- Infrastructure: AWS (S3, App Runner, RDS, Secrets Manager)
- Payments: Stripe (platform + connect accounts)

**Note:** In v2 the whole ecosystem is **native mobile (iOS + Android) — no web**. The advertiser and admin apps were formerly web (responsive / Expo Web); v2 drops the web target entirely, so there is no `useIsWideScreen`/`react-native-web`/SEO surface and the backend is bearer-token only (the cookie-auth + CORS surface was deleted at the v1 cutover, 2026-08-31).

## Out of Scope

**The following features are OUT OF SCOPE and do not need implementation, fixes, or changes:**

These features were built but intentionally excluded from the MVP to keep the app focused and reduce complexity. The code may exist in the codebase but should not be extended, fixed, or surfaced.

- **Non-locals** - Any subaccount types other than "local" (e.g., creators, brands, etc.)
- **Campaigns** - Campaign-related functionality, endpoints, and UI

Do not focus development efforts on non-local business pages or campaign features.

## Monorepo Structure

```
flaer/
├── tagly-backend/               # Express API server
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── src/
│       ├── constants/     # Static values, split into domain folders (auth/, billing/, content/, ...)
│       ├── controllers/   # Request handlers: v2/ (customerApp/, advertiserApp/, crossApp/, adminApp/, public/) + permanent webhooks/ (Stripe/Meta — external callers, never client-versioned)
│       ├── db/            # Kysely database client
│       ├── environment/   # Environment variable declarations
│       ├── middleware/    # Auth, validation, rate limiting
│       ├── prisma/        # Prisma client + selects/
│       ├── routes/        # Express routers: v2/ + webhooks/
│       ├── seed/          # Database seeding scripts
│       ├── utils/         # Backend utilities grouped by purpose (core/, money/, pricing/, hydrators/, ... — map in utils/README.md)
│       └── workers/       # Background workers (Postgres-polled; flat, one folder per worker, shared runtime/ framework)
├── tagly-customer/        # Customer mobile app (Expo)
│   ├── app/
│   │   ├── navigation/    # Navigation stacks
│   │   └── screens/       # Screen components
│   ├── components/        # Reusable components
│   ├── contexts/          # React contexts (auth, theme, etc.)
│   ├── hooks/             # Custom React hooks
│   ├── providers/         # App providers
│   └── utils/             # App-specific utilities
├── tagly-advertiser/      # Advertiser app (Expo - iOS + Android)
│   ├── app/               # Expo Router file-based routing
│   │   ├── (app)/         # Protected app routes (tabs, settings, etc.)
│   │   └── (auth)/        # Auth screens (forgot-password, etc.)
│   ├── components/        # App-specific components (forms, navigation, etc.)
│   ├── contexts/          # React contexts (auth, theme, advertiser data)
│   ├── hooks/             # Custom React hooks
│   ├── providers/         # App providers
│   └── utils/             # App-specific utilities
├── tagly-admin/           # Admin app (Expo - iOS only; TestFlight/internal)
│   ├── app/               # Expo Router file-based routing
│   │   └── (app)/         # Protected app routes
│   ├── components/        # React components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom React hooks
│   ├── providers/         # App providers
│   └── utils/             # App-specific utilities
├── shared/
│   ├── models/            # DTOs and endpoint schemas (Zod)
│   │   └── src/
│   │       ├── constants/ # Shared constants (ERROR_CODES, etc.)
│   │       ├── core/      # Reusable schemas (PasswordSchema, CentsSchema, enums, UIDs...)
│   │       ├── dtos/      # Data Transfer Objects: v2/ (customerApp/, advertiserApp/, crossApp/, adminApp/)
│   │       └── endpoints/ # Request/response schemas: v2/ (customerApp/, advertiserApp/, crossApp/, adminApp/, public/)
│   ├── sdk/               # API client
│   │   └── src/
│   │       ├── client/    # Custom request function with validation
│   │       └── endpoints/ # SDK functions: v2/
│   ├── design/            # Shared React Native design system
│   │   ├── components/    # Reusable components (primitives, lists, overlays, etc.)
│   │   ├── icons/         # SVG icon components
│   │   ├── hooks/         # Design hooks
│   │   └── misc/          # Colors, fonts, spacing, ThemeProvider
│   └── utils/             # Cross-platform utilities (api/, hooks/, formatting/, etc.)
├── docs/                  # Documentation
│   ├── DEVOPS.md                     # infra/CI/deploy + third-party service directory & devops operating rules
│   ├── SHARE_LIFECYCLE.md
│   ├── TRANSACTIONAL_NOTIFICATIONS.md
│   ├── LINKING_AND_REDIRECTS.md      # schemes, universal links, redirect page, OneLink, email CTAs
│   ├── REFERRAL_ATTRIBUTION.md       # codes, stickers, join page, attach paths, referral payouts
│   └── backend/                      # backend deep-dives referenced from tagly-backend/CLAUDE.md
│                                     # (observability, reward-est cache, share moderation+bans, workers, email)
├── .aws/ecs/              # ECS task definitions for workers
│   ├── staging/           # Staging worker configs
│   └── production/        # Production worker configs
├── .github/workflows/     # GitHub Actions CI/CD
├── Dockerfile             # Backend/worker container image
├── tagly-redirect/         # OAuth/Stripe redirect handler for mobile apps
├── tagly-join/             # Referral/join landing page (standalone Next.js, own node_modules)
├── tagly-website/          # Public website: marketing + legal pages (standalone Next.js, own node_modules; renders tagly-legal/ directly)
└── tagly-legal/            # CANONICAL legal docs (ToS, ToM, Privacy Policy; EN+CS) — see tagly-legal/CLAUDE.md for naming registry + template
```

**Versioning.** Only the **wire contract** is versioned per client generation: backend `controllers/v2` + `routes/v2`, and models `endpoints/v2` + `dtos/v2`. Everything behind it — backend `utils/`, `constants/`, `prisma/selects/`, `middleware/`, `workers/`, and models `core/` — is a single flat tree organised by domain (the `permanent/` vs `v2/` lifecycle buckets were collapsed on 2026-09-01, one day after the v1 generation was deleted on 2026-08-31: back to one version, one tree). A future generation gets its own `controllers/v3` + `routes/v3` + models trees alongside `v2`; the shared code behind them evolves in place. Detailed conventions live in `tagly-backend/CLAUDE.md` (folder layout + constants + INDEX) and `tagly-shared/models/CLAUDE.md` (endpoints/dtos + entry points). The `v2.0.0.md` plan file was retired 2026-08-14 (v2 shipped); the still-open post-cutover devops items (Stripe Connect manual-payout sweep, Meta-console branding + flaer redirect-URI removal) are in [FUTURE.md](FUTURE.md) § "Post-cutover tail".

## Shared Package Usage

| Package         | Used By            | Description                                                            |
| --------------- | ------------------ | ---------------------------------------------------------------------- |
| `@tagly/models` | All apps + backend | DTOs, Zod schemas, endpoint types                                      |
| `@tagly/sdk`    | All apps           | API client functions                                                   |
| `@tagly/client` | All client apps    | React Native design system (components, spacing, colors, fonts, icons) **+** cross-platform utilities (callAuthed, hooks, formatting) |

**Important:**

- `@tagly/models` and `@tagly/sdk` are used by all client apps (customer, advertiser, admin) and the backend
- `@tagly/client` is used by all client apps (customer, advertiser, admin) — it is a React Native package. It is the merged design-system + utils package (formerly `@tagly/design` + `@tagly/utils`)

**Key Exports from `@tagly/client`:**

- **Spacing constants:** `spacing.screenMaxWidth`, `spacing.componentGap`, `spacing.screenPaddingHorizontal`, etc.
- **Primitives:** `CustomButton`, `CustomTextInput`, `PressableText`, `PageLoading`
- **Components:** `StatisticCard`, `GeneralVerticalList`, `BottomOverlay`, `SlideInDrawer`, `CustomPicker`
- **Theme:** `useDesignTheme()`, `colors`, `textStyles`
- **Utilities:** `customAlert()` - cross-platform alert (use instead of `Alert.alert()`)

**Build Order:** `tagly-shared/models` → apps/backend (SDK doesn't need building)

## Three-Layer Endpoint Architecture

Every API endpoint follows this strict three-layer pattern across `tagly-shared/models/`, `tagly-shared/sdk/`, and `tagly-backend/`:

**1. Schema Layer (tagly-shared/models/src/endpoints/)**
Define request/response schemas using Zod. Schemas live under `endpoints/v2/`, organized by app:

- `customerApp/` - Customer-only endpoints
- `advertiserApp/` - Advertiser-only endpoints
- `crossApp/` - Cross-app endpoints (formerly `shared/`)

```typescript
export const GetLocalsFromSearchQuerySchema = z.object({
  q: z.string().min(1),
  currentLat: z.coerce.number().gte(-90).lte(90).optional(),
  currentLon: z.coerce.number().gte(-180).lte(180).optional(),
});
export type GetLocalsFromSearchQuery = z.infer<
  typeof GetLocalsFromSearchQuerySchema
>;

export const GetLocalsFromSearchResponseSchema = z.object({
  message: z.string(),
  locals: z.array(LocalPublicPreviewSchema).max(8),
});
export type GetLocalsFromSearchResponse = z.infer<
  typeof GetLocalsFromSearchResponseSchema
>;
```

**2. SDK Layer (tagly-shared/sdk/src/endpoints/v2/)**
Create client functions that validate schemas and make requests. SDK functions live under `tagly-shared/sdk/src/endpoints/v2/`.

```typescript
export function getLocalsFromSearch({
  query,
  jwt,
}: {
  query: GetLocalsFromSearchQuery;
  jwt: string;
}): ApiResponse<GetLocalsFromSearchResponse | ApiError> {
  return request({
    method: "GET",
    path: "/customers/locals/search",
    query,
    jwt,
    schemas: {
      query: GetLocalsFromSearchQuerySchema,
      response: GetLocalsFromSearchResponseSchema,
    },
  });
}
```

**3. Backend Layer (tagly-backend/src/)**

- Routes (`routes/`) - Express routers with validation middleware
- Controllers (`controllers/`) - Business logic handlers
- Middleware (`middleware/`) - Request validation, auth, rate limiting

```typescript
import { validateReq } from "../../middleware/request/validateRequest.js";

r.get(
  "/search",
  validateReq("query", GetLocalsFromSearchQuerySchema),
  getLocalsFromSearch,
);
```

## DTOs and Type Sharing

All DTOs must be defined under `tagly-shared/models/src/dtos/v2/<group>/` and exported via the matching barrel:

- `index.shared.ts` - version-agnostic building blocks only (`core/`, `catalogs/`, `constants/`)
- `index.v2.crossApp.ts` - public + cross-app contracts
- `index.v2.customerApp.ts` / `index.v2.advertiserApp.ts` / `index.v2.adminApp.ts` - per-app contracts

The `@tagly/models` package has multiple entry points to avoid bundling unnecessary code:

```typescript
import { SupportedLocaleSchema } from "@tagly/models/shared";
import { CustomerMe } from "@tagly/models/v2/customerApp";
import { AdvertiserMe } from "@tagly/models/v2/advertiserApp";
import { SubmitFeedbackBodySchema } from "@tagly/models/v2/crossApp"; // clean names, no V2 suffix — the version lives in the path
```

## Mobile App Patterns

**SDK Usage:**
Always use `callAuthed()` wrapper which:

- Ensures JWT exists in local storage
- Handles generic errors (network, timeout, invalid response)
- Shows appropriate user messages
- Navigates to login if needed

```typescript
const result = await callAuthed(navigation, (jwt) =>
  getLocalsFromSearch({
    jwt,
    query: { q: searchQuery, currentLat, currentLon },
  }),
);
```

**Environment-Based Bundle IDs:**
Set in `.env` via `APP_ENV`:

- `development` → `com.flaer.{app}.dev`
- `staging` → `com.flaer.{app}.staging`
- `production` → `com.flaer.{app}`

This allows multiple builds on the same device.

## Environment Setup

### Production Secrets

- Mobile apps: Stored in EAS Secrets (`eas secret:push`)
- Backend: AWS Secrets Manager (referenced in App Runner)

## Dependency Management

**SECURITY: Before adding ANY new package, verify it is safe:**

1. Check the package on npm - verify publisher, download counts, last update
2. Review the GitHub repo - look for signs of active maintenance and legitimacy
3. Search for security advisories or known vulnerabilities
4. Be extra cautious with packages that have few downloads or recent ownership changes
5. Never install packages from untrusted sources or with suspicious names (typosquatting)

**Critical Rules:**

0. **Use `yarn`, never `npm`** — for every command (install, scripts, add). `npm` would write a `package-lock.json` and diverge from the pinned `yarn.lock` resolutions.
1. Always run `yarn install` from root (not individual packages)
2. Only one `node_modules/` folder at root (delete others) — **exceptions:** `tagly-join/` and `tagly-website/` are standalone Next.js projects with their own `node_modules/` and `yarn.lock` (install each with `cd <dir> && yarn install`; root `yarn clean:install` spares both)
3. Shared dependencies (React, Zod, TypeScript, React Native) are pinned in root `package.json` under `resolutions`
4. No `*` versions in `tagly-customer/`, `tagly-advertiser/`, or `tagly-backend/` package.json
5. `tagly-shared/client/` CAN use `*` since it inherits app versions

**Build Order Dependency:**
`tagly-shared/models` must build before the backend and apps.

## Key Patterns to Follow

**When creating new endpoints:**

1. Define schemas in `tagly-shared/models/src/endpoints/`
2. Create SDK function in `tagly-shared/sdk/src/endpoints/`
3. Add route + controller in `tagly-backend/src/`
4. Use `validateReq()` middleware for schema validation
5. Export types/schemas via appropriate index files

**When adding DTOs:**

1. Create in `tagly-shared/models/src/dtos/`
2. Export via `index.shared.ts`, `index.customerApp.ts`, or `index.advertiserApp.ts`
3. Use Zod schemas for runtime validation

**When modifying Prisma schema:**

1. Update `tagly-backend/prisma/schema.prisma`
2. Create migration: `yarn prisma migrate dev` — **never write the SQL by hand**. Always let Prisma generate it from the schema diff. Hand-written migrations skip Prisma's safety checks and easily forget the `"app"."..."` schema qualifier (see below).
3. Generate client: `yarn prisma:generate`
4. Optionally update Kysely types: `yarn db:types`

**If you must edit a generated migration** (e.g. to add a backfill, reorder operations, or split a destructive change):

- Always qualify table names with the schema: `"app"."customers"`, not `"customers"`. The datasource declares `schemas = ["app", "jobs"]`, and every other migration in the repo uses the qualified form. Unqualified names only work by accident (search_path) and are fragile.
- Never edit a migration that has already been applied to staging or production — Prisma tracks migrations by checksum and any change causes drift errors on every subsequent deploy. Create a new migration instead.

**File extensions in backend:**

- All imports must use `.js` extension (TypeScript emits ES modules)
- Post-build script fixes imports: `yarn fix:imports`

## Common Gotchas

- **PostgreSQL extensions required:** The first Prisma migration MUST include `CREATE EXTENSION IF NOT EXISTS postgis` and `CREATE EXTENSION IF NOT EXISTS citext`. These are required before any migrations can run.
- **Expo build workflow:** Always build on device first (`yarn ios:dev` or `yarn android:dev`), THEN start Metro bundler with `yarn start:dev`. Running Metro first won't work.
- **`expo run:ios` install-on-iPhone crash (`TypeError: Cannot convert object to primitive value` in `LockdowndClient.startSession`):** an `@expo/cli` bug fixed in 54.0.26 — `expo@54.0.25` pins CLI 54.0.16, so root `package.json` carries a `"@expo/cli": "54.0.26"` resolution. Keep (or drop) that pin when bumping `expo`. If a device install ever fails again after a successful build, install the already-built app manually with devicectl — no rebuild needed:
  1. `xcrun devicectl list devices` — grab the device Identifier
  2. `xcrun devicectl device install app --device <IDENTIFIER> ~/Library/Developer/Xcode/DerivedData/<app>-*/Build/Products/Debug-iphoneos/<app>.app` (customer app = `devTagly.app`)
  3. `yarn start:dev`, then open the app on the phone
- **Shared package changes:** When you modify `tagly-shared/models`, you must rebuild it (`yarn build`) AND restart any apps using it (backend, mobile apps). SDK changes don't require rebuilding but apps need restarting.
- **Multiple node_modules:** If builds fail with version conflicts, check for multiple `node_modules` folders. Only the root should have one - delete all others and run `yarn install` again. **Exceptions:** `tagly-join/` and `tagly-website/` are standalone projects and correctly have their own `node_modules/`.
- **Package versions:** Never use `*` versions in app-level package.json files. All shared dependencies are controlled via `resolutions` in root package.json.
- **BigInt in JSON:** Backend automatically converts BigInt to safe integers. Don't manually stringify them in controllers.
- **Rate limiting order:** Middleware is applied in sequence in `app.ts`. The order matters - IP limits before auth limits before route-specific limits.
- **Android `android/` regeneration:** `expo prebuild` (triggered by `yarn android:dev` when `android/` is missing) resets `android/gradle.properties`. Re-apply local dev optimizations (`reactNativeArchitectures=arm64-v8a`, `org.gradle.jvmargs=-Xmx4096m`) after any prebuild. Never use single-arch for EAS/production builds.
- **Android stale native folder:** If a new native plugin is added (e.g. in `app.config.ts` plugins array) and the `android/` folder already exists, delete it and run `yarn android:dev` again so the plugin can run during prebuild.
- **Android Firebase:** `google-services.json` must be present at `tagly-customer/google-services.json` for push notifications to work locally. It is gitignored. For EAS builds it is injected via the `GOOGLE_SERVICES_JSON` EAS **file env var with `sensitive` visibility** (per environment; NOT `secret` — see the fingerprint gotcha below). When re-downloading from Firebase, keep the README's API-key rule in mind: the client's `api_key[0]` must be the Firebase key, never the Maps key (`FIS_AUTH_ERROR`/silent push hang). See `tagly-customer/README.md`.
- **EAS fingerprint runtime version parity (Android):** `runtimeVersion: { policy: "fingerprint" }` requires the fingerprint computed where `eas build` is invoked to EQUAL the one computed on the EAS builder, or the build dies in `CONFIGURE_EXPO_UPDATES` ("Runtime version calculated on local machine not equal..."). Two invariants keep them equal: (1) `google-services.json` content — the config's `googleServicesFile` is content-hashed on both sides. Outside dev the `GOOGLE_SERVICES_JSON` env var is the ONLY source (`app.config.ts` has no filesystem fallback for staging/prod — never add one; a fallback to an untracked local file makes the fingerprint depend on invisible machine state). CI (`.github/scripts/eas-start-build.sh`) runs `eas env:pull` and exports the var before `eas build`; for a laptop-initiated staging/prod Android build do the same (`npx eas-cli env:pull preview` then `GOOGLE_SERVICES_JSON=$PWD/.eas/.env/GOOGLE_SERVICES_JSON yarn build:android:staging`). The var must stay `sensitive` visibility — `secret` cannot be pulled locally and guarantees a mismatch (that was the original incident: the first fingerprint-policy Android build failed). (2) The app-level `.gitignore` in each app must ignore `/android/` + `/ios/` — the EAS builder has no `.git`, so `@expo/fingerprint`'s ignore scan is scoped to the app dir and the repo-root `.gitignore` is invisible to it; without the app-level lines the builder classifies the prebuilt project as bare. (3) No build step may mutate a fingerprinted file asymmetrically: react-native-permissions' `setup_permissions` (from the advertiser's `iosPermissions` plugin config) rewrites `RNPermissions.podspec` inside `node_modules` during pod install, so the builder hashed a file the invoking machine never saw — `tagly-advertiser/fingerprint.config.js` ignores exactly that file (both sides load the config; keep ignores file-precise so package upgrades still mint a new runtime version). Also: EAS refuses `secret`→non-secret visibility changes (delete + recreate the var) and caps non-secret file vars at 4 KiB (the preview vars are single-client filtered files for this reason).
- **App Runner deploys are judged by the OPERATION, never `Service.Status`:** the service reports `RUNNING` both before a deployment starts and after a rollback, so a status poll "passes" failed deploys. The deploy workflows poll `aws apprunner list-operations` for the `operationId` captured at `start-deployment` (SUCCEEDED passes; FAILED/ROLLBACK_* fail) — keep any new deploy tooling on that pattern. Related sequencing fact: `update-service` (any config/env change) itself triggers a full build+deploy from the tracked branch head — an env edit IS a deploy of whatever that branch holds, so order env edits against code merges deliberately.
- **Amplify console settings override the repo `amplify.yml`:** each Amplify app stores `AMPLIFY_MONOREPO_APP_ROOT` and (once saved) a console-side buildSpec, both invisible to code review — a stale value silently builds the wrong folder (E004). The Amplify deploy workflows now assert the app root and re-sync the console buildSpec from the repo file (sha-verified) before every `start-job`, so **the repo `amplify.yml` is the source of truth by construction** — never hand-edit build settings in the console; change `amplify.yml` instead. (A saved console buildSpec cannot be deleted via the API, only overwritten — hence sync, not clear.)
- **AWS SDK clients ship with NO timeout — every client singleton must set one (E061).** The SDK default is unbounded (`DEFAULT_REQUEST_TIMEOUT = 0`), and a hung call blocks its caller forever — worst case inside a `runWorkerLoop` domain-poll worker (no per-job deadline) holding a singleton advisory lock, where one hang wedges the whole loop until the ECS task restarts. Two sharp edges: `requestTimeout` alone only **WARNS** — `throwOnRequestTimeout: true` is what makes it fire; and a hard cap is wrong for unbounded streams — `s3Client` deliberately uses an idle-based `socketTimeout` because `uploadRemoteMediaToS3` stores IG originals with no byte cap. The three singletons (`utils/clients/aws/`) carry tuned configs; any NEW AWS client must set explicit timeouts the same way.
- **Never log a request URL with its query string (E086/E087).** Query strings carry real credentials — the never-expiring email-unsubscribe token and the onboarding `registrationToken` — and a log line is permanent. `logError` logs the path only (by design, commit `a90e0e96`) and `morgan("dev")` runs in dev/staging only (team-only envs, by decision). Any new log site must not print `originalUrl`/`req.url` with the query attached, and new endpoints should avoid putting credentials in query params at all (POST body or header instead).
- **Third-party GitHub Actions never receive secrets (E094).** A `uses:` from a personal/third-party org on a mutable tag can be repointed at malicious code that exfiltrates whatever it's handed. Firebase App Distribution runs via the **official `firebase-tools` CLI, version-pinned**, with the SA JSON confined to `$RUNNER_TEMP` (commit `d50297f2`) — keep that pattern for any new integration: official CLI or official-org action; if a third-party action is truly unavoidable, pin it to a full commit SHA and give it the narrowest possible secret. GitHub-/AWS-official actions on version tags are accepted.
- **iOS purpose strings are required for APIs a native lib merely references (ITMS-90683):** Apple's binary scan rejects a build if any bundled native code references a protected API without its `NS*UsageDescription` in `infoPlist` — even when no flow uses it. `react-native-image-crop-picker` (advertiser + admin business forms — and the CUSTOMER app too: the shared `@tagly/client` barrel exports `pickMedia`, whose TurboModule `getEnforcing` **throws at app startup** if the native module is missing, so the dep must stay installed in every app that imports the barrel) and `@stripe/stripe-react-native` (card scanning; advertiser-only) reference camera APIs, so every app bundling them must declare `NSCameraUsageDescription` in `app.config.ts`. Same defensive rule for `expo-location` (linked into the advertiser via the shared hooks barrel despite no location flow — its purpose string stays, with a rationale comment). When adding any native module, check its docs for required purpose strings and add them to all apps that gain the dependency, or the store submission bounces days later.
- **Map markers with custom views need BOTH `anchor` and `centerOffset`:** `react-native-maps` positions custom marker views by `anchor` on Android (Google Maps) but by `centerOffset` on iOS (Apple Maps) — each platform ignores the other's prop. An `anchor`-only marker renders centered on the coordinate on iOS, so its pointer tip points below the true spot. Pass `anchor={{ x: 0.5, y: 1 }}` **and** `centerOffset={{ x: 0, y: -height / 2 }}`, with `height` measured (`onLayout` / `MapMarkerComponent`'s `onHeight`), never hardcoded. See `tagly-shared/client/components/maps/BusinessMap.tsx` and the business-detail screens.

## Task Completion Output

After finishing any task, always write a file change summary in tree format. Group by top-level directory, show nested paths, and label each file `added`, `changed`, or `removed` with a one-sentence description of what changed. Example:

```
backend
└── src
    └── controllers/advertiserApp/billing
        └── createCharge.ts — added: new controller that creates a Stripe charge from a PAYG period
shared
└── models/src/endpoints/advertiserApp/billing
    └── createCharge.ts — added: Zod request/response schemas for the createCharge endpoint
```

## Modifying Existing Endpoints

When modifying backend endpoints, always keep SDK and Models in sync:

1. **Update schemas** - If request/response changes, update `tagly-shared/models/src/endpoints/`
2. **Update SDK** - If path, method, or params change, update `tagly-shared/sdk/src/endpoints/`
3. **Rebuild models** - Run `yarn build` in `tagly-shared/models` (SDK doesn't need building)
4. **Test clients** - Verify mobile apps and admin still work

**Zod Validation Loop Prevention:**

Ensure request/response schemas are achievable by clients. A schema that can never be satisfied causes infinite validation failures.

```typescript
// ❌ WRONG - client can't provide serverOnlyField
const BadSchema = z.object({
  id: z.number(),
  serverOnlyField: z.string(), // Client can't send this
});

// ✅ CORRECT - separate schemas for request vs response
const RequestSchema = z.object({ id: z.number() });
const ResponseSchema = z.object({
  id: z.number(),
  serverOnlyField: z.string(),
});
```
