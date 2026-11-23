# Transactional notifications — pipeline & invariants

How a notification travels from a domain event to a device or inbox, and the
rules that keep the pipeline correct. Updated 2026-08-02 after the v2-review
notifications cluster (E011 · E055 · E056 · E057 · E073 — evidence and commit
ids in `v2-review/DECISIONS.md`).

```
domain code ──queueNotificationJobs()──▶ jobs.notification_queue ──▶ notifications worker ──▶ Resend / Expo
                    │                                                      │
       resolveEffectiveChannels()                            executeNotificationJob()
       (opt-out prefs, one rule)                             (re-checks, throttles, budget)
```

## The pieces

| Layer | Where |
| --- | --- |
| Event metadata (slug, target, channels) | `tagly-shared/models` `notificationEventsCatalog` (DB rows seeded at boot by `seed/notifications.ts`) |
| Render templates (push + email, en/cs) | `constants/catalogs/notifications/transactionalCatalog.ts` (+ `promoCatalog`; `adminCatalog` — admin blasts, revived 2026-08-13 with `POST /v2/admin/notifications/blast`) |
| Enqueue | `utils/queue/queueNotificationJobs.ts` (never throws; optional `tx` = outbox mode) |
| Channel resolution | `utils/notifications/resolveEffectiveChannels.ts` — THE one rule |
| Preferences | `NotificationEventOptOut` (opt-OUT storage, merged customer+advertiser table) |
| Delivery | `workers/notifications/` on the `runJobQueue` runtime |
| Promo scheduling | maintenance worker tasks + `queuePromoNotificationJobsOrReturn` + `promoSendTime.ts` |

## Preferences are opt-OUT (E011)

A `NotificationEventOptOut` row stores the channels an account turned **off**
for one event. **A missing row means every available channel is on.** So:

- Adding a catalog event = the two catalog files, **nothing else** — it is
  on-by-default for every existing account the moment the boot seed creates its
  `NotificationEvent` row. There is no backfill, no version stamp, no
  per-account seeding at registration.
- An account that disables every channel keeps a persistent row — deliberate
  opt-outs can never be resurrected by later catalog changes.
  ⚠️ **One accepted exception (E196, WON'T FIX — Matej 2026-08-02):** the boot
  seeder hard-deletes events removed from the catalog, and opt-outs cascade
  with them. Removing a slug and later re-adding it (including a deploy that
  removes an event and then rolls back) re-creates the event with everyone
  back at the all-on default. Treat slug removals as permanent and never
  reuse a retired slug; a soft-retire hook exists if ever needed
  (`NotificationEvent.status = INACTIVE` is honored by every reader).
- The table follows the PushToken merged-owner pattern: nullable
  `customerId`/`advertiserId` (exactly one set — DB `CHECK`), per-owner
  compound uniques, event FK cascades (the seeder's event prune removes
  opt-outs with the event).

## One channel-resolution rule

`resolveEffectiveChannels({available, mandatory, limitChannels?, disabled})` =
`(mandatory ∩ available) ∪ ((limitChannels ∩ available, else available) − disabled)`,
minus `IN_APP`. Used by `queueNotificationJobs` and the worker's send-time re-check (`isChannelEnabledForRecipient`) — queue
time and send time can never disagree. Never re-inline this logic.

**Mandatory channels can never be silenced**, by three independent layers:
the update endpoints reject disabling them, the migration/write paths never
store them in a `disabledChannels` set, and the resolution rule adds
`mandatory ∩ available` before ever consulting `disabled`.

## Consent is explicit (E056)

`promoNotificationsEnabled` is nullable on both pending tables — null means
the user never answered the consent step, and **null is not consent** (Apple
4.5.4 / v2.0.0.md consent policy). Every promo gate requires an explicit
`true`: the scheduler where-clauses, `queuePromoNotificationJobsOrReturn`'s
`optedOut` (`!== true`), and the send-time `mayReceivePromo` (`=== true`).
Never weaken any single gate — they are three layers of one rule.

## Email HTML escaping (E055)

Any payload value interpolated into a catalog `html()` body goes through
`escapeEmailHtml` — mail clients strip script, but unescaped values are markup
injection into DKIM-signed Tagly mail (attacker-controlled links). Do NOT
escape push bodies, subjects, or preheaders: plain-text contexts (preheaders
are escaped downstream in `renderEmailShell`; double-escaping corrupts them).

## Send-rate budgeting (E057)

One Resend **account** (2 rps default limit — see
`constants/integrations/RESEND.ts`) serves both reputation streams
AND the inline OTP/security mail on the API request path. Rules:

- The worker bounds parallel provider calls with `NOTIFICATIONS.concurrency`.
- Every **worker** email send first awaits `acquireEmailSendBudget()` — a
  Redis-backed fixed window (3 per 2 s = 1.5 rps) deliberately below the
  account limit, so inline OTP mail always has standing headroom. Fail-open:
  Redis trouble or a >30 s wait sends anyway.
- **Inline OTP mail never touches the budget** — a login code must never wait
  behind promo mail; the reserved headroom is its lane. Keep OTP sends inline
  (synchronous UX, fail fast, human retries) — do not enqueue them.
- Promo scheduler batches get a deterministic queue-time spread
  (`snapToQuietHours(..., { spreadInWindow: true })`, [0, 15 min)) so one
  shared `base` instant doesn't come due as a single burst. ⚠️ The send-time
  re-snap in `executeNotificationJob` must NEVER pass `spreadInWindow` —
  re-snapping `now` forward would defer every in-window send forever.

## Unsubscribe is a permanent surface

The handler lives in `controllers/webhooks/email/` and is mounted directly in
`app.ts` — NOT in any versioned route tree — on **two frozen paths** (GET =
human footer link, POST = the RFC 8058 one-click callback, same idempotent
handler):

- `/webhooks/email/unsubscribe` — **canonical**, baked into all mail sent
  from 2026-08-02 on (`buildUnsubscribeUrl`).
- `/public/unsubscribe` — **legacy**; every link/header sent before the
  rename points here. Additive migration: keep forever, never remove.

The URLs are baked into every promo email ever sent (footer link + the
`List-Unsubscribe`/`List-Unsubscribe-Post` headers Gmail/Yahoo require) and
the tokens deliberately never expire (CAN-SPAM), so both paths must resolve
through every future cutover. A dead unsubscribe endpoint
converts opt-out attempts into "Report spam" clicks and burns the sender
domains' reputation. The token is an HMAC JWT signed with the dedicated
`NOTIFICATION_UNSUBSCRIBE_SECRET` (never the session secret; exposing tokens
cannot leak the key, and the only capability it grants is opting that one
account out of marketing). The unsubscribe handler itself captures
`email_unsubscribed` with the originating slug. (Open/click tracking and the
`/webhooks/resend` endpoint were removed 2026-08-05 — link rewriting through
the tracking domain hurt deliverability; unsubscribes and in-app activity are
the remaining email engagement signals.)

## Admin blasts (revived 2026-08-13)

One-off announcements composed in the admin app's Manage tab
(`POST /v2/admin/notifications/blast`, SUPER-only; retired 2026-08-02 as E050,
revived with the v2 endpoint). The controller queues NotificationQueue rows
directly (content in the payload, rendered by `adminCatalog.ts` templates) and
writes a permanent `AdminBlastLog` row. Key facts:

- **Two audience modes.** `PROMO_OPTED_IN` filters to explicit consent at
  queue time; `EVERYONE` bypasses the opt-out (legitimate-interest basis) and
  is strictly for operational service announcements — the worker skips the
  promo gates for `notificationType: "admin"` in both modes, so the audience
  decision lives entirely in the controller.
- **Every blast email is BULK mail: marketing template + unsubscribe.** Both
  audience modes render with the "ink masthead" marketing template (a blast
  is an announcement — the masthead's job) and carry the one-click
  unsubscribe + RFC 8058 headers. For `PROMO_OPTED_IN` (marketing content)
  the unsubscribe is legally required; for `EVERYONE` it's pure
  deliverability — a mass send without one converts "stop this" intent into
  spam reports. The link opts the account out of MARKETING only
  (`promoNotificationsEnabled = false`); rare future operational notices may
  still arrive (the standard service-mail carve-out).
- **Per-language content.** The payload carries `{ push?: { en, cs? },
  email?: { en, cs? } }`; the catalog's `en`/`cs` template variants render
  each recipient's resolved language, CS falling back to EN when no CS copy
  was provided (`pickAdminTemplate`).
- **Sender-domain override.** `senderDomain` (e.g. `mail.flaer.app`) makes the
  email leg send as `notifications@<domain>` instead of the default marketing
  sender. The compose UI lists Resend's verified domains live
  (`GET /v2/admin/notifications/sender-domains`) and `adminSendBlast`
  re-verifies the choice against `resend.domains.list()` before queueing
  anything. ⚠️ Resend verification doesn't cover Apple private relay — an
  override domain must also be registered for Sign in with Apple email
  communication (see docs/DEVOPS.md) or `@privaterelay.appleid.com`
  recipients silently bounce.
- **Per-blast tracking slug.** The admin-chosen kebab slug rides the push
  payload as `admin.blast:<slug>` (the apps' `push_opened` PostHog
  event reports it verbatim — per-blast open counts with no client change)
  and the email leg's `blast` Resend tag. Email opens are deliberately NOT
  tracked (the 2026-08-05 tracking removal stands).
- **Idempotent by content hash.** dedupeKey = SHA-256 of the blast definition;
  re-running an identical blast tops up only recipients not yet covered (new
  signups) and never double-sends.
- **Delivery stats** (`GET /v2/admin/notifications/blasts`) come from live
  queue-row counts per dedupeKey, so they decay with queue retention;
  `queuedCount` on the log row is the permanent number.
- Blast email defaults to the **bulk** sender (`MARKETING_FROM_EMAIL`) —
  isolated reputation — unless a verified `senderDomain` override is set.

## Retries & dead-letter visibility (E073)

Backoff (`constants/workers/NOTIFICATIONS.ts`) is sized to outlive
a real provider incident: 1m/2m/4m/8m/10m/10m/10m across 8 attempts ≈ 45
minutes before a terminal FAIL. FAILED rows are deleted by cleanup after 24h
(that window is the only manual re-drive opportunity); the durable trace is
the PostHog terminal-failure event, which carries `slug`, `channel`, `target`,
and `notificationType` (transactional | promo | admin) from `jobLogContext`.
**Alerting is PostHog-side by decision**: an insight alert on
`error_class=permanent + worker=notifications + notificationType=transactional`
— the backend `notify` email path stays reserved for money-invariant
incidents.

## Related docs

- `tagly-backend/CLAUDE.md` §Notifications — day-to-day rules for adding
  events and queueing.
- `v2-review/DECISIONS.md` — the fix log with verification evidence.
