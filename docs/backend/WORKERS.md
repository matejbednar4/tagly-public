# Workers — runtime framework, igSnapshot audience-location, boot-time seeder sharp edges

> Deep-dive referenced from [tagly-backend/CLAUDE.md](../../tagly-backend/CLAUDE.md).
> The short rules live there (build every worker on `runtime/`, never hand-roll a loop);
> this file holds the framework internals and the deploy/rollback gotchas.
> Share pipeline: [SHARE_LIFECYCLE.md](../SHARE_LIFECYCLE.md).

## The `runtime/` framework

`workers/runtime/` centralizes everything that used to be copy-pasted across workers. **No worker should contain its own `while` loop, SIGTERM handler, retry block, claim CAS, or `console.*` call.**

- **`runWorkerLoop({ name, tunables, tick, singleton? })`** — the one poll loop. Owns graceful shutdown (SIGTERM/SIGINT drain), idle pacing (jittered when `tunables.jitterPct` is set), loop-error backoff → `reportWorkerError`, lifecycle logging, the optional advisory-lock **singleton** wrap (`cleanup`, `maintenance` pass `singleton: LOCK_KEYS.*`), and — installed **once here, not per `run.ts`** — the process-level `uncaughtException`/`unhandledRejection` crash handlers (report as `class: "crash"` → flush PostHog → exit 1) plus the PostHog flush on graceful shutdown. A `tick` returns `true` to spin (drain a backlog) or `false`/void to pace at `loopIdleMs`. **Domain-poll workers** (cleanup, maintenance, stripe, sharePayment) use this directly.
- **`runJobQueue({ name, tunables, transitions, claim, execute, … })`** — built on `runWorkerLoop`, adds the whole enqueued-job mechanism for the **queue workers** (igInsights, igSnapshot, notifications): claim → execute → `markDone`, transient errors rescheduled on jittered exp-backoff until `maxAttemptsPerJob` then failed terminally, `PermanentJobError` fails immediately, terminal failures fire `onTerminalFailure` (e.g. `voidShareForFailedJob`) and report once. Each worker supplies only its `claim`, `execute`, and optional terminal hook. An `execute` may also **return `DeferJob`** (exported from `runJobQueue.ts`) to put the job back to SCHEDULED at a later time *without* consuming a retry attempt — "not now, later", used by the notifications worker for send-time quiet-hours re-snapping and the email waterfall leg waiting on its push sibling.
- **`jobQueue.ts`** — `makeJobTransitions(delegate)` (the identical `markDone`/`failJob`/`reschedule` over the shared `JobStatus` columns) + `claimDueJobs` / `claimJobsByIds` (the atomic status-CAS claim). All three `jobs.*Queue` tables share the exact same columns, so this is written once, generic over a minimal Prisma delegate (cast `prisma.xQueue as unknown as JobQueueDelegate`).
- **`workerLogger(name)`** — request-less structured-JSON logger (fields: `worker`, `jobId`, `shareId`, `attempts`, `durationMs`, …). Use it, not `console.*`.
- **`reportWorkerError(err, ctx)`** — the single chokepoint for loop crashes + terminal job failures + process crashes. Logs structured JSON **and** forwards to the shared `utils/core/errors/reportError.ts` sink (→ PostHog), stamping the `error_class` (`permanent`/`transient`/`crash`) from the context the runtime already knows. Opt-out: `ExpectedWorkerError`/any `expected` CustomError is muted.
- **`workerErrors.ts`** — the error classification helpers only; **there are no worker error classes**. Workers throw the same `createCustomError` the API does: `createCustomError(code, msg, { permanent: true })` to fail a job terminally (add `expected: true` for a benign terminal the tracker should ignore). Codes are raw literals in the **8xxx** worker-failure block, at the throw site (like every other domain code). The runtime classifies purely off the flags — `isTerminalError(err)` = `isCustomError(err) && err.permanent`, `isExpectedError(err)` = `…&& err.expected`. Default (any plain, non-CustomError throw) = retryable — the safe default for the unstructured errors workers throw from everywhere.

Tunable **values** live in `constants/workers/<WORKER>.ts` and must `satisfies WorkerLoopTunables` / `JobQueueTunables` (shapes in `constants/workers/types.ts`), so the harness/runner reject a worker missing `loopIdleMs`/`errorSleepMs`/etc.

## Audience-location source (igSnapshot)

Each `InstagramSnapshot` stores ONE audience-location source — **either/or**, for both the stamp and
the rows. `audienceLocationsSource` (nullable, no DB default — the worker sets it explicitly):
`REACHED_AUDIENCE` (`reached_audience_demographics`, rolling `this_month`) when the
`REACHED_AUDIENCE_CAPTURE` guards pass (`constants/instagram/AUDIENCE_CAPTURE.ts` — absolute
floor, ratio-of-follower floor, viral ceiling) and ≥1 city geocodes; else `FOLLOWER_AUDIENCE`; else
**NULL = the snapshot captured no audience locations at all** (e.g. <100 followers where IG suppresses
the breakdowns — consumers short-circuit to their no-geo fallback). Only the chosen source is geocoded
and stored; `audienceLocationsTotalValue` is its true breakdown sum. Rules that keep this correct:

- **EVERY pricer reads the stamp.** `utils/pricing/helpers/calculateGeographicsBps.ts` (behind both
  `calculateEstPrice` and the settlement pricer `calculateFinalPrice`) prices `audienceLocationsSource`
  rows: with either/or storage, a reached-stamped snapshot has no follower rows, and a
  FOLLOWER-only pricer would collapse every estimate/lock to `noGeoBps`.
- The reached fetch is **best-effort**: IG suppresses the metric below ~100 reached accounts in the
  window by returning an **empty dataset** (not an error) — an empty/failed reached fetch is normal and
  must never fail/void the job.
- Consumers (both geo calcs, `getTopAudienceLocations`, the admin hydrator) filter rows to the stamped
  source (consistency guard). Rows price exactly as reported — the old under-coverage proximity top-up
  was removed (the unseen tail is assumed to mirror the seen rows, which leaves the weighted mean
  unchanged).
- Fetch/geocode utils: `fetchAudienceCityBreakdownFromIG` (raw breakdown) +
  `selectAndGeocodeAudienceLocations` (band/coverage capped geocoding; one shared `GeocodeMemo` per
  job — the reached→follower fallback path re-geocodes overlapping cities for free).
- ⚠️ **CZ geocoding special-case.** IG gives each city as `"City, Region"` with no country, and its
  Czech region labels are English exonyms (`"Central Bohemian Region"`). Czech kraje are barely used
  colloquially, so an unconstrained geocode of those strings sends Amazon Location to the wrong country
  (Kladno → Denmark, Brno → Sweden). `geocodeAudienceLocation` therefore runs `resolveCzechRegion` (map
  in `constants/localization/CZECH_REGIONS.ts`): a recognized kraj pins the geocode to
  `countryCode: "CZ"` (+ canonical region, city-only fallback); every other market geocodes
  unconstrained (US states etc. resolve fine). Extend the map only if another market shows the same
  exonym→wrong-country failure. Geo normalizes over *stored* rows, so a mis-geocode isn't cosmetic — a
  city landing abroad silently distorts the geo multiplier.

## Boot-time catalog seeders (verticals + notifications) — deploy/rollback sharp edges

`app.ts` runs `seedNotifications()` + `seedVerticals()` on EVERY instance boot, before
`listen`. Two consequences to keep in mind whenever a shared catalog changes
(settled 2026-08-02/03, E341 + E196 — evidence in `v2-review/DECISIONS.md`):

- **Adding a catalog row (vertical / advertiser type / interest) arms a rollback
  crash-loop one image back.** `seedVerticals` validates BOTH directions and its
  inverse DB→catalog check **throws at boot** on any DB row missing from the compiled
  catalog — in every image generation. So after a deploy whose seeder inserted a new
  row, any OLDER image booting against that DB (failed-deploy auto-rollback, manual
  rollback, scale-out of the old version) dies on the orphan check. Accepted as-is
  (Matej, 2026-08-02); the mitigation is operational: the deploy workflows print the
  App Runner boot logs on failure (commit `cb55ccde`), and the rollback runbook
  carries the un-brick DELETE for the current instance of this (`bistro`, see
  DECISIONS.md § E198 additions). When you add a catalog row, know that rolling back
  past that deploy needs the corresponding row deleted first.
- **Removing a notification event from the catalog destroys consent state at the
  next boot.** `seedNotifications` hard-deletes DB events whose slug left the catalog,
  and the opt-out FK cascades — so remove-then-re-add (including a deploy that removes
  an event and then gets rolled back to an image that still has it) silently
  re-subscribes every account that had opted out. **WON'T FIX (Matej, 2026-08-02)** —
  the risk only fires on a remove+re-add of the same slug; treat event-slug removals
  as permanent and never reuse a retired slug. (A soft-retire path exists if this ever
  matters: `NotificationEvent.status = INACTIVE` is already honored by every reader —
  the list/update endpoints, `queueNotificationJobs`, and the admin hydrator.)
