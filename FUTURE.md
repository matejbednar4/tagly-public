# FUTURE — deferred work (post-v2.0.0)

Things we deliberately chose **not** to build for v2.0.0, kept here so they aren't lost.
This is not a bug list — punchlist/defect tracking lives in `v2-review/MASTER-PUNCHLIST.md`.

Each entry: what, why it was deferred, and what it depends on.

---

## Priority 1 — suppression blindness (and the OTP lockout it hides)

### Resend suppresses for us; we can't see it, and it can lock a customer out of login
**Resend already handles the reputation half — do not rebuild it.** Per Resend's docs, a
hard bounce or spam complaint puts the address on **their** Suppression List
automatically, and *"whenever you send an email with Resend, the recipient is checked
against the suppression list. If they're on it, the delivery is suppressed."* So the
follow-up steps our promo schedulers keep queueing for a dead address are **blocked, not
delivered** — they generate no further bounces and cost us no reputation. We do not need
our own suppression list to protect the domain. (Verified 2026-08-05 against
`resend.com/docs/knowledge-base/why-are-my-emails-landing-on-the-suppression-list`; an
earlier version of this entry claimed the opposite and was wrong.)

**What's actually broken is that suppression is invisible to us, and it crosses streams:**

1. **OTP lockout with no signal, for anyone.** Suppression is service-level, not
   per-domain — one Resend account covers both `news.taglyapp.com` (marketing) and
   `mail.taglyapp.com` (OTP). So a customer who marks **one promo email** as spam, or
   whose address hard-bounced once on a typo, is suppressed for **login mail too**. Our
   send call succeeds, the queue row goes `DONE`, the client shows "code sent" — and the
   code never arrives, permanently, until a human removes them in the Resend dashboard.
   v2 customers have no other login path. This is an account-lockout class bug, not a
   deliverability nicety, and it is why this entry is priority 1.
   (Live precedent: mail clients surface "Move Future Emails to Spam" right next to
   Unsubscribe — Zoho's one-click sheet does exactly this — so a complaint is one
   mistaken tap away for every promo recipient.)
2. **No rate visibility before the cliff.** The account-level limits are bounce > 4% and
   complaint > 0.08%, above which Resend says the account "may be shutdown without
   warning" — that would take OTP login down for everyone. We currently learn our rates
   only by a human opening the Resend dashboard: `email.bounced` / `email.complained`
   were never handled, and the `/webhooks/resend` endpoint was **removed entirely
   2026-08-05** (backend + both Resend endpoints; the open/click funnel wasn't worth the
   tracking-domain cost), so there is now no programmatic email signal of any kind.
3. **Our own data lies.** A suppressed send still writes a `promo_notification_log` row
   and a `DONE` queue row, so internally it reads as delivered.

**Sharpened by the tracking posture (verified 2026-08-05):** `open_tracking` and
`click_tracking` are **false on all four Resend domains** (`news.taglyapp.com`,
`mail.taglyapp.com`, `mail.flaer.app`, `flaer.app`) — deliberately, to keep every link
first-party and avoid a tracking pixel. Consequence: `email_opened` / `email_clicked` can
never fire, so bounce/complaint events are the **only** email instrumentation available to
us. (Fix the stale claim in `tagly-backend/CLAUDE.md` that clicks are "the email KPI" when
this lands; per-step click measurement, if wanted, belongs on the CTA's AppsFlyer OneLink
as campaign params, not on a rewritten link.)

**Shape when picked up — the goal is sight and a rescue path, NOT our own suppression list:**
1. Re-add a `controllers/webhooks/resend/` handler for `email.bounced` /
   `email.complained` ONLY (no open/click — tracking stays off), re-register one Resend
   endpoint **per env**, and re-declare `RESEND_WEBHOOK_SECRET`. The strict env-tag filter
   (E104/E251) must be rebuilt with it — the send-side `env` tag still ships on every
   product send exactly so this stays possible (see
   `utils/email/promoEmailTags.ts`); the old handler with the filter shape is in
   git history (removed 2026-08-05). (Verified 2026-08-15: Resend now also offers
   `email.suppressed` + `suppression.added`/`suppression.removed` webhook events — the
   suppressed-send event is an even more direct signal for the OTP case than
   bounce/complaint alone; consider subscribing to it too.)
2. Capture both as PostHog events + an insight alert on the 4% / 0.08% thresholds, so the
   account-shutdown cliff is something we see coming rather than discover through support
   tickets.
3. **Fix the login case.** When the suppressed address is on an OTP send, the person must
   not be left staring at "code sent": surface an actionable state (try another address /
   contact support), flag it on the admin customer detail, and give support a documented
   un-suppress step (Resend dashboard → the email → *Remove from suppression list*).
   **Verified 2026-08-15: the Resend API now has full suppression endpoints**
   (`/api-reference/suppressions/` — retrieve by email, list, remove, batch add/remove) —
   so this can be a pre-send/at-send check plus an admin un-suppress action via API, no
   manual dashboard trip needed.
4. Only if (1)–(3) prove insufficient: persist our own suppression record (soft-bounce
   counting is the one thing Resend's list does not cover). **Needs a schema decision from
   Matej before any code** — and it is explicitly NOT the starting point.

**Depends on:** nothing for (1)–(3) — no migration, all additive. Overlaps deliberately
with "OTP email deliverability signal" under Deferred hardening below (E201/E218/E251);
that entry covers the same webhook from the sender-rollback angle. Do them together.

---

## Lost-email OAuth accounts — re-auth verification for delete/email-change + admin deletion backstop

**Trigger:** live support case (2026-08-15) — a customer who signed in with Apple's Hide My
Email lost access to their `@privaterelay.appleid.com` address and now cannot delete their
account. Both escape hatches are email-locked by design: account deletion sends an OTP to the
current email (`controllers/v2/customerApp/me/delete-account/startDeleteAccount.ts`), and email
change is dual-OTP — a code to the **current** address AND the new one (`startChangeEmail.ts`,
deliberate: accounts are password-less, so the email is the sole anchor and a stolen session
alone must not be able to move it). With a dead relay address both flows dead-end, and there is
**no admin backstop** — the v2 admin surface has ban/unban but no customer deletion or
email-change tool.

**Why this recurs (structural, not a one-off):** relay addresses stop delivering when the user
revokes "Sign in with Apple" for the app or toggles off forwarding while cleaning up (most
common, often unknowingly), when their Apple ID primary email changes/dies, or when **our**
sender-domain registration with Apple lapses — that last one kills delivery for every relay
user at once and has already happened once (rebrand, fixed 2026-08-09; see docs/DEVOPS.md
§"Apple private relay"). Steady trickle, will keep happening.

**Support triage for each case (no code):**
1. Rule out our side first: Resend dashboard, filter to the address — Apple 550-rejects mail
   from unregistered sender domains while Resend still reports `sent`, so bounces to
   `privaterelay.appleid.com` mean it's our registration, not their access.
2. Have them re-enable forwarding (Settings → Apple ID → Sign in with Apple / Hide My Email →
   Tagly) or sign in with Apple again — often reactivates the same relay address, then they can
   self-serve.
3. If both fail, the deletion request must still be honored (GDPR; also Apple 5.1.1(v) —
   a dead-end deletion flow is a compliance risk). Identity proof: anything done from inside
   the logged-in app (e.g. the in-app support sheet) proves control of the account.

**Shape when picked up:**
1. **OAuth re-auth as the verification factor** for accounts with an `OAuthIdentity`: the
   delete flow accepts a fresh Apple/Google `identityToken` (verified via the existing
   `verifyOidcIdToken` against the linked identity) in place of the current-email OTP; email
   change likewise substitutes re-auth for the current-email leg while the NEW address still
   gets its own OTP — which is also the actual way out for these users (attach a reachable
   address). The user proves control of the Apple identity, which is the account's real
   anchor; the relay mailbox was only ever a proxy for it. Standard pattern for SIWA apps.
2. **Admin backstop:** a SUPER-only delete-customer endpoint reusing the existing deletion
   internals (balance sweep/forfeit, IG data erasure, S3 cleanup, ledger event) minus the OTP
   gate, for support-verified requests. Without it, honoring a request means hand-run SQL that
   skips all of that.

**Depends on:** nothing — additive endpoints, no migration. Touches the deletion/forfeit
financial path, so the shape gets Matej's explicit sign-off per the root CLAUDE.md rule;
client copy en+cs for the new verification paths.

---

## Carried from v2.0.0.md — items still open when the plan file was retired (2026-08-14)

`v2.0.0.md` was deleted on 2026-08-14 after a codebase verification pass; everything on its §7
checklist that was genuinely still undone lives here now. Items verified done were checked off
silently (advertiser + admin rewrites, Apple/Google OAuth, shareability === visibility, the
consent + forced-locale flow, notification-settings surfaces, negative-balance settle, billing
explainers, onboarding artwork, join-page Czech, email brand assets, `useColorTheme` retirement,
the instagram-data-deletion page rewrite — which lives in `tagly-website/` in this monorepo, not
a separate repo as the plan claimed). Deliberately not carried: the two nav-stack bugs (the
screens no longer have the shapes that produced them — advertiser billing is sheet-based on the
wallet tab, and share-create `dismissAll()`s before pushing the detail), and the ongoing
code-health checklist lines (text cull, duplication collapse, right-home files) which are
standing CLAUDE.md rules, not tickets. Two §2 design decisions remain open but are design calls,
not work items: final Neutral-theme typography, and whether the primary button fill stays ink or
becomes brand.

### Post-cutover tail — Connect manual-payout sweep, Meta console

**The v1 cutover happened 2026-08-31** (v2 had been at 100% for 14+ days). Done in the working tree
in one pass: retired flaer-host emission (`LEGACY_REDIRECT_BASE_URL` + every derived v1 URL,
`DASHBOARD_ORIGIN`, `ADMIN_ORIGIN`); deleted v1 (backend `controllers/routes/utils/constants/
prisma/selects` v1 buckets, models `endpoints/v1` + `dtos/v1` + their barrels/exports); deleted the
cookie-auth + CORS surface (`verifyJwt` is bearer-only, `cookie-parser`/`cors` gone); dropped the
v1-only schema (`AdvertiserPassword`, `Advertiser.passwordId`, `PendingAdvertiserAccount.passwordHash`,
both `notificationsBackfilledAt`, both legacy `*NotificationEventPreference` tables) plus
`totalCreditPurchasesUsdCents` (now ledger-derived — see `utils/money/ledger/advertiserCreditPurchases.ts`);
orphan-scanned the permanent floor; purged every `@deprecated` back-compat symbol whose readers
were v1; the redirect page emits the tagly schemes on every host. The min-version raise itself is an
App Runner env value, not repo state.

**Still open (all live third-party mutations — Matej's explicit go each):**

1. **Dormant-Connect manual-payout sweep:** one-off
   `stripe.accounts.update(id, { settings: { payouts: { schedule: { interval: "manual" } } } })`
   over every `stripeConnectId` — only once the manual-flow backend is durable and won't be
   *code*-rolled-back (a rollback to the pre-manual backend would strand a standard withdrawal on
   an already-manual account). No script for it exists in the repo yet.
2. **Meta console:** remove the flaer IG OAuth redirect URIs (no client bakes them any more), and
   flip the deferred branding — display name `Flaer` → `Tagly`, app icon, FB App Page (the
   non-visible config already moved 2026-08-07).
3. **Optional, zero benefit either way:** detaching the `*.redirect.flaer.app` custom domains from
   the redirect Amplify app. They cost nothing and keep old links resolving (additive-migration
   rule), so the default is to leave them.

Same beat (per the retired plan): flip the deferred Meta-console branding on the IG OAuth app —
display name `Flaer` → `Tagly`, app icon, FB App Page (the non-visible config already moved
2026-08-07).

**Depends on:** v2 at 100% store rollout; the min-version raise is Matej's explicit call (it's a
prod env edit, which on App Runner is itself a deploy).

### Stripe metadata: the advertiser-billing leg still hands Stripe numeric DB ids

The withdrawal/Connect leg is done (uid-only, rule W-10 in
`utils/money/withdrawals/withdrawals.md`). Still non-compliant (verified 2026-08-14):

- `utils/money/stripe/createAdvertiserCreditPurchaseIntent.ts:92` and
  `controllers/v2/advertiserApp/billing/payg/setupPaygCard.ts:60` send
  `advertiserId: String(advertiserId)` alongside the uid.
- `utils/money/stripe/chargeAdvertiserCardOffSession.ts:260` — a *permanent*-bucket path, same.
- `utils/money/stripe/ensureStripeCustomerForAdvertiser.ts:33` — the Stripe Customer is created with
  the numeric id in metadata.
- **Worst case:** `utils/money/stripe/webhookHandlers/platform/handlePaymentIntentSucceeded.ts:49`
  reads `Number(pi.metadata.advertiserId)` back and writes it into the created credit-purchase row
  as the DB foreign key — exactly the "silently resolves to the wrong row" failure the rule exists
  to prevent.
- Small gap: `ensureStripeExpressAccountForCustomer` stamps no metadata at all (no `customerUid`
  on the Connect account).

**Shape when picked up:** resolve by uid in the webhook (look the advertiser up by
`advertiserUid`), stop sending numeric ids on newly created Stripe objects, stamp `customerUid`
on new Express accounts. Metadata is ours so this is wire-safe, but the webhook consumer must
keep accepting in-flight PaymentIntents created before the change.

### Standardize Stripe + ledger metadata, errors, and messages

Not started beyond fragments (the two frozen `purpose` vocabularies, `SHARE_LOCK_META_KEYS`,
`stripeErrorClassification.ts`). Missing, verified 2026-08-14:

- **No central metadata builder** — every Stripe call inlines its own key set and they diverge per
  flow (`{withdrawalUid, purpose}` vs `{advertiserUid, advertiserId, purpose, creditPurchaseUid}` …).
- **Ledger `meta` is free-form** — the discriminator key is variously `reason` / `source`, value
  casing mixes kebab and snake, and it carries numeric ids, not uids.
- **Error codes in the money paths are raw numeric literals** (131 `createCustomError` sites
  across stripe/ledger utils + the stripe worker) and actively **collide**: `1611` and `1612`
  each mean two different things (`forfeitRemainingBudgetToPlatformOnAccountDeletion.ts` vs
  `lockBalanceForWithdrawal.ts`); "insufficient funds" is `1516` in the share lock but `1615` in
  the withdrawal lock; "advertiserId required" appears as 1203/1311/1321/1601/1610.
  `tagly-shared/models` `ERROR_CODES.ts` holds none of the 12xx/13xx/16xx/18xx money codes despite
  `tagly-backend/CLAUDE.md` mandating named constants.

**Shape when picked up:** name the money codes in `ERROR_CODES.ts` (minting new codes where a
number is double-booked — never re-meaning a shipped one), one metadata-builder helper with a
shared base (`purpose` + entity uids) per flow, one ledger-meta discriminator convention.

### Throttle the two unthrottled Instagram Graph endpoints

The pre-cutover sweep covered `GET /v2/customers/me/instagram/stories`, share-create, and
share-opportunity, but `POST /v2/customers/me/instagram/connect` and `POST …/refresh` both hit
the Graph API (token exchange, `/me`, the insights permission probe) with only the group-level
`authedUserLimiter`/`gentlePerRouteLimiter` — and `refresh` is probed on every app foreground.
Add a purpose-fit limiter per endpoint (the ~1/30s content limiter may be too tight for connect;
pick a window, but leave no IG call unthrottled). Also fix one stale comment: the "pure DB"
comment at `routes/v2/customers/me/instagram/index.ts:26` sits above routes that DO call the
Graph.

### Support contact inside advertiser billing flows

The shared `SupportSheet` covers the customer money flows (withdraw region gate, banned account,
drawer, share-not-tagged) but **no advertiser billing surface mounts it** — the failure states in
`CreditsSheet` / `PaygSheet` / `SettleBalanceSheet` / the wallet screen ("Payment not
completed", "We couldn't verify your payment yet", "Your last charge failed") all dead-end at
"Please try again." Mount `SupportSheet` with per-flow context tags in those failure states.

---

## v2.1 candidates

### Business-set content hint (+ optional bonus when the story follows it)
**What:** A business can write a short hint telling customers what to post about — a shisha
bar says *"take a picture of your shisha"*, a cafe says *"show your latte art"*. Three
surfaces:

1. **Customer app** — the hint shows on the business detail / share-creation screen, so the
   customer knows what content the business actually wants before they post.
2. **Admin approval** — the hint is displayed next to the story during share assessment, so
   the reviewer can judge (manually, by eye) whether the story followed it.
3. **Bonus** — if the reviewer marks the hint as followed, the share gets a small extra
   payout on top of the normal reward.

**Why it's worth doing:** it's the cheapest lever we have on *content quality*. Today the
business has zero influence over what a story shows (deliberately — "no scripts or brand
guidelines", per the authenticity principle), which means a share can be technically valid
and commercially useless (a selfie in the parking lot). A hint keeps authenticity intact —
it's a suggestion, not a script, and the customer still shoots and captions it themselves —
while nudging content toward what the business is actually paying for. The bonus makes it
worth the customer's attention instead of being ignorable flavor text.

**Open decisions before any code (product, Matej):**
- **Who funds the bonus?** Out of the business's budget (they asked for it, so they pay —
  but then the reward stops being purely reach-derived and the business can't predict spend
  per share), or out of Flaer's 40% (predictable for the business, straight off our margin)?
  This is the load-bearing decision; the rest follows from it.
- **How much?** Flat cents, or a % uplift on the computed reward? Flat is easier to explain
  in the app ("+$1 if you follow the hint"); a % keeps the local-reach logic intact.
- **Is it visible before posting?** Showing "+$X if you follow the hint" is the whole
  motivation, but it also turns a subjective manual call into a promise the customer expects
  us to honor — so we need a disputes answer ("I did follow it and got nothing").
- **Moderation of the hint itself.** It's business-authored free text shown to customers, so
  it goes through the same profanity/moderation path as the rest of the business page copy,
  and it must not be usable to demand things we don't allow (no "tag our account", no
  discount-for-post quid pro quo, nothing that makes the post an undisclosed ad).
- **Does an unfollowed hint ever justify rejection?** Almost certainly **no** — the hint is
  a bonus condition only, never a validity condition, or businesses gain a lever to reject
  legitimate shares after the fact. Worth stating explicitly wherever it lands.

**Shape when picked up:** a nullable `contentHint` text column on the business page (plus its
moderation pass and the `pageForm` `StepDetails` field, shared by advertiser + admin per
`components/businesses/`), the hint carried on the business DTOs the customer app already
reads, displayed on the admin share-assessment screen, and a `hintFollowed` boolean captured
at approval that feeds an extra ledger event alongside the share payout — a **new event kind
or a typed bonus on the existing payout**, decided with the funding question above, never a
silent bump to the reward figure (the reward must stay explainable from reach). Customer-side
copy needs en+cs.

**Depends on:** the funding + amount decision. Everything else is mechanical: schema
migration → moderation → DTO field → two UI surfaces → the approval-time bonus event.
Financial logic, so it needs an explicit sign-off before implementation per the root
CLAUDE.md rule.

### Widen the business-type / vertical reward multiplier spread
**What:** The type multiplier (`rewardMultiplierBps` — the type catalog override, else its
primary vertical, consumed by `calculateTypeBps`) currently spans roughly **0.8×–1.2×**, a
1.5× spread. Real acquisition economics vary far more than that, so the axis exists but
barely acts.

**Evidence (market research, 2026-08-30):** paid customer-acquisition cost by restaurant
type runs **fast food ~$27 · fast casual and casual dining $83–125 · fine dining ~$180** —
a **6.7× spread**, driven by exactly the volume-versus-margin logic behind the existing cafe
discount. A cafe selling 60 Kc coffees and a fine-dining room selling 1 500 Kc covers can
rationally pay very different amounts for the identical local view; today they pay within
1.5× of each other. The premise Matej stated ("cafes operate on volume, should pay less")
is correct and under-implemented.

**Why deferred (Matej, 2026-08-30):** widening the spread upward would mean **charging some
businesses more**, which is not wanted at this stage — sales is still proving the product
and a price rise on fine dining / high-margin verticals is the wrong signal right now. The
downward half (discounting high-volume, low-margin types further) is available without
raising anyone's price, but it cuts revenue and customer payouts on the most common
business type we have, so it is not a free move either.

**Shape when picked up:** the values live in the shared `@tagly/models` verticals catalogs
(catalog-only since algo v11 — the write-only DB columns were dropped, so a deploy is the
only update path), and they are read by `calculateTypeBps`
(`utils/pricing/helpers/`, est + final). So retuning a catalog multiplier re-prices and
requires an algo-version bump in `constants/rewards/META.ts`. Decide the anchor first: which type
sits at 1.0×, and whether the spread widens in both directions or only downward. Validate any
proposed table by replaying it over real settled shares before shipping — the same method
used to fit the v12 geo and audience-relevance curves.

**Depends on:** a pricing-direction decision from Matej (are we willing to raise any
business's effective rate?). Financial logic, so it needs explicit sign-off per the root
CLAUDE.md rule.

### Structured rejection reasons (dropdown) when rejecting a share
**What:** Replace the free-text-only reject sheet with a **dropdown of canned reasons**.
The text input stays, but becomes optional — used to override/elaborate on the picked
reason — or the list carries an **"Other"** entry that makes the text input required.
Either shape is acceptable; picking between them is part of the work.

**Current behavior:** `tagly-admin/app/(app)/review/pending-approval.tsx` opens a sheet
with a single `TextInput`; `submitReject` blocks on `reason.trim()` being non-empty, and
`AdminRejectShareBodySchema.reason` is `z.string().min(1).max(1000)`. Whatever the
reviewer types is stored on `share.rejectionReason` and shown to the customer **verbatim**
— on the share detail screen (`tagly-customer/app/(app)/shares/[uid]/index.tsx:209`) and
in the mandatory `c.shares.rejected` push + email.

**Why it's worth doing:**
- **Localization.** This is the strongest argument. The reason is customer-facing and
  rendered verbatim, so today a Czech customer reads whatever language the reviewer happened
  to type in. A coded reason can be rendered in the **customer's** locale in all three
  surfaces (app, push, email) — free text can never be.
- **Consistency + speed.** Rejection is a penalty (multiplier hit) delivered by a mandatory
  message. Right now its wording depends on which team member is on the queue and how much
  of a hurry they're in, which is exactly the kind of thing that generates support replies.
- **It becomes analyzable.** A reason *code* can be broken down in PostHog / admin; free
  text cannot. "Why do shares get rejected" is currently unanswerable, and the answer is
  the input to fixing it upstream (customer onboarding copy, the share-creation screen's
  guidance, and the content-hint entry above).

**⚠️ Load-bearing invariant to preserve:** `CustomerShareDetails.rejectionReason == null`
**⟺ report-upheld rejection** — the customer app infers "rejected by report" from
`REJECTED` + null reason (see the comment on `AdminRejectShareBodySchema.reason` and
`customerShareDetails.ts:27`). That is precisely why `reason` is `min(1)` today. So a
coded reject must still resolve to a **non-null** customer-visible string, or the
invariant has to be replaced by an explicit discriminator field in the same pass. Do not
let the reason become nullable as a side effect of adding the enum.

**Shape when picked up:** add a `ShareRejectionReason` enum to `@tagly/models`
`core/enums.ts`, following the `ShareVoidReasonValues` pattern right above it (const array
+ `z.enum` + per-value doc comment). Add an optional `reasonCode` to
`AdminRejectShareBodySchema` alongside the existing `reason` (additive — keeps older admin
builds working, and admin ships via internal TestFlight so the roll-off is fast); persist
it in the same CAS `update` in `controllers/v2/adminApp/shares/rejectShare.ts` next to
`rejectionReason`. Customer-side copy is en+cs per value. The admin sheet uses the shared
`CustomPicker` from `@tagly/client`, with the text input required only for `OTHER`.
`pending-approval.tsx` is the only place a share is rejected, but the admin share detail
screen renders the stored reason read-only (`app/(app)/shares/[uid].tsx:144-148`) and
should show the code's label once one exists.

Note the notification leg: `queueNotificationJobs({ eventSlug: "c.shares.rejected",
payload: { reason, shareUid } })` renders the reason into push + email, so localization
has to happen **there** too (the notifications worker already resolves recipient locale),
not just in the app — otherwise the app shows Czech and the email shows English.

**Open decision before any code (product, Matej): the reason list itself.** Starting point
to react to, not a proposal to implement as-is: story doesn't show the business / wrong
venue · story was already deleted when reviewed · not a story (feed post, reel) · unreadable
or unusable quality · reused or recycled content · inappropriate content · suspected fake
or staged visit · `OTHER`. Each needs en+cs customer-facing copy, and the wording matters
more than usual: it is a penalty notice the customer receives by push and email.

**Depends on:** the reason list + its copy. Everything after that is mechanical (enum →
optional wire field → picker → localized rendering in the three surfaces). No migration
if `reasonCode` is stored as the existing text plus a new nullable column; a new column
means a `prisma migrate dev` pass.

### Quiet hours for (some) transactional push notifications
**What:** Extend the promo quiet-hours window (08:00–20:00 recipient-local) to selected
**transactional** push slugs, so a non-urgent notification can't buzz a phone at 3am.

**Current behavior (verified 2026-08-09, local pass):** quiet hours are **promo-only**, at
both layers — `queueNotificationJobs` (transactional) stamps `scheduledAt = scheduleAt ??
new Date()` with no snapping, and the worker's send-time re-snap sits inside `if (isPromo)`
(`workers/notifications/helpers/executeNotificationJob.ts`). So every transactional push
fires the moment it is queued, at any hour.

**Why it matters:** several transactional slugs are *informational*, not urgent, and are
triggered by someone else's action at an arbitrary time. `a.shares.created` fires when a
customer posts a story — post at 2am, the business owner's phone buzzes at 2am.
`c.shares.rated` is the customer-side twin. Neither needs to arrive before morning.

**Why NOT a blanket change:** most transactional mail is exactly the kind that must not
wait — `c.balance.share-payout`, `c.account.banned`, `a.balance.payg-charge-failed`, every
`*.security.*` and `*.legal.*` slug. Delaying those would be worse than a late-night buzz.
So this is a **per-slug opt-in**, not a global flag.

**Shape of the work:** add a `quietHours?: true` flag to the transactional catalog entries
that want it, have `queueNotificationJobs` call the existing `snapToQuietHours` for those
slugs, and relax the worker's `isPromo` guard to `isPromo || catalogEvent.quietHours`. The
machinery already exists and is proven (queue-time snap + send-time re-snap that defers
without burning a retry attempt); this is wiring plus a per-slug decision, not new
infrastructure.

**Open question for whoever picks it up:** does the EMAIL leg get held too, or push only?
Email is far less intrusive at 3am, so push-only is probably right.

### Sticker scan → business page for already-registered users
**What:** When a user who already has the app **and is registered** scans a venue's QR
sticker (`join.taglyapp.com/?utm_source=table-sticker&id=…`), route them to that
business's detail screen instead of dropping them on home.

**Why now-deferred:** The v2.0.0 work only fixes *attribution* (the app now parses
join-host URLs so the referral code isn't lost — see
`tagly-shared/client/services/attribution/`). Routing a registered user somewhere useful
is a **product change**, not a bug fix, so it was kept out of the pre-deploy change set.

**Why it's worth doing:** A referral code is useless to an already-registered user —
codes only attach during onboarding (`attach-referrer` on the pending account) or via the
one-time `updateReferrerCode` within 24h of signup. So today a registered user scanning a
sticker gets nothing at all. Sending them to the business page turns a dead end into the
most likely next action (view the business → create a share there).

**Depends on:** the v2.0.0 attribution fix landing first (the app must already resolve
`?id=` → sticker → business). After that this is mostly a navigation decision.

### Retry / persist `attach-referrer` (currently fire-and-forget)
**What:** During onboarding, both apps send the stashed referral code to
`POST /v2/public/auth/{customers,advertisers}/attach-referrer` as a single
fire-and-forget call (`OnboardingContext` — `void ….catch(() => {})`). If that one
request fails, attribution is silently lost — no resume path re-attaches (E158).

**Why deferred (accepted, Matej 2026-08-05):** the call fires immediately after
successful registration requests on the same connection, so a failure is rare in
practice; and the 24h `updateReferrerCode` window remains as a manual fallback for
anyone whose attach was lost.

**Shape when picked up:** clear `REFERRAL_PREFILL` on attach **success** instead of
on `signIn`, and retry while it's still present and a registration token exists
(onboarding resume / next app foreground). The server side is already
last-write-wins on the pending row, so retries are safe.

**Depends on:** nothing.

### Push notification deep-linking
**What:** Tapping a push routes to the relevant screen (share, business, balance) instead
of just opening the app.

**Why deferred:** Explicitly deferred in the retired v2.0.0 plan (§Notifications) — the tap listener
(`usePushOpenedListener`) ships in v2.0.0 for **analytics only**, and both root layouts
carry a comment saying routing is intentionally absent. The plan was to revisit with real
open-rate data rather than guess which destinations matter.

**Depends on:** `push_opened { slug }` analytics accumulating enough volume to show which
notification types people actually act on.

### Route advertiser account deletion through `markShareUnpayableAndUnlock`
**What:** Advertiser account deletion voids in-flight shares with a raw
`share.updateMany` in `controllers/v2/advertiserApp/me/delete-account/confirmDeleteAccount.ts:102`.
That bypasses `utils/shares/markShareUnpayableAndUnlock.ts`, the documented
single UNPAYABLE writer. This is the **only** place left that writes a terminal
share status outside that helper (swept 2026-08-03: every other `share.updateMany` is
either a sanctioned CAS — `markSharePaidOrThrow`, `approveShare`, `rejectShare`,
`claimShareAssessment`, `reviewShareReport`'s row-lock — or writes non-status IG fields).

**Why it matters (audit, not cents):** the money outcome is already correct — the void
runs before `forfeitRemainingBudgetToPlatformOnAccountDeletion`, which re-reads both
balances, so unlocking would move locked → available and the forfeit zeroes the same
total either way. What's lost is **debuggability**: no `SHARE_UNLOCK` event is written,
so each affected share's ledger trail ends at `SHARE_LOCK` with no release and the funds
disappear into one `ADJUSTMENT` you have to already know to look for. Second gap: no
`voidReason` slug is stamped, so the customer sees a reason-less "unpayable" share and
admins get no typed cause (only `lastProcessingError` free text).

**Why deferred:** it needs a **new `ShareVoidReason` value** plus localized copy in two
apps. The five existing slugs don't fit — `ACCOUNT_DELETED` is documented as *the
customer* deleting their Tagly account, so reusing it would tell the customer their own
account was deleted. Naming the new slug (e.g. `BUSINESS_ACCOUNT_DELETED`) and writing
its en+cs copy for the customer + advertiser share-detail screens is a product/copy
decision, not a mechanical refactor.

**Shape when picked up:** add the slug to `ShareVoidReasonValues` (`@tagly/models`
`core/enums.ts`) + its copy in both apps; keep the existing selection filter
(`status: PROCESSING` **and** `approvalStatus: { not: "REJECTED" }` — the helper has no
approvalStatus guard, so a blanket loop would void rejected-intake shares and fire them a
`c.shares.unpayable` on top of the `c.shares.rejected` they already got); loop the
selected ids through the helper with `notify: true` (the deleted party is the advertiser,
the customer recipients survive) and delete the manual `c.shares.unpayable` loop — the
helper already queues it with `tx` under the identical `share-unpayable:{customerId}:{day}`
dedupe key. Note the transaction grows from one `updateMany` to N iterations.

**Depends on:** nothing technical — just the slug + copy decision.

### RDS Proxy (or PgBouncer) in front of Postgres
**What:** Connection pooling so App Runner instance count stops being coupled to
`max_connections`.

**Why deferred:** Unchecked in the retired v2.0.0 plan (§Performance). It's the connection-exhaustion
failure mode at scale, independent of per-request query count — so the batch pricing and
reward-estimate cache work didn't address it. Pure devops, no app code.

**Depends on:** nothing technical; it's a scaling trigger. Needed alongside the reward
cache for the ~100k-user target. ⚠️ Adds recurring cost — needs explicit spend approval.

---

## Deferred hardening (ops / infra)

### Mobile app crash / JS error tracking (blind spot found 2026-08-11)
**What:** Backend errors are fully tracked (`reportError` → PostHog `$exception`, with
`error_class`/`service`/`throw_site`), but **the client apps report nothing**. Neither
`tagly-customer` nor `tagly-advertiser` has an error boundary, a global handler, or a
single `captureException` call, and PostHog holds zero `$exception` events from
`app: "customer"` / `app: "advertiser"`. A JS crash on a user's phone is invisible: the
only symptom is a funnel step that silently stops converting. `tagly-admin` has no
PostHog at all, and `tagly-redirect` (a static `index.html`) has none either — the latter
is the hop between a join CTA click and the app opening, so that segment of the
attribution funnel is unmeasured too.

**Why deferred:** Matej (2026-08-11) — noted during the PostHog coverage audit, not
blocking. Product analytics and backend errors both work; this is the missing third leg.

**Shape when picked up:** `posthog-react-native` supports `captureException`. Wire a root
`ErrorBoundary` plus a global handler (`ErrorUtils.setGlobalHandler` + an
`unhandledrejection` listener) in each app's `app/_layout.tsx`, funnelling through one
shared helper in `@tagly/client` so both apps stay identical — the client twin of
`reportError`. Keep the same `app`/`app_env` super-properties and the anonymous posture
(`$process_person_profile: false`, no PII in the payload), so app errors land in the same
"Backend health"-style views next to the server ones. Native (Java/ObjC) crashes are a
separate problem this does NOT solve; that needs a native crash reporter and is its own
spend decision. Decide `tagly-admin` (internal TestFlight, arguably fine uninstrumented)
and `tagly-redirect` separately.

### Emails must stay light in the Gmail app's dark mode
**What:** Make sure our HTML emails (OTP, transactional, promo) render with their intended
light design even when the recipient's Gmail app is in dark mode. Gmail (Android/iOS)
auto-inverts colors of emails that don't defend against it, which can wreck brand colors
and contrast (light text on light backgrounds, inverted logos/buttons).

**Shape when picked up:** audit every template in the email pipeline in the Gmail app with
dark mode on; apply the standard defenses (explicit `background-color` and `color` on
every element including `body`/wrappers, full 6-digit hex values, dark-mode-safe images)
so Gmail keeps the light rendering instead of inverting it. Verify on real devices, not
just previews — Gmail's inversion behavior differs between Android and iOS.

**Depends on:** nothing — template-only work, no backend or wire changes.

### OTP email deliverability signal + cold-domain rollback lever (E201, E218, E251)
**What:** v2 customers' only login path is OTP email, sent from the young
`mail.taglyapp.com` domain. Today there is **no production delivery signal**: the only
Resend webhook points at staging (E251) and `email.bounced`/`email.complained` are
unhandled even where events do arrive (E218). The sender is hardcoded, so reverting to
the warmed `mail.flaer.app` means a code change + deploy.

**Why deferred (risk accepted 2026-08-02):** at ~3k customers the transactional volume
sits at or below Resend's day-1 new-domain band (150–400/day), so there is no volume
cliff; and the Phase 2 → Phase 3 rollout is itself a staged ramp (volume grows with
organic adoption; the lockout cliff only arrives at the min-version raise). DNS posture
verified healthy (SPF+DKIM live on all three sending domains; DMARC `p=none` relaxed).

**See also:** "Suppression blindness" at the top of this file — Priority 1, same webhook,
different angle: this entry wants the signal as a **sender-rollback** trigger, that one
wants it because Resend's own suppression list silently blocks **OTP login mail** for
anyone who ever marked a promo email as spam. Pick them up together.

**What to do when picked up:** point a prod Resend webhook at prod; capture
`email.bounced` / `email.complained` / `email.delivery_delayed` as PostHog events + an
insight alert; make the sender truly env-driven so rollback to `mail.flaer.app` is one
env edit. (The per-env identity split — E105 — landed: `CONTACT.ts` branches on
`APP_STAGE` and staging sends from `mail.tagly.dev`. But the prod sender is still a code
constant, so the rollback lever is still a code change + deploy, not an env edit.) Rollback trigger to act on: bounce rate > 4% or
complaint rate > 0.08% on `mail.taglyapp.com` (Resend's own thresholds), or real-user OTP
delivery complaints. **Until then:** watch the Resend dashboard manually during Phase 2,
hold the Phase-3 min-version raise until ~2 weeks of healthy metrics, and keep
`mail.flaer.app` verified in Resend until explicitly retired.

---

## CZ withdrawal FX copy — "amount may vary with the exchange rate"

**What:** the app displays a withdrawal in USD (`amountCents`, the ledger figure) while a
Czech customer's bank receives the post-FX EUR net — e.g. the app says $6.00, the bank
statement shows €5.14 (Stripe's conversion fee is absorbed by the customer, approved
policy 2026-08-07, see W-20 in
`tagly-backend/src/utils/money/withdrawals/withdrawals.md`). Purely cosmetic:
the money flow is correct; the displayed number just isn't what lands in the bank.

**What to do when picked up:** a small app-side copy addition on the customer cash-out
screen (and possibly the transactions detail) along the lines of "final amount may vary
slightly with the exchange rate" for non-USD-bank customers. No backend change — the
payout's actual EUR amount lives on Stripe's payout object if we ever want to show it.

**Why deferred:** v2.0.0 launch scope; the fix that made CZ payouts work at all
(2026-08-07) shipped without UI copy changes.

---

## Open product questions (not yet decided)

- **`est-price-breakdown` observability.** The per-business pricing debug log added in
  `0a36eaac` was deleted in the `fd125a71` rewrite. Deletion was intentional, but if
  pricing ever needs debugging in production there is currently no breakdown anywhere
  except the persisted `FinalPrice` row (admin-only, post-settlement).
