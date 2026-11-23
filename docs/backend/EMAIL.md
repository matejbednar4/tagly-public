# Email — templates, send budget, Resend invariants, promo delivery

> Deep-dive referenced from [tagly-backend/CLAUDE.md](../../tagly-backend/CLAUDE.md).
> The short rules live there; this file holds the template system and the
> Resend/promo delivery mechanics. Notification pipeline:
> [TRANSACTIONAL_NOTIFICATIONS.md](../TRANSACTIONAL_NOTIFICATIONS.md).

## Two looks, one chrome

`sendEmail` wraps every product email in one of TWO templates
(`utils/email/templates/`): **`buildTransactionalEmailHTML`** ("the
note" — flat cream, narrow column, Playfair headline, localized "The Tagly team"
sign-off; the default for 1:1 mail — OTP, payouts, account/state changes)
and **`buildMarketingEmailHTML`** ("the ink masthead", design B 2026-08-05 — an
ink header block with butter overline (`badge`) + reversed cream Playfair
headline, white body closed by a DIVIDER hairline, social-row footer; NO
box-shadow anywhere in email — Gmail strips it, so the old shadow "postcard"
rendered edgeless; **bulk sends only — promo events + admin blasts**). When
`template` isn't passed, `sendEmail` derives it from `unsubscribeUrl` (bulk
mail is exactly the mail that carries one-click unsubscribe); the
notifications worker passes it explicitly.

Both compose the same shared parts — `renderEmailShell` (head,
@font-face, canvas, preheader), `renderEmailFooter` (compact | full, en+cs),
`renderEmailButton` (the one CTA — takes `app: "customer" | "advertiser"`, NOT a
URL: an email CTA button only ever opens the recipient's app via the
first-party `/open` route on the stage's redirect host from
`EMAIL_BRAND.APP_LINKS` — a claimed universal-link domain, so an installed iOS
app opens directly; the redirect page falls back to the app's AppsFlyer
OneLink for everyone else. ⚠️ Deploy order: tagly-redirect's `/open` route
must be live in an env before this backend sends mail there.
Support/legal/unsubscribe stay plain text links), `escapeEmailHtml` — and pull
every color/link/asset from `constants/platform/EMAIL_BRAND.ts` (hexes
mirror the cream theme in `tagly-shared/client/theme/theme.ts`; keep in sync, the
backend can't import `@tagly/client`). Money figures in email bodies use
`EMAIL_BRAND.COLOR.SUCCESS`. Pass `lang` to `sendEmail` wherever the recipient's
language is known — it localizes the template chrome.

**Every send is multipart — never HTML-only (2026-08-09).** `sendEmail` passes a
`text` part built by `buildPlainTextEmail` from the SAME `templateOptions` that
feed the HTML, and `sendTeamAlertEmail` passes its `lines` directly. HTML-only
mail carries a spam-score penalty at essentially every consumer mailbox provider
(iCloud in particular) and renders blank in text-only clients. Two invariants:
the text part's chrome is **imported, never restated** — `EMAIL_CTA_LABELS` +
`resolveEmailCtaLink` from `renderEmailButton`, `EMAIL_FOOTER_STRINGS` from
`renderEmailFooter`, `EMAIL_SIGN_OFF` from `buildTransactionalEmailHTML` — so
the two MIME parts can't drift; and `htmlToPlainText` keeps every link as
`text (url)` rather than dropping it (a text part whose links vanished is
useless, and parts that disagree on content read as evasive to filters). The
converter is deliberately hand-rolled and narrow — its only input is our own
catalog `html()` fragments, so a general HTML parser would be a large new
supply-chain surface for nothing. The marketing template has no sign-off, so its
text twin omits one too.

**Catalog emails get their CTA via the `showCta: true` flag** on the localized
template entry (`transactionalCatalog` / promo entries): the worker resolves the
app from the slug prefix (`a.` → advertiser, else customer) and the template
appends the standard localized "Open Tagly (Ads)" button — one email, one
action, so set it only where the next step is in the app
(money/engagement/action mail), never on security, legal, or ban mail, and never
ALSO embed `renderEmailButton` in that event's `html()`. Direct
`renderEmailButton` calls in `html()` are for custom-label cases only (e.g. an
admin-blast `ctaLabel`).

All three hosted email assets are **live** (E026, 2026-08-02): the ink Tagly
lockup (`LOGO_INK_URL` — `brand/textLogos/ink.png`; the `black`/`white`/`orange`
siblings on the bucket are the old **FLAER** wordmark, never substitute them)
and both Playfair woff2 subsets. The local sources under `ops/email-assets/`
(lockup PNGs + `subset-playfair.sh`) were removed after upload — recover them
from git history (`git show 88ace529` / `14131db5`) if a regeneration is ever
needed — see the note in `EMAIL_BRAND.ts`.

## Worker email send budget (E057)

Worker email sends are budgeted below the Resend account limit: the email leg
awaits `acquireEmailSendBudget()` (Redis fixed window, 1.5 rps of the 2 rps
account limit — `constants/integrations/RESEND.ts`, fail-open) and the
worker runs `concurrency: 8`. Inline OTP mail deliberately bypasses the budget
(the headroom is its lane — a login code never waits behind promo mail; keep
OTPs inline, don't enqueue them). Queue-time promo scheduling passes
`snapToQuietHours(..., { spreadInWindow: true })` to de-stack batch bursts —
⚠️ the send-time re-snap must NEVER pass that flag (re-snapping `now` forward
would defer every in-window send forever).

## Resend webhook removal + the env-tag invariant (E104/E251)

The Resend webhook was REMOVED (2026-08-05), but its env-tag invariant stands.
`/webhooks/resend` and the account's webhook endpoints + domain open/click
tracking were deleted by decision (Matej): the tracking-domain link rewrite hurt
deliverability and broke the CTA's universal-link direct open, and Resend
already auto-suppresses hard bounces/complaints provider-side. `sendEmail` still
stamps the `env` tag (`EMAIL_ENV_TAG_NAME` = `APP_STAGE`,
`utils/email/promoEmailTags.ts`) on every product send — Resend
webhooks are ACCOUNT-scoped (every endpoint receives EVERY environment's
events), so any
future webhook is only safe if it filters strict match-only on that tag,
dropping foreign-env AND untagged alike (team/ops mail via `sendTeamAlertEmail`
is deliberately untagged). Never remove the tag from `sendEmail`, and never
assume a Resend endpoint receives only its own env's events.

## Promo sends — occurrence-scoped, gated at send time, quiet-hours-safe

The `PromoNotificationLog` keeps one row per (recipient, slug, channel) whose
`sentAt` refreshes on each send; worker reads pass `since = job.createdAt`, so a
slug can legitimately fire once per *episode* (the inactivity reminders re-arm
after each new share — the scheduler compares log `sentAt` vs the customer's
latest share). `executeNotificationJob` re-checks everything the schedulers
checked at queue time: opt-out/recipient-gone and cadence staleness
(`promoStillRelevant` — a user who made their first share is never nudged to
make it) skip cleanly with a `promo_send_skipped` analytics event, quiet-hours
drift and a not-yet-sent push sibling **defer** (return `DeferJob`) rather than
send early. Quiet-hours snapping adds a deterministic per-(recipient, step,
channel) jitter (`PROMO_DELIVERY.SNAP_JITTER_MS`) so snapped sends don't all
stack at 8:00. Promo emails carry a per-job Resend `Idempotency-Key`, so a
retried job can't double-deliver.

## Notification retry budget (E073)

Notifications backoff is 1m→10m-capped over 8 attempts (~45 min). Terminal
failures carry `notificationType` in the PostHog event (`jobLogContext`);
dead-letter alerting is a PostHog insight alert on permanent+transactional — do
NOT add backend alert emails for it (`notify` stays reserved for money
invariants). FAILED rows are cleaned up after 24h — that window is the only
re-drive opportunity.
