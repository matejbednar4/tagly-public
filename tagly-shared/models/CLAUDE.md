# `@tagly/models` Development Guide

`@tagly/models` is the single source of truth for the API contract: Zod schemas, DTOs, endpoint request/response types, core enums, and UID schemas. It is consumed by **all** apps (customer, advertiser, admin) and the backend. See the root [CLAUDE.md](../../CLAUDE.md) for the three-layer endpoint architecture and the canonical-definition rule.

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../../CLAUDE.md).

## Build

The backend and apps resolve `@tagly/models` from `dist/`, **not** `src/`. After editing anything here you must rebuild before a tagly-backend/app typecheck reflects the change:

```bash
cd tagly-shared/models && yarn build
```

After adding a **new entry point** (a new `index.*.ts` + an `exports` map entry in `package.json`), you must `yarn build` before the backend can resolve it (the backend uses the `default`/`dist` condition; apps use `react-native`/`src`).

## Endpoint structure (mirrors `tagly-backend/src/controllers`)

`endpoints/` **and `dtos/`** are partitioned by **version first, then app group**, the same as backend controllers (`controllers/v2`):

```
endpoints/v2/{public,customerApp,advertiserApp,adminApp,crossApp}/…   ← the current wire contract (deleted wholesale at the next cutover)
dtos/v2/…                                                             ← the current DTOs
core/   constants/   catalogs/                                         ← permanent floor (enums, UIDs, shared schemas) — never versioned
```

The v1 trees (`endpoints/v1`, `dtos/v1`) and their barrels were deleted at the v1 cutover (2026-08-31). When a next generation is built, it gets its own `v3/` trees alongside; a generation's DTOs are built fresh, never shared with the previous one, so the old generation can be deleted wholesale.

**Version-namespaced entry points, clean names.** Contracts export through **`@tagly/models/v2/{crossApp,customerApp,advertiserApp,adminApp}`** (`crossApp` covers public + crossApp endpoints) — so schema names stay clean (`SuggestLocaleBodySchema`, no `V2` suffix); the version lives in the import path, mirroring how `controllers/v2` exports a clean `suggestLocale`. Each entry point is an `index.v2.<group>.ts` barrel + an `exports` entry in `package.json`. **`@tagly/models/shared`** is the version-agnostic entry point: it exports ONLY `core/`, `catalogs/`, and `constants/` (never an endpoint or DTO).

- **Shared building blocks stay in `core/`** (enums, UIDs, `SupportedLocaleSchema`, `ApiError`) and are imported from `@tagly/models/shared` — they’re the permanent floor, never duplicated per version.
- **A version owns its endpoint schemas and DTOs.** Don’t make one generation's endpoint/DTO import another's — build it fresh under its own trees, or pull the shared primitive from `core/`.
- The cutover recipe: delete `endpoints/<gen>/**` + `dtos/<gen>/**` + that generation's `index.*.ts` barrels + their `exports` entries; purge `core/`/`constants/` symbols whose only readers were in the deleted generation (the `@deprecated` tags make this greppable — see below); `catalogs/` and the surviving trees are untouched.

### `@tagly/sdk` mirrors the current generation only

The backend never imports the SDK, and already-shipped apps carry their own bundled copy — so an SDK client function only needs to exist as long as *this repo's* frontend calls it. `@tagly/sdk/src/endpoints` therefore contains only `v2/`, exported through `@tagly/sdk/v2/<group>`; `index.shared.ts` keeps only `initSdk`/config (version-agnostic).

## Mark deprecated things `@deprecated`

When a field, schema, or enum is kept **only** for back-compat — a removed feature whose wire shape must stay so old app-store clients keep validating — **tag it with a `@deprecated` JSDoc** rather than deleting it. The tag makes the entire back-compat surface greppable, so the eventual purge (behind a min-version bump) is mechanical.

Format — put it directly above the Zod field / schema / enum, name the reason and the constant default, and state the removal trigger:

```ts
/** @deprecated Back-compat only — <feature> removed; always <default>. Stop returning once old clients roll off. */
someField: SomeSchema,
```

Rules:

- **Tag the definition site.** If `details` extends `preview`, tag the field once in `preview` (it's inherited); tag again only where a field is overridden.
- **Tag the whole schema/enum** when the entire thing is back-compat — `/** @deprecated Back-compat only — <feature> removed. */` above the `export const`.
- **Pair it with the backend.** The hydrator/controller that emits the default carries a matching `// @deprecated back-compat:` comment (see [tagly-backend/CLAUDE.md](../../tagly-backend/CLAUDE.md)), so one search spans both layers.
- **Don't drop a live field to "fix" a type error.** Removing a field from a customer/advertiser/crossApp response is a breaking change — keep it, mark it `@deprecated`, and have the backend emit a safe default. The **only** exception is admin DTOs (`dtos/v2/adminApp/`, `endpoints/v2/adminApp/`), which deploy in lockstep with the backend and may drop fields outright.

The campaigns / non-locals removal was the canonical example: the DB models went first, every surviving v1 wire field (`shareType`, `campaign`, `scope`, …) and its standalone schema/enum stayed `@deprecated`-tagged for the shipped builds, and the whole set was purged mechanically at the v1 cutover once the min-version wall had retired those builds. The only tag left today is `TransactionKind.STRIPE_PROCESSING_FEE` (kept so historical ledger rows stay readable). To find the current removal set:

```bash
grep -rn "@deprecated" tagly-shared/models/src
```
