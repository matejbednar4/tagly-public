# Backend Observability — error tracking, product events, team-alert escalation

> Deep-dive referenced from [tagly-backend/CLAUDE.md](../../tagly-backend/CLAUDE.md).
> The short rules live there; this file holds the full mechanics and rationale.

## Error tracking (PostHog sink)

Errors are shipped to PostHog through the single vendor-neutral sink
`utils/core/errors/reportError.ts` (client singleton in `utils/clients/posthog.ts`). Two
boundaries call `reportError` for you — the API central handler (`middleware/request/errors.ts`) and workers
(`workers/runtime/reportWorkerError.ts`) — so most code never calls it directly. The one sanctioned
direct-call case is a **background side-effect that's deliberately swallowed** to protect its caller (a
best-effort notification-queue write that failed, a self-healing withdrawal recovery path): report it with
`source: "system"` so it's visible instead of dying in a write-only log, then continue.

The classifier is **`track = !expected`** — **capture everything** (every ≥500 incl. unforeseen Prisma/Stripe
throws, and every domain 4xx rejection like "share creation failed", which is real product signal), and mute
**only** `{ expected: true }`. Opt-**out** is per-throw-site: when you throw a genuinely operational error
that would be noise (validation, auth/session, rate-limit, a benign ≥500), pass
`createCustomError(code, msg, { status, expected: true })`. The pure transport/session edge cases already do
this — Zod + HTML-input (`errors.ts` + `validateRequest.ts`), route-not-found, all auth
(`verifyJwt`/`requireCapability`/dashboard CORS), rate-limit, client-outdated, and the **wrong-OTP typo
(`OTP.INVALID`) only**. OTP _flow_ errors (session-lost / expired / lockout / can't-resend) stay **tracked** —
onboarding-friction signal. **A new operational error that forgets `expected` just shows up in the tracker
(visible → then you mute it) — never silently dropped.**

Every API error event carries an **`audience`** property (`customer` / `advertiser` / `admin` / `cross` /
`public` / `unknown`) for PostHog breakdowns — derived in `reportApiError` from the JWT entity
(`getEntityFromUid` on `req.user.uid`, exact even on cross-app routes) with a router-mount-prefix fallback for
unauthenticated requests; it needs no per-controller wiring. Don't add PostHog calls at call sites; don't
reintroduce a DB error table (PostHog is the store).

## Backend product events (analytics twin)

Backend product events (not errors) go through the analytics twin
`utils/core/errors/captureServerEvent.ts` — same PostHog project, `app: "backend"`, pseudonymous
`distinctId` (the account **uid** via `resolveRecipientAnalyticsId`, or `TARGET:id` for pending accounts —
never PII, never a bare DB primary key of a real account), `$process_person_profile: false` (set on BOTH
`captureServerEvent` and `reportError` since 2026-08-06), fail-open. For low-volume
events only the server can see truthfully (e.g. the notifications worker's `promo_notification_sent`, which
pairs with the clients' `push_opened` for per-step open rates). The email side of that funnel: promo sends
still carry Resend analytics tags (`utils/email/promoEmailTags.ts` — dashboard labels), but the
open/click leg was REMOVED 2026-08-05 (the `/webhooks/resend` endpoint + Resend domain open/click tracking;
tracking-domain link rewriting hurt deliverability and broke universal-link CTA opens). Email engagement
signals are now `/public/unsubscribe`'s `email_unsubscribed` (slug signed into the unsubscribe token) and
in-app activity. Never call the PostHog client directly.

## Escalation — `notify` (track AND email the team)

For a genuine *"shouldn't happen, a human must act"* error — money-integrity / invariant violations only (a
zero-sum ledger break, a Stripe deposit/refund we can't book, a charged-card-but-ledger-failed PAYG settle, a
withdrawal drawing more than its own lock) — add `{ notify: true, notifyKey }` to `createCustomError` (thrown)
or the `reportWorkerError`/`reportError` ctx (detect-and-continue). On top of the PostHog capture,
`reportError` fires a **deduped** team email via `utils/email/sendTeamAlertEmail.ts` (Redis-backed,
cross-instance, fail-open; `TEAM_ALERT.DEDUPE_WINDOW_MS`, 6h).

**Always scope `notifyKey` per entity** — `"<reason>:{paymentIntentId|refundId|withdrawalId|shareId}"` — so
distinct incidents each alert while a retried webhook / re-run job collapses to one email; unset falls back to
`service:code:throw_site` (per error-type). Reserve `notify` for money/invariant incidents — a routine domain
rejection or a self-healing transient must NOT set it (that's just noise in the inbox). `sendTeamAlertEmail`
is the transport only; **never call it ad-hoc for errors** — route through `notify` so it dedupes and lands in
PostHog too (the withdrawal recovery paths — orphaned-sweep reversal, inconsistent reversal/terminal states,
payout-retries exhausted — all do this now; there are no email-only alert sites left). When the human needs
more context than the error message, pass `notifyLines: string[]` in the `reportError` ctx — extra body lines
appended to the notify email (what happened, what automation already did, what to reconcile); the PostHog
capture carries the structured ctx either way.
