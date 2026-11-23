# Advertiser App Development Guide

This file provides guidance for Claude Code when working in `tagly-advertiser/`.

**Platform:** iOS + Android (native mobile). No web target — the v1 web surface was removed in v2.

> ### v2 rewrite — plan + decision record: `v2.0.0.md` §3A (the plan file was retired 2026-08-14 — it lives in git history, `git log --all -- v2.0.0.md`; its still-open items moved to [FUTURE.md](../FUTURE.md))
>
> This app was **rewritten ground-up** for v2 (same method as the customer app): web removed, Android
> added, payments **in-app** via the native Stripe PaymentSheet (no hosted-Checkout redirects), and every
> surface rebuilt on the new `theme/`, colocated i18n, and the `/v2` SDK. Bottom nav = **Home · Wallet ·
> Account** tabs. Auth mirrors the customer (email OTP + Apple/Google OAuth, no password), and the
> Google/Apple OAuth config is fully wired in `app.config.ts` — the google-signin plugin with
> `iosUrlScheme`, **`usesAppleSignIn: true`** in the `ios` block, and the client IDs in `extra`.
> ⚠️ `usesAppleSignIn` writes the `com.apple.developer.applesignin` entitlement, so the iOS
> provisioning profiles must be regenerated (`eas credentials -p ios`) for every advertiser
> bundle id, or the build fails at signing.

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../CLAUDE.md).

## Check Before You Build

Before writing any component, hook, utility, or type — **check the shared packages first**. The monorepo exists precisely so that implementations are written once and used by all apps.

| You need                 | Check here first                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------ |
| A UI component           | `tagly-shared/client/components/` — lists, overlays, pickers, buttons, inputs        |
| A spacing or color value | `tagly-shared/client/theme/` — `theme.ts` tokens (`spacing`, `layout`, colors, text) |
| A client utility or hook | `tagly-shared/client/`                                                               |
| An API call pattern      | `tagly-shared/client/api/caller.ts` — `callAuthed`, `callPublic`                     |
| A Zod schema or enum     | `tagly-shared/models/src/core/` (+ `constants/`, `catalogs/` — permanent)            |
| A shared TypeScript type | `tagly-shared/models/src/dtos/v2/<group>`                                            |
| An endpoint schema       | `tagly-shared/models/src/endpoints/v2/<group>`                                       |
| An SDK endpoint function | `@tagly/sdk/v2/advertiserApp` (+ `@tagly/sdk/v2/crossApp`)                           |

If something almost fits but not quite, generalize the shared version rather than creating a local parallel. App-specific code lives in `tagly-advertiser/components/` and `tagly-advertiser/hooks/` only when there is no reasonable shared equivalent and no other app will need it.

## Shared Patterns

The advertiser app follows the **same patterns as the customer app** for:

- Security (token handling, error messages)
- API Call Patterns (callAuthed, callPublic, error handling)
- Hook Patterns (useDetailQuery, usePagedList)
- Context Patterns
- Component Patterns
- Color & Theming (useColorTheme)
- Performance (FlatList, memoization)
- Documentation Requirements (docblocks)

Refer to [tagly-customer/CLAUDE.md](../tagly-customer/CLAUDE.md) for these patterns.

---

## Localization (i18n)

The advertiser app is fully localized (English + Czech) via i18next + react-i18next, using the **colocated** pattern (`<Name>.{en,cs}.json` next to each screen/component, registered in `i18n/appLocales.ts`) — same as the customer app. The full system is documented in [tagly-shared/client/i18n/CLAUDE.md](../tagly-shared/client/i18n/CLAUDE.md). Key rules:

- **Use `t()` for every user-facing string.** In components: `const { t } = useTranslation("<ns>")` before any early return. In non-component utils: `import { i18n } from "@tagly/client"` then `i18n.t("key", { ns: "..." })`.
- **Czech uses the informal register (tykání)** — same as the customer app.
- When adding a new screen, add its colocated `<ns>.{en,cs}.json` and register both in `i18n/appLocales.ts`. Restart the app after editing locale JSON.

---

## Alerts & toasts

- Use `customAlert()` from `@tagly/client` — never `Alert.alert()` (consistent styling across apps).
- Use `showToast()` from `@tagly/client` — never `Toast.show()` directly.

---

## Design System Components

### Primitives

**CustomButton:**

```typescript
import { CustomButton } from "@tagly/client";

<CustomButton
  type="primary"           // "primary" | "secondary"
  height="large"           // "small" (32px) | "large" (48px)
  label="Submit"
  onPress={handleSubmit}
  loading={isSubmitting}
  disabled={!isValid}
  corners={["all"]}        // tl, tr, bl, br, all
  icon={<Ionicons ... />}  // Optional left icon
/>
```

**CustomTextInput:**

```typescript
import { CustomTextInput } from "@tagly/client";

<CustomTextInput
  heading="Amount"
  subheading="Enter value"
  placeholder="0"
  value={amount}
  onChangeText={setAmount}
  size="large"             // "small" (32px) | "large" (56px)
  prefix="$"               // Optional prefix
  insideHeading="USD"      // Optional label inside border
  rightIconName="close"    // Optional Ionicon
  onRightIconPress={clear}
/>
```

**PressableText:**

```typescript
import { PressableText } from "@tagly/client";

<PressableText onPress={handlePress} color={colors.contrast}>
  Learn more
</PressableText>
```

**StepProgressOverline (v2)** — onboarding step counter ("Setup · 1 of 2") at the top of every counted onboarding _task_ step (notifications, consent; the post-sign-in setup steps join the count when they land). Get `step`/`total` from `useOnboarding().stepProgress("<step>")` — it excludes steps resolved before the session started and returns `null` when the line should be hidden. Never count identity screens or transitions like `finishing`.

## Setup phase & billing (v2)

Post-sign-in **setup phase**: `app/(app)/_layout.tsx` mounts `AdvertiserProvider` (`contexts/advertiser/AdvertiserContext.tsx`, `GET /v2/advertisers/me`) and gates the authed Stack. The same layout fires the fire-and-forget `POST /v2/advertisers/me/on-app-open` once per authed mount (notification defaults + Expo push-token registration with platform/timezone — the **only** post-onboarding token write, covering token rotation and late permission grants; mirrors the customer's `onInitialLoad`). ⚠️ It calls **`requestAndGetExpoToken`**, which **prompts** — deliberate (Matej, 2026-08-09): iOS allows one permission dialog per install and we spend it on the first authed mount because acceptance is materially higher there than at the onboarding primer. Accepted consequences: it fires even after a "Maybe later" on the primer, and Settings → Notifications → Push can then only deep-link to OS settings rather than raise the dialog. **Don't swap it for `getExpoTokenIfGranted`** — the primer in `contexts/onboarding` is the only _other_ place allowed to prompt, and it must still never auto-fire. It also runs the shared `useStaleResume` (5 min `STALE_RESUME_THRESHOLD_MS`, twin of the customer layout): reopening after a long background resets nav to the home tab and re-runs the cold-start work (silent `/me` refresh + on-app-open) instead of restoring the stale prior state. The gate splits its facts by owner: the **server derives what's true** (`funded` = open PAYG period / positive balance / any past purchase; `hasBusinessPage`), the **device stores what the user chose** (`LOCAL_KEYS.PAYMENT_SETUP_DISMISSED`, cleared on sign-out). A step shows while its fact is unsatisfied AND undismissed — so a funded account is never re-asked (crash recovery, migrated v1 accounts), a skip never nags within the install, and there is **no server-side setup column**. Finishing or skipping calls `useAdvertiser().dismissPaymentSetup()` (sync, local), which flips the gate. **The payment step then LATCHES once entered** (2026-09-03): the raw fact decides whether to _ask_, but from the moment the step is on screen only `dismissPaymentSetup` resolves it. Without the latch the fact closed the step from underneath itself — every billing sheet refreshes `/me` the instant money is confirmed, so `funded` turned true **while the success beat was still playing**, the guard swapped the screen out mid-beat, and `onFunded` never fired at all (`useConfirmedExit` clears its timer on unmount): the confirmation was cut off, `PAYMENT_SETUP_DISMISSED` was never written, and nothing the step wanted to do next (the post-purchase monthly-top-up prompt) could exist. Boot fail-open is unaffected (the latch can only be set by having been in the step). **A payment-success callback must `await refresh()` BEFORE dismissing** (`useConfirmedExit` does it for every sheet) — `AdvertiserContext` fetches /me exactly once at mount, so dismissing on the boot cache lands a just-charged advertiser on a stale "NOT VISIBLE / $0.00" card (E048). Fail-open: a failed /me lands in the tabs; Wallet is the second chance.

The same `(app)/_layout.tsx` also mounts the shared **ToS / Privacy re-acceptance modals** (`AcceptLatestTosModal` / `AcceptLatestPrivacyPolicyModal` from `@tagly/client`), gated on `AdvertiserMe.shouldAgreeWithLatestTos` / `shouldAgreeWithLatestPrivacyPolicy` (derived server-side in `getMe` by comparing the advertiser's `agreedTo*At` stamps against the `LATEST_*_RELEASE_DATE` constants). Accepting posts to `POST /v2/cross/terms-of-service/agree` (or the privacy twin) and patches the cached flag false via `useAdvertiser().setAdvertiser` — the staggered `activeModal` cycle mirrors the customer layout so the two modals' backdrops never overlap.

Payments run through the **native Stripe PaymentSheet** (`StripeProvider` in `app/_layout.tsx`; `STRIPE_PUBLISHABLE_KEY` required in `.env`/EAS env; config plugin in `app.config.ts`). **Apple Pay + Google Pay are wired** via `constants/stripeWallets.ts` and the `merchant.com.flaer.advertiser` merchant id (`app.config.ts`) — the merchant id must exist in the Apple Developer portal (or iOS signing fails) with a Stripe payment-processing certificate for live payments; production Google Pay needs Google Pay & Wallet Console approval. Everything below lives in `components/billing/`, flat (folder per component) since the 2026-09-02 restructure — the per-feature `credits/ monthly/ payg/` grouping was right when each had a card _and_ a sheet, and became single-component folders once the cards collapsed into `FundingSurface`:

- **`FundingSurface` — THE funding body, mounted verbatim by the Wallet tab AND the onboarding payment step** (decision 2026-09-02, the wallet restructure: "the onboarding payments screen should look exactly the same as the wallet"). It is the whole answer to "how does this account pay", and hosts add only chrome. Two states on the server-derived `funded` gate: **never funded** → `FundingPitch`, the prepay-vs-pay-per-share fork (credits as a full card, PAYG second under its lead-in — the monthly top-up is deliberately NOT a third option; it is an optimisation of prepaying, offered as a row once funded); **funded** → `BalanceCard` over `HowYouPayCard`. It **owns all five sheets itself** — a host that wired them would inevitably wire them differently — and exposes just `surface` (analytics), `onFunded` (confirmed new money) and `onChanged`. The setup step's `setup_payment_mode_selected` fires from here, so the step cannot forget it. Two rules govern what happens after a purchase: **(1)** it offers the monthly top-up (`swapTo("monthly")`) whenever the rule is `NOT_ACTIVE` — **on every surface, onboarding included** (Matej, 2026-09-03), since a just-completed payment is the moment the rule explains itself; never when it is running, and not while it is paused on a declined card (the sheet would open on a card error instead of a pitch). **(2)** `onFunded` fires **only once no sheet is left on screen** — a funded exit sets a held flag and closes, and `sheetClosed` (every sheet's `onClosed`; `useSheetRouter.handleClosed` returns `true` while a hand-off is still queued) pays it when the surface is genuinely empty. A host may navigate in `onFunded` — the setup step resolves its gate there — so handing back while a sheet is up would tear down the confirmation being read, or the prompt about to open. Never call `onFunded` straight from a sheet callback.
  - **`BalanceCard` — balance facts ONLY** (Matej, 2026-09-02). Available | Locked, and exactly two possible notes, both about the money: negative (an uncollected charge → "Pay balance" becomes primary) and below the visibility floor (skipped while PAYG is active — the one case where the floor does not gate visibility). **A declined card, a paused top-up or a PAYG fault never appear here** — they belong to their own row, which is also the row that opens the sheet that fixes them.
  - **`HowYouPayCard`** — the rules as rows (monthly top-up · pay as you go · card), in the order money is spent. A row REPORTS and opens a sheet; it never pitches, which is what stops a funded advertiser being re-sold a method they already declined. Every fault surfaces on its own row. **The card row renders when a card is on file OR anything is failing** (2026-09-02): a saved card with no rule attached funds nothing, so an empty "Card · None" row is a step that accomplishes nothing, and both rules already offer to link one at the moment it is needed. The `|| cardFailed` half is belt-and-braces — server-side `derivePaygStatus`/`deriveMonthlyBudgetStatus` both gate `CARD_FAILED` on `cardOnFile`, so a settled `!hasCard && CARD_FAILED` is unreachable, but it IS reachable mid-load (`useFundingState` seeds `payg.status` from `/me` before the card query resolves). In money UI the asymmetry decides it: a stray "Declined" row is harmless, hiding the only route to fixing a broken card is not.
- `PaygSheet` — the pay-as-you-go **rule only** (card management moved to `CardSheet` in the restructure, which is what removed the old "turn off PAYG — keep the card?" alert). Four states off the shared `usePaygState`/`useFundingState`: **no card** → pitch + charge consent (EU checkbox / US disclosure) → `useCardLink` → `enablePayg` (skipped when already active, so replacing a card never closes the period); **card on file, off** → consent + "Turn on" (`POST /payg`, no PaymentSheet); **on** → the active note + "Turn off" (`DELETE /payg`, the card stays); **card issue** → the fault note, and the action opens `CardSheet`. **PAYG has no spend cap**, and credits are always spent first — both stated in the copy so the two rules read as ordered, not rival. `setupPaygCard`/`reconcilePaygCard` remain `@deprecated` (pre-2026-09 builds only).
  **The saved card is shared.** The account has ONE off-session card, used by pay as you go AND the monthly top-up. That is why neither rule sheet manages it: `CardSheet` owns add / replace / remove, and removing it closes both periods server-side.
- `AddCreditsSheet` — the purchase, and **a pure transaction in every account state**: it never mentions, offers or mutates a recurring rule. Buying credits and the monthly top-up are **completely separate features** (Matej, 2026-09-03) — entangling them is what produced the original bug, where an active top-up took the sheet over and "Add credits" landed the advertiser in a settings screen. `POST /billing/credit-purchases` → PaymentSheet → poll `getCreditPurchaseStatus` until the webhook books the credits → success beat → `onPurchased`.
- `MonthlyTopUpSheet` — the recurring rule only: turn on, change the amount, turn off. **Naming (2026-09-02): the user-facing name is "Monthly top-up" / CS "Měsíční dobíjení"** — never "Monthly budget"/"Měsíční rozpočet" in any copy; `monthlyBudget`/`MonthlyBudgetPeriod` stay the frozen internal + wire identifiers. **Turning it on never charges** (2026-09-03): the `PUT` opens a period scheduled for the next 1st and returns, so there is no run to wait for — no polling, no declined/retrying/paused/unverified states, and no CTA quoting a pay-now amount. With no card on file it shows the **link-card** flow (`useCardLink`), never a purchase sheet. The success beat says nothing was charged and names when the first charge lands; the exact date arrives a beat later from `GET /monthly-budget` and shows on the "How you pay" row. Card actions hand off to `CardSheet` via `onOpenCard`. **`afterPurchase` puts a yes/no question step in FRONT of the form** — a centered moment (`promptTitle`/`promptBody`, `offerYes`/`offerNo`, same shape as `PaymentPhaseView`) where yes reveals the form and no closes. Set only on the post-purchase hand-off, and only while the rule is off; an active rule is being managed, not offered. **The form itself never varies** (Matej, 2026-09-03) — the earlier attempt reshaped its header and bolted a decline button onto it, which had a settings screen and an unsolicited offer sharing one set of parts. A flow that needs different words says them in its own step.
- `CardSheet` — the account's ONE off-session card, and the one place that answers _what is my card doing_: brand/last4/expiry plus a row per job with its live state. **No card** → the two jobs are explained before the card is asked for, and adding one enables NOTHING (each rule is turned on in its own sheet). Removal closes both periods server-side, so the confirm **names whichever rules are actually running** instead of a generic warning.
- `SettleBalanceSheet` — pay off a **negative** available balance (an uncollectable PAYG receivable that hid the account). Shown only while `budgets.availableCents < 0`: the `BalanceCard` swaps its primary CTA to "Pay balance" (Add credits demoted to secondary), and the Home `BudgetCard` footer becomes "Pay balance" instead of "Manage wallet". It is a **credit purchase with a server-computed amount** — no amount picker, no $50 floor: `settleNegativeBalance` (no body) charges exactly the debt (floored at Stripe's `STRIPE_MIN_CHARGE_CENTS` $0.50, the sub-debt remainder landing as credit) and returns the same PaymentSheet handoff + the charged `amountCents`; it reuses the identical PaymentSheet + `pollUntil(getCreditPurchaseStatus)` verify machinery as `AddCreditsSheet`, and the **same webhook / reconcile worker / `CREDIT_PURCHASE` ledger crediting** on the backend (the only difference from a top-up is that the amount is derived server-side from `availableBudgetUsdCents`, not client-chosen — shared core: backend `utils/money/stripe/createAdvertiserCreditPurchaseIntent`). Settling clears the debt back to $0 (it does **not** by itself restore visibility — the account may still need funding to cross `MIN_VISIBILITY_BUDGET_CENTS`), so the copy promises "balance back to zero", not "visible again".
- **`components/billing/billing.{en,cs}.json` — THE canonical funding vocabulary** (feature-level `billing` namespace), at the **feature root**, not inside a component folder: every card, row and sheet renders these exact words. **The rule: if a string names a method, a state, an amount or an action it lives here; if it narrates a flow (consent, verifying, success, failure, confirm) it lives in that sheet's own namespace.** It holds each method's `title`/`tagline`/`cta` + pitch points, the monthly schedule + estimate lines, the card lines, and the shared `action.*` / `state.*` verbs and status words — so "Paused", the pay-now estimate sentence and "Remove card" exist once and cannot drift between surfaces. The **point count is per method** and is fixed by `MethodBenefits`' `ROWS` array (credits + PAYG: 2, monthly top-up: 3) — the array and both locale files change together, and the keys are fully qualified so tsc rejects a point with no copy. `components/billing/shared/` keeps the code that renders it: `MethodChip`/`MethodHeader` render the fixed visual identity (credits = `wallet-outline` on accent, PAYG = `flash-outline` on brand, monthly top-up = `calendar-outline` on accent — it IS credits on a schedule, and butter stays PAYG's alone so the two accents never touch) — **`MethodHeader` has no copy overrides**: a flow that needs to say something other than the method's own words says them in its own step, never by re-wording the header; `MethodBenefits` renders the pitch rows — **on a sheet always pass `card`** (it wraps the rows in a white surface, so the pitch is the same object in every sheet that shows one); omit it inside a host that is already a white card, where wrapping would stack white on white. Consent rows use the shared `ConsentCheckbox`, which is the app's ONE consent pattern (24px box at `radius.button`, ink fill + on-ink check when ticked, `pressFeedbackStyle`, `hitSlop`) — identical to the customer app's create-share consent and the shared ToS / Privacy modals; keep the three in step. Every billing card/sheet pitches a method through these — never write per-surface funding copy or hand-roll a method header. Copy voice: "share"/"sdílení" (never "post"/"verified post"), link/unlink = "připojit/odpojit". **The $0.30 surcharge must be stated before any card is linked** — it lives in the `PaygSheet` consent (EU checkbox) + disclosure (US) lines, which sit directly above the link CTA. It is deliberately NOT in the PAYG card pitch or the setup chooser (Matej, 2026-09-02: selling surfaces stay benefit-only; the fee is disclosed at the moment of authorization). Never remove it from those two consent strings.
- `BudgetCard` — the **Home** account card (the Wallet uses `FundingSurface` instead). Reads `AdvertiserMe` from context; hosts pass `onPressCredits`/`onPressPayg` + an optional ink footer CTA. Healthy = Visible pill + the Credits|PAYG ledger (credits full-strength only at ≥ `MIN_VISIBILITY_BUDGET_CENTS`, with a "min to be visible" caption below that; PAYG cell renders the **server-derived `budgets.paygStatus`** — Active / Card issue / Card not linked; PAYG has no spend cap). Broken = a tappable danger band showing only the **NOT VISIBLE stamp** (no inline cause copy); tapping it opens `components/billing/VisibilitySheet`. The below-minimum credits caption in the ledger is `color.danger`. All funding rules live in the backend (`utils/hydrators/billing/derivePaygStatus.ts`) — never re-derive card/period logic client-side. Exports `NotVisibleStamp` + `CardFooterCta` for `NoBusinessCard` (`components/businesses/NoBusinessCard`, the create-page prompt shown in the same slot — its band is the same tappable danger strip, opening the sheet with the `noPage` cause).
- **Visibility explainer trio** — visibility needs **a business page AND budget**, and the not-visible cause is derived in ONE place: `components/billing/shared/useVisibilityCause.ts` (`noPage` → `activate` → `lapsedNegative` → `lapsedCardIssue` → `lapsedLowCredits` → `lapsed`; `null` while visible or on a failed /me — fail-open). `VisibilitySheet` takes that **cause key** (not prose) and owns all the `<cause>Body` copy in its own namespace (incl. `noPageBody`; the ways-back list prepends a create-page row for `noPage`). `components/billing/VisibilityCard` is the standalone tappable NOT VISIBLE strip for screens without the BudgetCard (top of Wallet + Account) — renders `null` while visible, so hosts mount it unconditionally. Never re-derive a not-visible cause or write cause prose outside these.

**Each sheet owns its operation end to end, and no flow is written twice.** One sheet per operation (buy credits · monthly on/off/change · PAYG on/off · card add/replace/remove), and inside it the full contract: **hit the backend → patch/invalidate the shared queries → refresh the advertiser context → show the confirmation → hand back to the host.** The mechanical halves are shared hooks, so a second copy of any of them is a bug: `useCardLink` (mandate → PaymentSheet → poll reconcile → invalidate all three card-bearing queries), `useCreditPurchase` (PaymentSheet → poll the purchase row → outcome), `useMonthlyEnable` (link if needed → `PUT /monthly-budget` → done; no polling, because activation never charges), and **`useConfirmedExit`** (the only way out of a success path: **refetches `/me` AND all three shared queries**, runs that under the success beat, and calls the host back only once it settled). Two rules live in it: it **refetches rather than invalidates** — an invalidation is fire-and-forget and only marks staleness, so a surface can keep showing the old state — and it refreshes _everything_ rather than the key the flow happens to know about, because funding state is entangled (enabling the top-up can link a card and move the balance; removing a card closes two periods). That is also what makes E048 structurally impossible instead of a rule each host has to remember. Card wording comes from `useCardLabels`. **Hosts must not refresh `/me` after a money action** — the sheet already did; a host refreshes only what is genuinely its own (the Wallet's transactions feed, Home's share strips, setup's step dismissal). Two deliberate overlaps: a card can be linked from `CardSheet` **or** as the first step of turning on a rule that has none, and cancelling a rule can happen in its own sheet **or** implicitly by removing the card. Both are the same shared code from different entry points.

Every sheet stays open under the PaymentSheet, so a cancel returns with state intact. **PaymentSheet success is NOT authoritative** — after it the sheet flips into a non-dismissable verifying state and polls the backend (`utils/paymentVerification.ts`: 2s × 10 attempts + the shared `pollUntil`), then plays an in-sheet success beat (`components/billing/PaymentPhaseView/`) before firing `onLinked`/`onPurchased` (so those callbacks mean _confirmed_ money truth — the setup step resolves straight off them, no separate success screen). Poll budget exhausted → a closable "we couldn't verify" state that closes back without resolving the step (the server-derived `funded` fact clears the gate later if the webhook lands). **Containment contract:** because the sheet is non-dismissable while `busy`/`verifying`/`success` (and its reset-on-open effect can only run if the sheet can close), each payment flow (`link()`/`pay()`) runs inside a `try/catch` that restores the dismissable form on an unexpected throw — keep any new `await` inside that containment, and never add a state that disables every exit without it (see the "Non-dismissable sheets & busy flags" rule in `tagly-shared/client/CLAUDE.md`). Analytics: `setup_payment_viewed`/`skipped` fire in the setup screen and `mode_selected` in `FundingSurface` (which owns the pitch CTAs), but the **money events fire inside the sheets themselves** — `credits_purchased`, `payg_card_linked` (`action: link|update`), `payg_card_unlinked`, `payg_turned_on|off`, `monthly_budget_enabled|updated|disabled`, `balance_settled` — each stamped with a required `surface` prop (`"setup" | "home" | "wallet"`, passed by the mounting host), so no surface can forget them and each event is both a total and a per-surface breakdown. Never track a purchase/link in a host screen; see `utils/analytics.ts`.

## Creating business pages (v2)

> **♻️ Promoted to `@tagly/client` (2026-07-24).** The whole business-page form stack now lives in the
> shared package, reused verbatim by the **admin app**: the wizard is
> `@tagly/client` `components/businesses/CreateBusinessWizard/` (api-injected — this app passes the
> `/v2/advertisers/me/businesses` SDK fns plus `locale` from `useAdvertiser` and
> `draftKey: LOCAL_KEYS.CREATE_BUSINESS_DRAFT`), the step forms are
> `components/businesses/pageForm/` (+ `formMappers`: `toWeekHours`/`weekHoursToPeriods`/`diffFormMedia`),
> media picking is `services/media/pickMedia.ts`, and `useBlockBackWhile` is a shared hook. The
> `businessPageForm` + `pickMedia` namespaces are **bundled shared i18n** (registered in
> `tagly-shared/client/i18n/index.ts`, not in this app's `appLocales.ts`). The paths in the two sections below
> predate the move — read them for the _behavior_; the code lives in `tagly-shared/client`.

`components/businesses/create/CreateBusinessWizard/` is the **reusable** 3-step creation flow — only the active step is mounted (one ScrollView at a time), sliding + fading on step change; form state lives in the wizard so back/forward never loses input: **basics** (name, catalog-slug type via `CustomPicker`, address with locale-locked country), **looks** (banner with the 16:9-locked native cropper + up to `BUSINESS_MAX_PHOTOS` any-aspect-ratio photos, previewed at their true AR), **details** (all optional: description, opening hours, links, phone, email, aliases). The step components themselves live in **`components/businesses/pageForm/`** (`StepShell`/`StepBasics`/`StepMedia`/`StepDetails`, namespace `businessPageForm`) — they're host-agnostic forms shared verbatim with the **edit screens** (see "Editing business pages" below): media is the `FormMedia` remote-or-local union (existing uploads render from the CDN, never re-upload), and each step takes `ctaLabel`/`loading`/`title`/`subtitle` overrides plus `focusSection` (details) for deep links. `StepShell` pins the CTA (+ optional footer) in a shared `BottomActionBar` so save/continue stays visible while the fields scroll — the scroll reserves the bar's measured height as `paddingBottom` (the bar owns the bottom safe-area inset). Its scroll is a **`KeyboardAwareScrollView` from `react-native-keyboard-controller`** (mounted via `KeyboardProvider` at the app root in `app/_layout.tsx`): it lifts the focused field's caret `bottomOffset` above the keyboard (`spacing["3xl"]` — measured to the **caret**, not the field's bottom edge, so it must exceed ~half the 56px input height or the field's lower half hides behind the keyboard) — a clear gap, identical on iOS + Android — replacing the old iOS-only `automaticallyAdjustKeyboardInsets`. The pinned CTA passes **`keyboardBehavior="hide"`** to the shared `BottomActionBar` — it fades out and goes inert (but stays **mounted** — no remount churn) while the keyboard is up, so it can't cover the field, and returns on dismiss. (`BottomActionBar`'s default `keyboardBehavior="lift"` instead rides the bar above the keyboard via `KeyboardStickyView` — used where the CTA should stay reachable while typing, e.g. the customer withdraw form.) `react-native-keyboard-controller` is a **native module** (pinned in root `resolutions`) — adding/updating it needs a native rebuild (`yarn ios:dev` / `yarn android:dev`). Its `KeyboardProvider` is mounted at the root of **both** apps, so any customer or advertiser form can use `KeyboardAwareScrollView`; the advertiser business-page forms are the first adopters. The **payment/funding step is deliberately NOT on this pattern** (its three selection cards are the action, only a tertiary Skip would pin). Hosted by `app/(app)/setup/business-page/` (setup chrome: overline, "Set up later"; no top bar — the wizard pads the top inset itself; creation dismisses the step immediately — no interstitial success screen) and `app/(app)/businesses/create/` (a `TopMenu` with back as the exit — no bottom Cancel button — passing `topInset={false}` so the steps don't re-pad the notch under the bar). Submit = `createBusinessInit` (pending row + presigned S3 POSTs, ~2 min expiry) → `uploadPresigned` per image → `createBusinessConfirm` (server validates the banner is 16:9 + Rekognition-scans every image, promotes, writes details atomically). The gallery photo cap lives once in `@tagly/models` `BUSINESS_MAX_PHOTOS`.

Step 1 chains keyboard flow end-to-end: name's "next" opens the type picker (via the shared `CustomPicker`'s new `pickerRef` prop + `CustomPickerHandle.open()` — available to any form that needs to open a picker imperatively), picking a type focuses the street field, and a bulk insert (iOS address autofill / paste, detected as a 3+ char jump in one change event) hops street → ZIP → city → region picker. Required fields carry a tertiary asterisk (`FieldLabel required`), and while the CTA is disabled a "Still needed: …" caption under it lists the missing fields (same `missing` array drives both, so they can't disagree).

Media picking lives in `utils/pickMedia.ts` (`pickBanner()` cropped to exactly 1920×1080, `pickPhotos(n)` any aspect ratio resized to longest side ≤1920) over `react-native-image-crop-picker` — no config plugin needed (autolinked; photo permission via `react-native-permissions`). Server-side at confirm: banner 16:9 ±0.1, Rekognition moderation (alcohol deliberately unblocked — wineries/bars), and the EN+CS profanity check (`utils/moderation/assertTextAllowedOrThrow`, code 4951) on name/tags/description/instagram. The wizard maps every actionable failure to a specific alert and jumps back to the fixable step (address → basics, flagged image → looks), and persists its draft to `CREATE_BUSINESS_DRAFT` so a restart resumes mid-flow.

## Editing business pages (v2)

Per-business settings live at `(app)/businesses/[uid]/settings/` — a hub (grouped `SettingsSection`/`SettingsRow` from the shared `components/settings/SettingsList`) with three edit sections reusing the `pageForm` steps, plus the danger-zone delete. Each edit save (`basics`/`details`/`media`) shows a **confirmation alert** before committing (the CTA is always on screen via the pinned bar): the screen's `save()` runs its no-change early-out silently, then `customAlert` (`saveConfirm*` copy) gates the real network `commit()` — so an accidental tap can't push a change through:

- **`basics.tsx`** — `StepBasics` seeded from `useBusiness`; save PATCHes only changed keys via `updateBusiness` (address sent whole → the backend re-geocodes + re-runs the country invariant, same codes/alerts as the wizard).
- **`details.tsx`** — `StepDetails` (accepts `?focus=<section>` to open a chip); save PATCHes the whole detail set with `trim() || null` semantics + `openingHours` replace-all. Unchanged link URLs keep their `Link` row + status; new URLs enter PENDING review exactly like create.
- **`media.tsx`** — `StepMedia` seeded with the current banner/photos as `remote` entries; save = `updateBusinessMediaInit` (slots for new files only, keep-by-uid) → `uploadPresigned` → `updateBusinessMediaConfirm` (16:9 + Rekognition, atomic swap); a pure removal calls confirm directly.

**Banned pages are view-only.** `BusinessOwnerDetails.status` is `ACTIVE | BANNED` (owners still see a BANNED page — hiding it would look like data loss; DELETED is never returned). When BANNED: the detail screen renders `components/businesses/BannedBusinessNotice` (soft `dangerBg` card, taps open the shared `SupportSheet` with `context="banned-business"`), hides the edit action, and its "Add …" prompts alert instead of navigating; the settings hub shows the same notice instead of the edit/delete rows (the write endpoints refuse non-ACTIVE pages server-side anyway).

Both init+confirm submit surfaces (the create host and `media.tsx`) call **`useBlockBackWhile(submitting)`** (`hooks/useBlockBackWhile.ts`) — it disables the iOS edge-swipe (`gestureEnabled`) AND swallows the Android hardware back / programmatic `goBack` (`usePreventRemove`) while a two-phase submit is in flight, so a half-done init/confirm can't be abandoned mid-write; hosts hide/cover their own TopMenu. Use it for any future screen with an init+confirm save.

Every save writes the returned `BusinessOwnerDetails` into the `["business", uid]` cache via `setQueryData`. Entry points: the business detail's TopMenu edit action + its dashed "Add …" prompts (deep-linked with focus), and Settings → Business pages (`(app)/businesses` list, auto-forwarding when there's exactly one page). **Delete** (hub danger row) is the two-stage removal — the page vanishes everywhere immediately, in-flight shares still settle and pay, the backend purges the row later; after a successful delete the screen also calls `dismissBusinessSetup()` so deleting the only page lands on the `NoBusinessCard` prompt, not back in the setup gate.

### Statistics

**StatisticCard:**

```typescript
import { StatisticCard } from "@tagly/client";

<View style={{ flexDirection: "row", gap: spacing.statisticsGap }}>
  <StatisticCard
    heading="Balance"
    statistic="$1,234"
    position="left"        // topLeft, topRight, bottomLeft, bottomRight, top, bottom, left, right, center
    onPress={handlePress}
    backgroundIconName="wallet-outline"
    topRightIconName="chevron-forward"
    topRightIconHoverName="chevron-forward-circle"
  />
  <StatisticCard
    heading="Shares"
    statistic="42"
    position="right"
  />
</View>
```

### Lists

**GeneralVerticalList:**

```typescript
import { GeneralVerticalList } from "@tagly/client";

<GeneralVerticalList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  loading={isLoading}
  hasMore={hasMore}
  onEndReached={loadMore}
  emptyHeading="No items"
  emptySubheading="Check back later"
/>
```

**Horizontal Lists:**

- `GeneralHorizontalList` - Generic horizontal list

### Overlays

**BottomOverlay:**

```typescript
import { BottomOverlay } from "@tagly/client";

<BottomOverlay
  open={showModal}
  setOpen={setShowModal}
  type="bottom"  // "bottom" (sheet) or "modal" (centered)
>
  <Text>Content</Text>
</BottomOverlay>
```

**SlideInDrawer:**

```typescript
import { SlideInDrawer } from "@tagly/client";

<SlideInDrawer
  mode="advertiser"
  isOpen={drawerOpen}
  onClose={closeDrawer}
  advertiser={advertiserData}
  colorMode={colorMode}
  setColorMode={setColorMode}
  quickAccessItems={quickAccessItems}
  router={router}
  qc={queryClient}
/>
```

### Pickers

```typescript
import { CustomPicker } from "@tagly/client";

<CustomPicker
  items={[{ label: "Option 1", value: 1 }]}
  value={selected}
  setValue={setSelected}
  open={pickerOpen}
  setOpen={setPickerOpen}
  heading="Select"
  multiple={false}         // Multi-select mode
  searchPlaceholder="Search..."
/>
```

---

## Money Display & Currency Localization

All money is stored as integer cents in USD on the ledger. CZ-locale advertisers see CZK as a courtesy conversion. Two display patterns:

- **Owned/transactional displays** (available/locked balance, credit purchase history, account spend stats): primary USD line + small `≈ X Kč` secondary line. USD stays the "real" number.
- **Estimate displays and the Account statistics**: one currency only — plain `formatBudget(cents)` (CZK for CZ users, USD otherwise), no dual lines.

Use the `useFormatBudget()` hook from `@tagly/client` — it reads the viewer's locale and current USD→CZK rate from `ExchangeRateContext`, so call sites don't have to thread either:

```typescript
import { useFormatBudget } from "@tagly/client";

const formatBudget = useFormatBudget();

// Estimate site (CZK for CZ, USD for US)
formatBudget(cents);

// Dual-display primary (always USD)
formatBudget(cents, { forcedCurrency: "USD" });

// Dual-display secondary (≈ X Kč; empty string when no CZK conversion available)
formatBudget(cents, { asCzkSecondaryLine: true });
```

For dual display inside `StatisticCard`, pass the secondary line via the `subStatistic` prop — empty string is rendered as nothing, so no extra gating is needed:

```tsx
<StatisticCard
  statistic={formatBudget(cents, { forcedCurrency: "USD" })}
  subStatistic={formatBudget(cents, { asCzkSecondaryLine: true })}
/>
```

The rate is fetched from frankfurter.app once per 24h on app launch, only for CZ users. If unavailable, the hook silently falls back to USD. The `ExchangeRateProvider` is mounted in `(app)/_layout.tsx` after the advertiser loads.

The pure `formatBudget(cents, opts?)` from `@tagly/client` is still exported for USD-only contexts (admin dashboard, tests) — it does not know about locale or rate.

Strings interpolated inside `t()` should stay USD unless a translator handles them. `$` prefixes on credit-purchase / withdraw inputs also stay USD — the underlying input is denominated in USD.

**The ROI calculator was removed** (v2 cull): no `RoiSheet`, no `constants/roiCalculator.ts`, no estimated-new-customers stat. Don't resurrect pieces of it without a fresh design.

## App-Specific Features

### Contexts

| Context             | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `AdvertiserContext` | Main advertiser data (locals, shares, balance) |
| `ColorThemeContext` | Light/dark mode, colors                        |
| `DrawerContext`     | Slide-in drawer state                          |
| `UnratedShares`     | Tracks unrated shares                          |

**Shared contexts (from `@tagly/client`, used by both apps):** `UserPreferencesProvider` / `useUserPreferences` (distance unit, 24h time, display language) and `CurrentLocationProvider` / `useCurrentLocation` (GPS coords). These replaced the former app-local `AppSettings` and `CurrentLocation` contexts.

### Key Screens

| Screen              | Route                                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                | `(app)/(tabs)/home`                  | v2 hub: the **account card** (one skeleton, three states — healthy: Visible pill + Credits\|PAYG peer ledger with dynamic emphasis + ink-filled "Manage wallet" footer row; broken: danger band (stamp + explainer, no headline) + muted ledger (cells open the sheets) + the same ink "Manage wallet" footer; no-business: the same danger band/stamp + the same ink footer CTA; every state ends in the shared ink footer CTA), the "shares to rate" strip, and a recent-shares strip — always rendered (dashed ghost tiles fill an empty/short row; an empty strip adds a "no shares yet" caption), with the shared `SectionHeader`/`SeeAllButton` ("See all" shown only with ≥1 share; no refresh button on home). No statistics on home — lifetime stats live on the Account tab. Reads `budgets`/`visible` off `AdvertiserMe`; fetches `shares` + `shares/unrated` on mount (re-pulled after funding/assessment actions). The account card itself is the reusable `components/billing/BudgetCard` (or `components/businesses/NoBusinessCard` without a page) — home just owns the sheets and the "Manage wallet" footer.                                                                                                                                                                                                                                                                              |
| Wallet              | `(app)/(tabs)/wallet`                | The money hub: the `VisibilityCard` not-visible strip (renders only while dark), then **`FundingSurface`** — the entire funding body, identical to the onboarding payment step, which owns every billing sheet so this screen wires none — then the latest slice of the unified money feed (`POST /v2/advertisers/transactions`) with "See all" → `/transactions`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Transactions        | `(app)/transactions/`                | Full paginated money feed (deposits + share spend + credits) with a multi-select type-filter sheet; rows are the expandable `components/billing/TransactionPreview` (twin of the customer's).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Account             | `(app)/(tabs)/account`               | Identity/results dashboard: the `VisibilityCard` not-visible strip (renders only while dark), profile header (with the "Provide feedback" corner tile → the shared `FeedbackSheet` from `@tagly/client` — promoted from the customer app, posts to `POST /v2/cross/feedback`), business-pages strip (`GET /v2/advertisers/me/businesses` → `components/businesses/BusinessPreviewCard` + dashed add tile), customer-account-style statistics (a featured total-reach card + a 2-col grid of icon-row cards — green chip = money, blue chip = counts; value text stays primary ink since advertiser money is spend, not earnings; money stats show ONE currency via plain `formatBudget(cents)` — CZK for CZ, USD otherwise, no ≈ lines). No recent-shares strip here — that lives only on the Home hub (repeating it would duplicate it). Invite & earn (→ `/referrals`), settings, and log-out live in the drawer (`components/drawer/AdvertiserDrawer` — grouped nav card, customer-drawer pattern).                                                                                                                                                                                                                                                                                                                                                                                                      |
| Referrals           | `(app)/referrals/`                   | Invite & earn (`GET /v2/advertisers/me/referrals`): earnings + referred counts, copyable code/join link + native share, server-computed rates. No leaflet/QR (v2 text-cull).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Shares              | `(app)/shares/`                      | Paginated grid of the advertiser's shares (`POST /v2/advertisers/shares`), sortable. Tap → detail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Share detail        | `(app)/shares/[uid]/`                | One share (`GET /v2/advertisers/shares/:uid`) + status chip (derived `AdvertiserShareStatus`) + the rate/report CTA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Drawer              | `components/drawer/AdvertiserDrawer` | The global quick-glance + utility surface (shared `SideDrawer`, opened from every tab's `TopMenu` menu button), reworked to mirror `CustomerDrawer`: profile (business icon + email + member-since) → **visibility glance** (open on the cream, no card so the nav card is the only white surface — "Visible"/success or a tappable "Not visible" → `VisibilitySheet` via the shared `useVisibilityCause`) → **main nav card** (grouped, hairline dividers: Invite & earn → `/referrals`, Settings → `/settings`) → **"More"** demoted rows (How it works → `/how-it-works`; About pricing → shared `RewardInfoSheet` `variant="advertiser"`; Contact support → shared `SupportSheet`; Send feedback → shared `FeedbackSheet`) → destructive Log out.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Settings            | `(app)/settings/`                    | Settings hub (the grouped-list pattern lives in the shared `components/settings/SettingsList` — `SettingsSection`/`SettingsRow`, also used by the per-business hub), mirroring the customer settings surface. Sections: **Account & security** (Email → `/settings/email` dual-OTP change; Security → `/settings/security` sign-out-other-devices; Referrals → `/settings/referrals` edit code + set referrer), **Business** (Business pages → `/businesses`), **Preferences** (Language → `/settings/preferences`, language-only — no distance/time toggles, unlike the customer), **Notifications** (Push/Email → `/settings/notifications/{push,email}`, the shared `components/settings/NotificationSettings` body against the advertiser SDK), **Legal** (privacy + terms external openers), and **Danger zone** (Delete account → `/settings/delete`). Log out + Invite & earn stay in the drawer; billing stays in Wallet. Each sub-screen is an exact twin of `tagly-customer/app/(app)/settings/*` except: no profile/name/gender/interests (advertiser identity is just the email), no Instagram/Stripe-payout/story-views surfaces, and delete forfeits credits (no Connect balance sweep — `1305` = owes money → contact support). Backend: `/v2/advertisers/me/{email,security,delete-account,update,notifications}`; the notification-settings DTO is shared via `@tagly/models/v2/crossApp`. |
| Business pages list | `(app)/businesses/`                  | Settings' manage door: full-width `BusinessPreviewCard`s → each page's settings hub (+ a dashed add row → create). Auto-forwards to the single page's settings when there's exactly one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Business settings   | `(app)/businesses/[uid]/settings/`   | Per-business manage hub + `basics`/`media`/`details` edit screens + delete — see "Editing business pages (v2)".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| How it works        | `(app)/how-it-works/`                | Re-surfaces the onboarding `Welcome` carousel in its `variant="guide"` (back-arrow exit, no Skip/Get-started) — one canonical carousel, two entry points, mirroring the customer's how-it-works.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### Shares & rating (v2)

Reusable pieces under `components/shares/` back the home strips, the shares list,
and the detail screen:

| Component              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/`              | **The canonical share copy + status identity** (twin of `components/billing/shared/`). `shares.{en,cs}.json` (feature-level `shares` namespace) holds the status labels, report reasons, and the small spend/assessment tags; `useShareStatusDisplay.ts` exports `useAdvertiserShareStatusDisplay` (label + icon + tone per `AdvertiserShareStatus`), consumed by the preview pill AND the detail screen's status card so they can't disagree. Never write per-surface status labels or report-reason lists. **UNPAYABLE reason lines are deliberately coarse** (Matej, 2026-08-02): the detail screen maps the backend `Share.voidReason` slug to exactly two lines — `INSIGHTS_UNAVAILABLE` gets its specific line, every other slug (disconnect / data deletion / account deletion / settlement failure / null) collapses to the generic `statusUnpayableDesc` — because the specific cause is irrelevant to the payer; both variants state they won't pay. Don't re-add per-slug advertiser copy (the customer app is the one that differentiates). **Copy voice:** the unit is a "share"/"sdílení" (never "post"/"příspěvek"/"verified post"), and the settlement moment is "the reward was paid" ("odměna zaplacena"/"zaplaceno") — never accounting settle-speak ("zúčtováno") and never the customer's payout language ("vyplaceno"). |
| `SharePreviewCard`     | Media-filling share card (customer-style): real aspect ratio, a top-right status pill for the **derived 5-state `AdvertiserShareStatus`** (PROCESSING / REPORT_REVIEW / PAID / REJECTED / UNPAYABLE — see backend `deriveAdvertiserShareStatus`) via the shared `useAdvertiserShareStatusDisplay`, and a translucent bottom bar (business, spend line, rating state). Parent supplies `onPress` + `width`. Replaced the old `AdvertiserShareCard`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ShareAssessmentSheet` | **The reusable rate/report bottom sheet** (`BottomSheet`). Mount it wherever a share is shown; drive `open` + `share` from parent state and swap the returned share via `onAssessed`. One endpoint (`submitShareAssessment`), a discriminated `RATING` \| `REPORT` body. Report reasons render from the shared `shares` namespace. A successful **rating** (never a report) also queues the shared store-review ask (`queueStoreReview` from `@tagly/client`); **Home** consumes it (`consumePendingStoreReview` on focus + after an on-screen assessment, deferred via `InteractionManager`) — the queue/consume pair, same as the customer app. **Hosts should also pass `onConflict`**: a 4093 (assessed elsewhere — the once-only CAS) means the host's copy of the share is stale, so the sheet alerts, fires `onConflict`, and closes; the host drops/refetches its stale item (Home silently re-pulls the unrated queue, the detail refetches the share so the gated sheet releases). Home additionally re-pulls the unrated strip on focus, gated on `unratedCount > 0` so an empty strip costs no request (E046).                                                                                                                                                                                                                    |
| `StarRating`           | **Moved to `@tagly/client`** (`components/primitives/StarRating`) — half-star display + input (1–10 units), shared with the admin app's subsidized-rating queue. Import from `@tagly/client`, not app-local.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

The share detail's price ⓘ opens the **shared `RewardInfoSheet` with `variant="advertiser"`** (`tagly-shared/client/components/feedback/RewardInfoSheet`) — the same six qualitative factors the customer sees (reach, location, audience, quality, frequency, reshares), worded for the payer. Never write a separate price/reward explainer; if a factor changes, it changes for both voices in that one component.

**Rating philosophy (do not break):** the advertiser rates **post quality only** —
a signal of how good this customer's posts tend to be, feeding the customer's
reward multiplier. It is NOT a judgement of the post's performance (reach/insights)
or price, so the assessment sheet shows **only the post** (media, business, type),
and the `AdvertiserSharePreview` DTO deliberately carries no per-share insights.
See `docs/SHARE_LIFECYCLE.md` §Share rating. A share is assessed exactly once
(rate OR report, no change window); once assessed the sheet is read-only.

---

See [README.md](README.md) for commands.
