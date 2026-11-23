# Referral Attribution

This document describes the complete referral system — codes, stickers, the
join page, capture, attachment, and payouts — as of v2.0.0. Its sibling
[LINKING_AND_REDIRECTS.md](LINKING_AND_REDIRECTS.md) covers the link/deep-link
rails these flows ride on; this doc covers what rides on them.

## The big picture

**A referral follows the person, not the app.** Every account (customer AND
advertiser) owns exactly one referral code; any code can refer either kind of
account; the join page hands the same code to both the customer and the
business CTA. Who referred you is a **one-time, DB-enforced fact**, and money
moves only at share settlement, as a slice of the platform take.

```
mint ──► distribute ──► capture ──► stash ──► attach ──► resolve ──► pay
(code   (referral       (AppsFlyer  (local    (pending   (ACTIVE     (ledger,
 per     screens, join   payload /   REFERRAL  row or     code →      at share
 account) page, sticker) link URL)   _PREFILL) 24h set)   ReferralEvent) settlement)
```

## Data model (`tagly-backend/prisma/schema.prisma`)

| Model / field | Meaning |
| --- | --- |
| `AccountReferral` | one row per account: `code` (`@unique @db.Citext` — case-insensitive), `codeUpdatedAt` (non-null = the one allowed code change was used), `status` (`ACTIVE`/`INACTIVE`/`DELETED` — only ACTIVE is attachable) |
| `ReferralEvent` | "X referred Y": `referrerCodeId` + `referredCodeId` — **`referredCodeId` is `@unique`**, which is what makes "who referred you" one-time-ever at the DB level. `setByAdminId` + `adminReason` (both nullable) are the audit trail for the admin attach path below; null = the account attached the code itself |
| `Customer.accountReferralId` / `Advertiser.accountReferralId` | `@unique` back-links (each account owns exactly one code) |
| `PendingCustomer.referrerCode` / `PendingAdvertiserAccount.referrerCode` | the **raw, unresolved** code stored during onboarding; resolved at promotion |
| `TransactionKind.REFERRAL_PAYOUT` | the ledger event kind for referral money |

**Code format:** `generateReferralCode(kind)`
(`utils/core/uids/generateReferralCode.ts`) → `c-`/`a-` prefix + 9
lowercase-alnum nanoid (e.g. `c-9kq2xw7de`); P2002 collision retried up to
`MAX_UID_COLLISION_RETRIES`. User-chosen codes must satisfy
`ReferralCodeSchema` (`@tagly/models` `core/referrals.ts`): trimmed,
lowercased, `[a-z0-9_.-]+`, no trailing dot.

## Distribution — how a code reaches a person

### In-app referral screens

`(app)/referrals/` in both apps: shows the code, the shareable link
`join.taglyapp.com/<code>`, native share sheet, and the rates card (rates come
from the backend via `utils/referrals/referralRates.ts`, never hardcoded
client-side). Settings twin (`settings/referrals/`) hosts the one-time own-code
change and the 24h referrer-code entry field.

### The join page (`tagly-join/`, the human landing)

Query params: `?code=` (referral code — the pretty `/​<code>` path form is a
Next server rewrite to `?code=`), `?id=` (sticker id), `utm_source`
(`table-sticker` on printed QR, analytics-only), `business_name` (hero
personalization). Precedence: **an explicit `?code=` beats a sticker-derived
code** (`page.tsx` — `referralCode ?? stickerBusiness.referralCode`).

Both CTAs (get the app / for business) link the respective **OneLink** with the
code embedded: `?deep_link_value=<code>&code=<code>&af_force_deeplink=true`,
plus `&deep_link_sub1=<id>&sticker_id=<id>` when a sticker resolved
(`src/lib/buildJoinUrls.ts`). Same code on both CTAs — referral follows the
person.

### Stickers (printed QR → business → code)

- **Model** `QrSticker`: `stickerId` (opaque, `[A-Za-z0-9_-]{1,64}`, typed in
  by an admin — no minting/printing code exists in the repo) → `localId`
  (cascade delete). Row exists iff the sticker hangs in a business; unassign
  hard-deletes; reassign = delete+create.
- **Admin** (all super-admin): `GET /v2/admin/businesses/:uid/stickers`,
  `PUT /v2/admin/stickers/:id` (assign; `5310`/409 when hanging elsewhere
  unless `reassign: true`), `DELETE /v2/admin/stickers/:id`. Admin UI:
  `QrStickerSection` on the business detail.
- **Public resolver** `GET /v2/public/stickers/:id`
  (`controllers/v2/public/resolveQrSticker.ts`): returns
  `{ business: { uid, name, referralCode } }` where `referralCode` is the
  **owning advertiser's** code, only while `status === "ACTIVE"`; 404 `5311`
  when unassigned or the business isn't visible. Used by both the join page
  (server-side, 2.5s timeout, fail-soft) and the app (sticker-id exchange).
- **Printed URL form**: `https://join.tagly.cz/?utm_source=table-sticker&id=…`

## Capture — how the app learns a code

All capture lives in `tagly-shared/client/services/attribution/` (two files),
active in customer + advertiser (admin has no AppsFlyer key, so the SDK never
loads there).

Three inbound channels, all funneling into one stash:

1. **AppsFlyer deferred deep link** (`onInstallConversionData`) — the ONLY
   channel that survives an App Store install. Fires on first open after an
   attributed install; payload fields read: `deep_link_value` variants,
   `af_dp` URL (then `?code=`/`?deep_link_value=` inside it), direct
   `code|referral|ref|r|af_sub1`.
2. **AppsFlyer direct deep link** (`onDeepLink`) — OneLink tap with the app
   installed.
3. **Raw URL open** (`Linking.getInitialURL` + `addEventListener("url")`) —
   universal-link taps on join/redirect hosts and scheme opens, parsed by
   `parseInboundReferral.ts` with **host-aware rules**:

| Host | Code source |
| --- | --- |
| join hosts (tagly + legacy flaer) | `?code=` → first path segment → `?id=` (sticker, exchanged via the public resolver) |
| `*.onelink.me` | `?code=` ?? `deep_link_value` |
| anything else (redirect hosts, schemes, unknown) | `deep_link_value` ONLY — **deliberate**: the Instagram OAuth return carries `?code=<IG auth code>`, which must never be stashed as a referrer |

**The stash**: `SHARED_LOCAL_KEYS.REFERRAL_PREFILL` (plain local storage),
last-write-wins, deliberately NOT gated on "has JWT" (iOS Keychain survives an
app delete, so a fresh install can look signed-in). Cleared on `signIn` in
both apps' SessionContext.

## Attach — where a code becomes a relation

Three attach paths, all funneling into a `ReferralEvent` row; the DB
uniqueness on `referredCodeId` makes whichever lands first permanent.

1. **During onboarding** (the normal path): `OnboardingContext` reads the
   stash and fires `POST /v2/public/auth/{customers,advertisers}/attach-referrer`
   (`{ registrationToken, referrerCode }`) — fire-and-forget. The controller
   stores the **raw** code on the pending row (last-write-wins; requires
   verified email). At promotion (`4.completeRegistration` /
   `3.finishRegistration`) the code is resolved against
   `AccountReferral { code, status: "ACTIVE" }` — unknown/inactive codes are
   **silently ignored** — and `createXWithUniqueUid` creates the
   `ReferralEvent` atomically with the account.
2. **Post-signup, once, within 24h**:
   `POST /v2/{customers,advertisers}/me/update/referrer-code`
   (`ACCOUNT_UPDATE_COOLDOWNS.referrerCodeSinceCreatedMs` = 24h).
   Transactional.

3. **Admin, any time after the fact** (advertisers only):
   `POST /v2/admin/advertisers/:uid/referrer` (`setAdvertiserReferrer`,
   SUPER-only). Exists because the referral is routinely lost in
   sales-assisted onboarding — an influencer brings a business, sales signs
   them up, and nobody tells the business to enter the code, so path 1 and 2
   both pass unused. Same guards as path 2 **minus the 24h window**, and
   still set-only (an existing referrer 409s), so a live commission
   relationship can never be redirected from admin. The acting admin +
   optional reason are stamped on the event (`setByAdminId`/`adminReason`)
   and surfaced back in the admin Referral section. **Not retroactive** —
   already-settled shares keep the payouts they had; the event's `createdAt`
   is the moment of the fix, so the ~6-month full-strength boost window
   starts then rather than at the advertiser's sign-up.

**Paths 2 and 3 share one write-side chokepoint**:
`utils/referrals/attachReferrerOrThrow.ts` owns the guards, the error
ladder, and the `ReferralEvent` write for all three v2 controllers, so a
referral rule changes in exactly one place. The callers differ only in what
they pass: `signUpWindowFrom` (the account's `createdAt`, omitted by admin so
the window is skipped) and `setByAdminId`/`adminReason` (admin only). One
error ladder, one meaning per code, platform-wide: already referred
`1003`/409, sign-up window expired `1006`/403, code not found/inactive
`1004`/404, self-referral `1005`/409, code with no single owner account
`1007`/409. That last guard refuses a code owned by neither or both account
kinds — `findReferrer` returns null for those, so the event would be created
and then silently never pay out.

**Own-code change** (`…/me/update/referral-code`): one-time-forever —
`codeUpdatedAt: null` CAS; taken `1220`/409, already-changed `1219`/403.
(The old 180-day `referralCodeMs` cooldown constant is dead in v2.)

Reads: `GET /v2/{customers,advertisers}/me/referrals` (counts, code, rates,
referred-by). Admin sees a Referral section on both detail screens
(`adminReferral` DTO: code, status, referred counts, referredBy or "Organic",
plus `referredBy.setByAdmin` when path 3 created it). The advertiser screen's
section (`tagly-admin/components/details/AdvertiserReferral.tsx`) carries the
"Set referrer" action, shown only while the advertiser is still organic.

## Payout — where money moves

**Constants** (`constants/rewards/REFERRAL_TAKES.ts` — settlement
economics, permanent bucket, backend-only):

| Constant | Value | Meaning |
| --- | --- | --- |
| `ADVERTISER_REFERRER_TAKE_BPS` | 4000 | referrer of a **business** gets 40% of Tagly's take → effective **16%** of the business's spend |
| `CUSTOMER_REFERRER_TAKE_BPS` | 2000 | referrer of a **customer** gets 20% of Tagly's take → effective **8%** of the friend's earnings |
| `REFERRAL_FULL_REWARD_DURATION_MS` | 180 days | full-rate boost window from the `ReferralEvent` |
| `REFERRAL_DECAYED_BPS` | 5000 | after the boost: 50% of the base rate, forever |

(Tagly's take is `TAGLY_PLATFORM_TAKE_BPS` = 4000 in `PRICING.ts`; the
client-facing 16%/8%/6-months numbers are derived in
`utils/referrals/referralRates.ts`.)

**Resolution** (`utils/referrals/findReferrer.ts`): from the
referred account → `ReferralEvent` → referrer code → its owner (customer OR
advertiser — all four referrer×referred combinations pay). The take is picked
by the *referred* side's type; the decay multiplier by the event's age.

**Booking** (`utils/money/ledger/events/createReferralPayoutEvent.ts`):
zero-sum ledger event — platform pays (`deltaPlatformCents: -amount`), payee
receives; idempotent on `externalRef` (`share:{shareId}:referral:adv|cust:v1`).
Referral payouts offset the platform fee booked on the SHARE_PAYMENT event.

**Call sites — settlement only** (there is no other payout trigger):

- `settleSharePayoutAndUnlockRemainder` (advertiser-funded shares): pays the
  advertiser's referrer AND the customer's referrer, each
  `bpsOfCents(platformFee, referrerBps)`.
- `settleSubsidizedSharePayout`: customer-side referrer only (subsidized
  businesses have no advertiser); the fee base is the *platform-fee
  equivalent* back-computed from the paid reward.

Payouts surface as `REFERRAL_PAYOUT` transactions (gift icon + filter chip in
both apps) and in the admin "Referral payouts" stat.

## Known gaps / flagged behavior

Documented here so nobody rediscovers them (several are tracked punchlist
items):

1. **Sticker id never reaches the app** — the join page sends
   `deep_link_sub1`/`sticker_id`, but `appsFlyerBridge` doesn't read them and
   no storage key exists. Only the server-resolved referral *code* attributes;
   "sticker scan → business page" is a v2.1 candidate (FUTURE.md).
2. **Registered users get nothing from a sticker scan** — codes only attach
   during onboarding or the 24h window (FUTURE.md v2.1 entry).
3. **A sticker code attaches whoever signs up through it — including a rival
   business.** INTENDED (decision Matej, 2026-08-05): the venue really did
   refer them; referral follows the person regardless of what kind of account
   they create. Don't "fix" this (E085 closed as intended behavior).
4. **`attach-referrer` is fire-and-forget with no retry** — a failed call
   silently loses attribution; no resume path re-attaches (E158). ACCEPTED
   (Matej, 2026-08-05): failure is rare in practice and the 24h window is the
   fallback; a retry shape is parked in FUTURE.md ("Retry / persist
   attach-referrer").
5. **`REFERRAL_PREFILL` is cleared only on `signIn`** — not on signOut or
   after a successful attach; an abandoned tap leaves a live code for the
   next person on a shared device.
6. **`findReferrer` ignores `AccountReferral.status`** — attach paths require
   ACTIVE but payout resolution doesn't re-check; nothing ever sets
   INACTIVE/DELETED today, so this is latent (E314).
7. **Empty `?code=` kills sticker attribution on the join page** — `"" ??
   sticker.code` keeps the empty string (`??` vs `||`), and the CTA builder
   then drops attribution entirely. ACCEPTED as-is (Matej, 2026-08-05): our
   printed stickers never carry a `code` param
   (`join.tagly.cz/?utm_source=table-sticker&id=…`), so the case doesn't
   arise from our own materials.
8. **`/​:code` rewrite accepts any segment** — `/faq` renders the referral hero
   and logs `referral_code_present: true`; no `ReferralCodeSchema` check
   server-side on the join page.
9. **`ReferralCodeSchema` has no max length** — feeds the unique Citext
   column (E288).
10. **The public sticker resolver is enumerable** — IP-rate-limited only;
    maps sticker id → business + code (E471).
11. **`JOIN_BASE_URL` is hardcoded to production** in both apps' referral
    screens — staging builds hand out prod join links.
12. **Join-page analytics leak the code into `target_url`** on
    `join_cta_clicked` while a sibling boolean tries to avoid exactly that.
13. **Advertiser builds never see join-host universal links** — join hosts are
    claimed by the customer app only (see LINKING_AND_REDIRECTS.md); the
    OneLink hop is what carries advertiser referrals.
