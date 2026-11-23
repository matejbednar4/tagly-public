# Hydrators — read before adding or editing one

Hydrators build DTOs from **already-persisted** data. The cardinal rule:

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../../../../../CLAUDE.md).

## A hydrator must NEVER throw on corrupt/unexpected stored data

A hydrator reads rows we already wrote and shapes them into a response. If it
`throw`s because a stored value is malformed, **the user can never load that
screen again** — the data is corrupt, so every retry hits the same throw. There
is no client action that fixes it. The user is bricked until an engineer
manually repairs the row.

This is catastrophic for **session / app-open hydrators** — the ones behind
`GET /v2/customers/me`, the advertiser equivalent, and anything the app calls on
launch. A throw there doesn't break one screen; it **locks the user out of the
entire app**. One bad byte in one column = a permanently unopenable app, with no
recovery path and no useful error. Extremely bad UX, and exactly the kind of
failure that's invisible in testing (clean data) and only shows up in
production.

### The anti-example (historical — since fixed in `hydrateCustomerMe.ts`)

```ts
// hydrateCustomerMe.ts once did this — WRONG for a session hydrator
locale: validateLocaleIsSupportedOrThrow(customer.locale),
```

`validateLocaleIsSupportedOrThrow` throws **500** if `customer.locale` isn't a
supported value. So if a row's `locale` were ever unreadable, `hydrateCustomerMe`
would throw and `/me` would 500 on **every** app open — the user never gets past
the splash, with no client action that fixes it. The live code now reads the
writer-guaranteed value as-is (see below); keep it that way.

## What to do instead — trust the write boundary, read as-is

Validation is the **writers'** job, done **once** at the write boundary. The
registration controller already narrows `locale` via
`validateLocaleIsSupportedOrThrow` before it ever hits the DB, so by the time a
hydrator reads `customer.locale` the value is **guaranteed** supported. The
hydrator just reads it:

```ts
// locale is writer-guaranteed — read as-is, no re-validation.
locale: customer.locale as SupportedLocale,
```

Re-checking writer-guaranteed data at read time adds machinery for a state that
can't occur, and the throwing version actively bricks the user. **Validate once,
at the write boundary; trust it everywhere downstream.**

Guidelines:

- **Write-time = strict, and it's the only gate.** Validate + reject bad data at
  the controller / `validateReq` boundary (and in the writer utils) so it never
  reaches the DB. `…OrThrow` helpers belong there, never in a hydrator.
- **Read-time = trust, don't re-validate.** A field the writers own is already
  valid; read it directly (cast if the column type is wider than the DTO).
- **Genuinely-unconstrained fields degrade, never throw.** If a value really
  isn't writer-guaranteed (backfilled / imported data, a column no validator
  owns), default it, null it (make the DTO field nullable), or drop it — and log
  the anomaly to observability. Still never throw.
- **The one legitimate hydrator throw is "not found"** — the root entity the
  caller asked for doesn't exist (`createCustomError(404)`). That's a real,
  actionable state, not corrupt data. Never throw because a *field* of a found
  row looks wrong.

If you find yourself writing `…OrThrow(row.someField)` inside a hydrator, stop:
either the writers already guarantee it (so the check is dead weight that can
only ever brick a user) or they don't (so degrade, don't throw).

## Audience gates are enforced IN the hydrator too (defense in depth)

Each audience-scoped hydrator spreads its audience's canonical predicate into
its own query, in addition to the controllers doing so:

- customer business hydrators (`hydrateBusinessPublic{Details,Previews}`) →
  `businessVisibleWhere` (DELETED/BANNED never hydrate for customers),
- the owner hydrator (`hydrateBusinessOwnerDetails`) →
  `businessOwnerVisibleWhere` (BANNED stays owner-visible + carries `status`;
  DELETED is gone),
- advertiser share hydrators (`hydrateAdvertiserShare{Previews,Details}`) →
  `ADMIN_APPROVED_SHARE_WHERE` (unapproved shares never reach the advertiser),
- admin hydrators → deliberately unfiltered (admin sees everything).

The query-level predicate in the controller remains the correctness layer
(pagination, counts, SQL aggregates can't be fixed post-fetch); the hydrator
copy is the safety net — a caller that forgets the filter gets a null/short
list (degrade, per the rule above), not a data leak. Import the shared
predicate constants (`utils/businesses/businessAccessibility.ts`,
`utils/shares/shareAccess.ts`); never inline the literals.
