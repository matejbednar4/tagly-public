# i18n Localization Guide

> ## ⚠️ THE STANDARD (v2) — colocation, always
>
> **Every component/screen lives in its own folder, with its translation files next
> to it.** A component is `Name/index.tsx` + `Name.en.json` + `Name.cs.json` in the
> same folder (see `tagly-customer/app/(onboarding)/otp/` or
> `tagly-shared/client/components/previews/BusinessPreview/`). Never put a component's
> strings in a far-away catalog.
>
> - **There is no central `locales/` catalog.** It has been deleted. Each namespace
>   is a colocated `*.en.json`/`*.cs.json` pair.
> - **Registering:**
>   - *App* namespaces (customer/advertiser) → import the JSONs in that app's
>     `i18n/appLocales.ts` and `registerLocale("ns", { en, cs })` + augment
>     `TaglyI18nResources`. App-wide shared strings with many consumers may live in
>     the app's own `i18n/` folder (e.g. `tagly-customer/i18n/commonCustomer.*`).
>   - *`tagly-shared/client`* namespaces → import the colocated JSONs in
>     `tagly-shared/client/i18n/index.ts` and add them to `enResources`/`csResources`
>     (the type is derived from there).
> - **en/cs parity is mandatory** (same keys). Each file starts with a `"//"` key
>   noting where it's used.
> - `useCatalogLocalizer` maps **data** slugs (verticals/interests/types) to display
>   names — that's not UI copy and is unaffected.
>
> Everything below this banner describes the **old central-catalog system, now
> removed**. It is kept only as historical reference while v1 namespaces are purged;
> follow the banner, not the legacy sections.

---

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../../../CLAUDE.md).

## Voice & terminology (customer-facing copy)

Product-wide copy rules, not infra. They keep the customer's mental model straight, so
apply them to **every** customer-facing string (EN + CS) you write or touch.

- **Never frame the act as "share the business" / "sdílet podnik".** The customer posts
  a story on **their own Instagram**, so Tagly doesn't share anything for them. Saying
  "share this business" is both redundant (they're already going to Instagram) and
  ambiguous (reads like an in-app share button). This was the original mistake on the
  "Earn here" CTA (`Sdílet podnik`) and the create screen.
  - ✅ "Earn here" / "Získat odměnu zde": entry CTAs lead with the **reward**, not the mechanic.
  - ✅ "Select a story that features {business}" / "Vyber story, ve kterém je {business}":
    the create screen is a **selection** (the story is already posted), framed by what
    the story *contains*, never "share the business".
  - The nuance: **"share a story" (the literal Instagram action) is fine.**
    `rewardSentence` "for sharing a story from this business" is accurate. What's banned
    is "share **the business**" as the user's in-app action.
- **Czech "earn":** prefer the reward framing **"získat odměnu"** over the bare imperative
  **"vydělej"** (reads blunt/greedy). Buttons use the **infinitive** ("Získat odměnu zde",
  matching "Pokračovat"); the descriptive eyebrow likewise uses "získat" ("Můžeš získat cca").
- **Lead with value, not mechanism.** Entry points sell the reward ("Earn here"). The one
  screen that needs to explain *how* (the story must feature the place) is the create
  screen, so explain it there, once, and nowhere else.
- **"story" is neuter and invariable in CS** ("**to** story", never "ta story"), so every
  agreement word takes the **neuter** form: "žád**né** story" (not "žádná"), "ve kter**ém**
  je …" (not "ve které"), "story se nepodaři**lo** načíst" (not "nepodařila"). Keep it
  consistent within a namespace rather than mixing with the diminutive "storýčko".
- **The customer's unit is a "story", never "příspěvek"/"post"** — the product pays for
  Instagram stories, so all customer-facing copy names them. (The advertiser-facing unit
  is a "share"/"sdílení" — see `tagly-advertiser` components' `shares/shared`.)
- **Earning from content is "vydělávat *za* svoje stories"**, never "vydělávat *na* svých
  stories" (reads wrong to native speakers). EN counterpart: say **"the reach you already
  have"**, not "your (real) local reach" — explain the local-reach concept only where it
  is genuinely being taught.
- **No em dashes in copy** (EN or CS) — plain punctuation only: periods, commas,
  parentheses. Dashes are fine in code comments and docs, never in user-facing strings.
- **Full-sentence Czech, no clipped fragments.** Notification and UI strings read as
  complete sentences in both languages.
- **Gendered past forms ("zvládl/a", "získal/a") — avoid where a rephrase is natural**
  (present tense, imperative, or noun constructions: "Pokud je tato změna od tebe…",
  "…a zjisti, co je potřeba opravit", "můžeme tě požádat o…"). This is NOT absolute:
  when every genderless rephrase is weaker, the gendered form wins — the recorded
  exceptions are the share-payout push title **"💸 Získal/a jsi {amount}"** (chosen over
  "Máš odměnu {amount}") and the promo-credit push title **"🎁 Dostal/a jsi od nás
  kredity"** (chosen over "Máš kredity zdarma"). Don't "fix" recorded exceptions; flag
  new borderline cases for a product call.
- **Marketing emails (EN + CS): the master message is "the stories you already post can
  make you money"** — lead with it or land on it. Cut reach/audience-economics
  explanations; at most one concrete clause where genuinely needed. The advertiser
  twin: "Tagly turns your customers into your marketing, and it calculates what each
  story is worth". **Never tell advertisers their customers "already" post stories** —
  it invites "why pay for what happens anyway?". The "already" framing is customer-side
  ONLY; on the advertiser side the stories are what the budget causes.
- **There is no such thing as a "verified story" / "ověřené story".** A story is just
  a story; Tagly calculates the reward for it. Never "verified" as an adjective on
  story, and never pitch payment as being "for verified stories". The one sanctioned
  use is the verb for the automatic check ("we verify it automatically" / "my story
  ověříme") in customer copy.
- **Money-language glossary** (details in the gotchas below): a completed reward is
  "**zaplaceno**", never "vyplaceno"; taking money out is a "**výběr (peněz)**", never
  "výplata"; pay-as-you-go is "**průběžné platby**", ALWAYS plural (never "průběžná
  platba je…" — always "průběžné platby jsou…").

These apply to every user-facing string — app UI, notification templates
(`tagly-backend/.../transactionalCatalog.ts` + promo catalog), and marketing email copy.

---

This directory contains all internationalization infrastructure for the Tagly apps. Both `tagly-customer` and `tagly-advertiser` are localized. Locale files are organized into `shared/` (consumed by `tagly-shared/client`, reusable by every app) and per-app folders (`customer/`, `advertiser/`).

## Overview

The app supports two languages: English (`en`) and Czech (`cs`). Translation is done with **i18next** + **react-i18next**, initialized synchronously so no async loading is needed at runtime.

**Supported languages:** `en` (default), `cs`  
**Current progress:** Both apps are fully localized.
- `tagly-customer`: screen body files, `components/`, the navigation `_layout.tsx` header titles (via the `navigation` namespace), and the customer-reachable `tagly-shared/client/` components.
- `tagly-advertiser`: all `app/` screens + `components/` (auth, tabs, business pages, shares/rating, credits, ROI calculator, leaflet, the full settings cluster), the advertiser-reachable `tagly-shared/client/` surfaces (owner/advertiser keys that the customer pass left in English), plus user-facing strings in `utils/` (pdf alerts via `pickMedia`/`pdfUtils`). **SEO/web-only strings stay English** — every `PageHead title="…"` and `PageHead.tsx`'s `SITE_NAME`/`SITE_DESCRIPTION` are intentionally NOT translated; `navigationAdvertiser` covers only the visible `ResponsiveTopMenu` titles.

Both apps use the **informal register (tykání)** — see the Czech-register gotcha. Because the register is identical, a single `cs/shared/<ns>.json` serves both apps with no `cs-x-formal` variant or per-app language mapping.

### Two storage patterns — colocated (default) vs central `locales/`

Translation JSON is stored in one of two ways; which you use depends on **who consumes the namespace**:

1. **Colocated — the default for app screens/components.** A `Component.en.json` + `Component.cs.json` pair lives **next to its component**, and the app registers it at boot via `registerLocale(...)` in `<app>/i18n/appLocales.ts` (a per-app registry imported once in `app/_layout.tsx`). New app code uses this; existing app screens migrate to it as they're rebuilt. → see [Colocated namespaces](#colocated-namespaces-v2--preferred-for-app-screens).
2. **Central `locales/` — for `tagly-shared/client` + not-yet-migrated screens.** JSON lives in `tagly-shared/client/i18n/locales/{en,cs}/{shared,customer,advertiser}/<ns>.json`, imported + registered in `index.ts`. The **`shared/` folder stays here permanently** — `tagly-shared/client` is a shared package and an app can't co-locate strings into it. The **`customer/` and `advertiser/` folders are legacy**, being migrated to colocation screen-by-screen.

The per-file mechanics (`useTranslation("ns")`, en/cs key parity, the gotchas below) are **identical** for both patterns — only *where the JSON lives and how it's registered* differs. The Directory Structure / namespace tables below describe the **central** system; colocated namespaces are documented in their own section.

---

## Directory Structure

```
i18n/
├── index.ts                # i18next init + setAppLanguage()
├── detectLocale.ts         # getLocaleDefaults() — reads device OS locale
├── useCatalogLocalizer.ts  # hook mapping catalog slugs (verticals/interests/types/…) to the active language's display name
└── locales/                # CENTRAL namespaces (tagly-shared/client + not-yet-migrated app screens)
```

> Each **app** also keeps a colocated registry at `<app>/i18n/appLocales.ts` that registers the `*.{en,cs}.json` pairs living next to its components (see [Colocated namespaces](#colocated-namespaces-v2--preferred-for-app-screens)). `index.ts` exports `registerLocale` for exactly that. The tree below is the **central** system only.

Locale files are grouped first by **language**, then by **consumer** (`shared/` = used by `tagly-shared/client` components and reusable by every app; per-app folders = used only by that app's screens/components). Each namespace lives in exactly one consumer folder, and the file layout is mirrored 1:1 across every language. Total: **70 namespaces** (14 shared + 32 customer + 24 advertiser).

```
locales/
├── en/                         # English — source of truth
│   ├── shared/                 # consumed by tagly-shared/client (reusable by all apps)
│   │   ├── apiErrors.json
│   │   ├── appUpdate.json
│   │   ├── businessDetail.json
│   │   ├── common.json         # cross-app: earnHere, localBusinessPlaceholder, picker*
│   │   ├── contentGuides.json
│   │   ├── createLocal.json
│   │   ├── drawer.json
│   │   ├── interests.json
│   │   ├── ledger.json
│   │   ├── legal.json
│   │   ├── referral.json
│   │   ├── shareDetail.json
│   │   ├── sharePreview.json
│   │   └── typeSelector.json
│   ├── customer/               # consumed only by tagly-customer
│   │   ├── account.json
│   │   ├── balanceHistory.json
│   │   ├── commonCustomer.json # customer-only: tabs, drawer, balance, withdrawal, toast…
│   │   ├── guides.json
│   │   ├── profile.json
│   │   ├── shares.json
│   │   └── … (32 total)
│   └── advertiser/             # consumed only by tagly-advertiser
└── cs/                         # Czech — mirrors en/ exactly
    ├── shared/
    ├── customer/
    └── advertiser/
```

### Folder rules

- **Language is the top folder; consumer is the second folder.** A namespace is `shared/` if any `tagly-shared/client` component consumes it; otherwise it belongs to the app that uses it.
- **One namespace = one file in one folder.** If a namespace mixes keys used by shared components and keys used only by one app, **split it**: keep the shared keys in a `shared/` namespace and move the app-only keys into an app namespace (e.g. `shares` → `customer/shares.json` + `shared/sharePreview.json`).
- **Namespace names are flat at runtime.** The folder is organizational only; i18next still registers each file under its bare namespace name in `index.ts`. Two namespaces may not share a name even across folders.
- **`en` and `cs` must stay identical** in file set and key set. Add/relocate/split in both languages in the same change.
- **Every namespace file starts with a `"//"` comment** listing the components/screens that consume it.

### Adding a new app namespace

**For a new app screen/component, prefer colocation** — `Component.{en,cs}.json` next to the component + `registerLocale` in `<app>/i18n/appLocales.ts` (see [Colocated namespaces](#colocated-namespaces-v2--preferred-for-app-screens)). The central-`locales/` route is only for **`tagly-shared/client`** namespaces or adding to the **legacy** central set: create `advertiser/<namespace>.json` files (en + cs in tykání), register both imports + both `resources` entries in `index.ts`, and reuse the existing `shared/` namespaces for anything rendered by `tagly-shared/client`. Suffix the name with `Advertiser` only if it would collide with a customer namespace.

---

## How the Infrastructure Works

### Initialization

`index.ts` calls `i18n.use(initReactI18next).init(...)` with all locale JSON files bundled inline — no network fetch, no async loading. The call site that triggers this is the `import "@tagly/client"` in `tagly-customer/app/_layout.tsx`.

Because `initImmediate: false` is set, i18n is ready synchronously before the first render. **No `I18nextProvider` is needed** — `useTranslation` works anywhere in the tree.

### Compile-time type safety

`index.ts` is type-safe: `useTranslation(ns)` only accepts real namespace names and `t(key)` only accepts keys that exist in the selected namespace (with autocomplete). A typo or wrong namespace is a `tsc` error instead of a silent raw-key render.

How it works: the `en`/`cs` resources are named consts (`enResources`/`csResources`); `export type AppResources = typeof enResources` derives the contract from English; and a `declare module "i18next"` block at the bottom of `index.ts` feeds `AppResources` (+ `defaultNS: "common"`) into i18next's `CustomTypeOptions`. The augmentation **lives in `index.ts` on purpose** — both apps import `@tagly/client`, which re-exports this file, so it's guaranteed to be in each app's TS program. A standalone `.d.ts` here would sit outside the apps' tsconfig `include` globs and be silently ignored.

**Limits / notes:**
- **Interpolation variables are NOT type-checked** (`t("k", { name })`). i18next needs literal string values to parse `{{name}}`, but JSON imports widen values to `string`. Out of scope to add (would need codegen).
- **Key names are derived from English only.** en/cs parity is still a runtime concern — use the `node -e` parity script (see Verification commands), not the compiler.
- **The `"//"` comment key is a valid key** in every namespace (harmless; nothing calls `t("//")`).

### Language Detection & Persistence

The language-switch lifecycle previously lived in `tagly-customer/contexts/AppSettings.tsx` (`AppSettingsProvider`). **That file has been removed**, so the runtime language-switch lifecycle is currently disabled, pending the v2 rewrite. The underlying primitives still ship:

1. First-launch detection: `getLocaleDefaults()` from `detectLocale.ts` reads the `expo-localization` OS locale. **Language follows the device's preferred *languages*, not its region** — the first supported entry in the preference-ordered `getLocales()` list wins, and `cs`/`sk` both map to `"cs"` (Slovak speakers read Czech; there is no Slovak translation), everything else to `"en"`. Region was the old signal and got expats wrong both ways (a Czech phone abroad opened in English; an English phone in Czechia opened in Czech). **Distance unit still reads the region's `measurementSystem`**, which genuinely is a where-you-are question.
2. Persistence: the stored language lives under `AsyncStorage` key `SHARED_LOCAL_KEYS.DISPLAY_LANGUAGE`.
3. Applying a language: `setAppLanguage(lang)` switches the active i18next language (and keeps dayjs in sync).

`setAppLanguage` and `getLocaleDefaults` are exported from `@tagly/client` (via `tagly-shared/client/index.ts`). What's missing until the v2 rewrite is the provider that wired these together on boot and on a manual settings change.

### Known Limitation — Language Flash on Cold Boot

i18next starts with `lng: "en"` synchronously. Once the language-switch lifecycle is reintroduced (it lived in the now-removed `AppSettingsProvider`), switching to the stored language happens in a `useEffect` (async), so Czech users will see one English render before the language flips. This is deferred — it will be addressed as part of the v2 rewrite, potentially by adding a "language hydrated" gate before rendering.

---                   

## Namespace System

There is **one namespace per screen/feature area**. Every namespace file in `locales/en/` has an identical counterpart in `locales/cs/`. Both must be kept in sync.

### All 70 Namespaces

#### `shared/` (14) — consumed by `tagly-shared/client` components

| Namespace | Consumers |
|-----------|-----------|
| `common` | `CustomPicker(Modal)`, `RewardInfo` — cross-app keys only: `earnHere`, `localBusinessPlaceholder`, `picker*` |
| `drawer` | `SlideInDrawer.tsx`, `AboutSheet (feedback/AboutSheet)` |
| `appUpdate` | `UpdateRequiredModal.tsx` |
| `legal` | `AcceptLatestTosModal.tsx`, `AcceptLatestPrivacyPolicyModal.tsx` |
| `referral` | `ReferralStatisticsComponent.tsx`, `QRCodeModal.tsx` |
| `shareDetail` | `ShareDetails/*` (+ customer `app/(app)/shares/[uid].tsx` for `topMenuSubtitle`) |
| `businessDetail` | `LocalDetails/*`, `LocalPreviewNormal/Small` (+ customer `app/(app)/businesses/[uid].tsx` for `topMenuSubtitle`) |
| `ledger` | `BalanceChanges.tsx`, `CustomerLedgerEventPreviewSmall.tsx` (ledger-event kinds/descriptions) |
| `sharePreview` | `SharePreviewNormal.tsx` (`preview*` keys) |
| `interests` | `InterestsSelector.tsx` |
| `contentGuides` | `OtherBusinessNamesInfo.tsx`, `InstagramTagOptions.tsx` |
| `apiErrors` | `tagly-shared/client/api/caller.ts` — alert titles/messages for transport, validation, OTP, rate-limit (i18next plurals), session and update-required fallbacks |
| `createLocal` | `forms/CreateLocalFormBase.tsx` — create/update local form (advertiser-authored keys live in this shared namespace) |
| `typeSelector` | `pickers/TypeSelector.tsx` — business-type selector (advertiser-authored keys live in this shared namespace) |

#### `customer/` (32) — consumed only by `tagly-customer`

| Namespace | Primary screen / file |
|-----------|----------------------|
| `commonCustomer` | `BottomNavigation`, `BalanceDisplay`, `LatestSharesHeading`, `LocationPermissionNotGranted`, `EmailEntryForm`, `_layout.tsx`, `settings/account/email.tsx` — tabs, drawer items, balance/withdrawal labels, toasts, `exampleEmail` |
| `landing` | `LandingHeroStep.tsx`, `EmailEntryForm.tsx`, `LandingPage.tsx` |
| `otp` | `ConfirmOtpForm.tsx` |
| `profile` | `ProfileForm.tsx` (form fields; interest-selector keys live in shared `interests`) |
| `connectInstagram` | `ConnectInstagramForm.tsx`, `ConnectInstagramCard.tsx` |
| `loginCancelled` | `login-cancelled.tsx`, `cancelComponents.tsx` |
| `pageDidntLoad` | `page-didnt-load.tsx` |
| `professionalAccount` | `professional-account.tsx` |
| `home` | `app/(app)/(tabs)/home.tsx` |
| `map` | `app/(app)/(tabs)/map.tsx`, `MapControls.tsx`, `BusinessMap.tsx` |
| `account` | `app/(app)/(tabs)/account.tsx` |
| `myContent` | `app/(app)/(other)/my-content.tsx` |
| `visited` | `app/(app)/(other)/visited.tsx` |
| `monetize` | `shares/create/index.tsx`, `monetize/*.tsx`, `SelectShareBusiness.tsx`, `BusinessFirstPicker.tsx`, `InstagramContentPicker.tsx`, `InstagramMediaPreview.tsx`, list components |
| `confirmShare` | `shares/create/confirm.tsx`, `ConfirmMonetization.tsx` |
| `shares` | `app/(app)/shares/index.tsx` (list/screen keys; `preview*` keys live in shared `sharePreview`) |
| `balanceHistory` | `app/(app)/balance/history.tsx` (screen keys; ledger-event keys live in shared `ledger`) |
| `withdrawals` | `app/(app)/balance/withdrawals.tsx`, `WithdrawalPreviewSmall.tsx`, `LatestWithdrawals.tsx` |
| `stripe` | `StripeConnectSetup.tsx`, `WithdrawWithStripe.tsx` |
| `storyViews` | `StoryViewsModal.tsx` |
| `settings` | `app/(app)/settings/index.tsx` |
| `settingsApp` | `app/(app)/settings/app.tsx` |
| `settingsInstagram` | `app/(app)/settings/instagram.tsx`, `InstagramPermissionInfoModal.tsx` |
| `settingsAccount` | `settings/account/index.tsx`, `delete.tsx`, `email.tsx`, `forms/account/*.tsx` |
| `settingsReferrals` | `settings/account/referral.tsx`, `forms/referrals/*.tsx` |
| `settingsNotifications` | `settings/notifications/email.tsx`, `push.tsx` |
| `instagram` | `ConnectInstagramCard.tsx` |
| `confirmInstagramAction` | `ConfirmInstagramActionModal.tsx` |
| `guides` | `app/(app)/guides/index.tsx` (guide cards; guide-content keys live in shared `contentGuides`) |
| `monetizationGuide` | `app/(app)/guides/monetization.tsx` |
| `appOpenModal` | `AppOpenModal.tsx` |
| `navigation` | all `app/(app)/**/_layout.tsx` header titles (`Stack.Screen options.headerTitle`) + `(tabs)/_layout.tsx` `TopMenu title=` |

#### `advertiser/` (24) — consumed only by `tagly-advertiser`

| Namespace | Primary screen / file |
|-----------|----------------------|
| `commonAdvertiser` | `BottomNavigation`, headings, `utils/pickMedia.native.ts` (crop/picker alerts), `app/+not-found.tsx` — tabs + cross-cutting strings |
| `navigationAdvertiser` | all `app/(app)/**/_layout.tsx` visible `ResponsiveTopMenu` titles (SEO `PageHead` titles stay English) |
| `landingAdvertiser`, `login`, `register`, `otpAdvertiser`, `forgotPassword` | auth screens + forms |
| `homeAdvertiser`, `credits`, `accountAdvertiser` | tab screens |
| `creditsHistory`, `creditsPurchases` | credits flow |
| `businessPages`, `updateLocal` | business-page index/[uid]/create + create/update/delete local forms |
| `sharesAdvertiser`, `rating` | shares list/detail, rate flow, RatingUI/ReportModal |
| `roi` | `app/(app)/(other)/roi.tsx`, `components/roiCalculator/CalculateRoiComponent.tsx` |
| `leaflet` | `app/(app)/(other)/leaflet.tsx`, `utils/pdfUtils.{native,web}.ts` (pdf fallback alert + share dialog title) |
| `settingsAdvertiser` | `settings/index.tsx` |
| `settingsAppAdvertiser` | `settings/app.tsx` (incl. language switcher) |
| `settingsAccountAdvertiser` | `settings/account/{index,email,password,delete}.tsx` + `forms/updates/advertisers/{ChangePassword,ConfirmPassword}Component.tsx` |
| `settingsReferralsAdvertiser` | `forms/updates/referrals/{UpdateReferralCode,UpdateReferrerCode}Component.tsx` (rendered by `settings/account/referral.tsx`) |
| `settingsNotificationsAdvertiser` | `settings/notifications/{email,push}.tsx` (shared `CategoryRow`/`EventRow` live in `email.tsx`) |
| `settingsBusinessPages` | `settings/business-pages/{index,[uid]}.tsx` |

Advertiser-exclusive keys that the customer never renders (e.g. `shareDetail.*Advertiser`, `businessDetail` owner-mode keys, `ledger` advertiser keys, `typeSelector`, `createLocal`) live in the **tagly-shared/** namespaces alongside the customer keys and are authored in tykání like everything else. Namespaces carry the `Advertiser` suffix only where they would collide with a customer namespace (names are globally flat).

---

## Implementation Status

### Fully wired — `tagly-customer/components/` (all done)

All 42 components are localized. The text-bearing ones use `useTranslation`; the remaining 5 have no user-visible text of their own (layout/animation only: `LandingPage.tsx`, `MapPreview.tsx`, `FindBusinessOnMap.tsx`, `ZoomOnFocus.tsx`, `TopMenu.tsx`). Note `TopMenu.tsx` renders only **caller-provided** titles — its callers (e.g. the navigation `_layout.tsx` files) pass already-translated strings.

| Component | Namespace |
|-----------|-----------|
| `components/AppOpenModal.tsx` | `appOpenModal` |
| `components/balance/BalanceDisplay.tsx` | `commonCustomer` |
| `components/balance/LatestWithdrawals.tsx` | `withdrawals` |
| `components/bottomNavigation/BottomNavigation.tsx` | `commonCustomer` |
| `components/forms/account/AccountSettingsEmailComponent.tsx` | `settingsAccount` |
| `components/forms/account/ChangeGenderComponent.tsx` | `settingsAccount` |
| `components/forms/account/ChangeInterestsComponent.tsx` | `settingsAccount` |
| `components/forms/account/ChangeNameComponent.tsx` | `settingsAccount` |
| `components/forms/referrals/UpdateReferralCodeComponent.tsx` | `settingsReferrals` |
| `components/forms/referrals/UpdateReferrerCodeComponent.tsx` | `settingsReferrals` |
| `components/headings/LatestSharesHeading.tsx` | `commonCustomer` |
| `components/instagram/ConfirmInstagramActionModal.tsx` | `confirmInstagramAction` |
| `components/instagram/ConnectInstagramCard.tsx` | `instagram` |
| `components/landing/auth/ConfirmOtpForm.tsx` | `otp` |
| `components/landing/auth/ConnectInstagramForm.tsx` | `connectInstagram` |
| `components/landing/auth/EmailEntryForm.tsx` | `landing` (+ `commonCustomer` for `exampleEmail`) |
| `components/landing/auth/LandingHeroStep.tsx` | `landing` |
| `components/landing/auth/ProfileForm.tsx` | `profile` |
| `components/landing/cancelComponents.tsx` | `loginCancelled` |
| `components/lists/InstagramPostsReelsList.tsx` | `monetize` |
| `components/lists/InstagramStoriesList.tsx` | `monetize` |
| `components/lists/InstagramUnifiedList.tsx` | `monetize` |
| `components/LocationPermissionNotGranted.tsx` | `commonCustomer` |
| `components/maps/BusinessMap.tsx` | `map` |
| `components/maps/MapControls.tsx` | `map` |
| `components/monetize/BusinessFirstPicker.tsx` | `monetize` |
| `components/monetize/ConfirmMonetization.tsx` | `monetize` |
| `components/monetize/ContentFirstPicker.tsx` | `monetize` |
| `components/monetize/InstagramContentPicker.tsx` | `monetize` |
| `components/overlays/InstagramPermissionInfoModal.tsx` | `settingsInstagram` |
| `components/overlays/StoryViewsModal.tsx` | `storyViews` |
| `components/previews/InstagramMediaPreview.tsx` | `monetize` |
| `components/previews/WithdrawalPreviewSmall.tsx` | `withdrawals` |
| `components/shares/SelectShareBusiness.tsx` | `monetize` |
| `components/stripe/StripeConnectSetup.tsx` | `stripe` |
| `components/stripe/WithdrawWithStripe.tsx` | `stripe` |

### Fully wired — `tagly-customer/app/` screens (all done)

| File | Namespace |
|------|-----------|
| `app/(app)/(tabs)/home.tsx` | `home` |
| `app/(app)/(tabs)/account.tsx` | `account` |
| `app/(app)/(tabs)/map.tsx` | `map` (no strings in screen file — delegates to `BusinessMap`) |
| `app/(app)/(other)/my-content.tsx` | `myContent` |
| `app/(app)/(other)/visited.tsx` | `visited` |
| `app/(app)/(other)/cash-out.tsx` | `stripe` (no strings in screen file — delegates to `StripeConnectSetup` / `WithdrawWithStripe`) |
| `app/(app)/shares/index.tsx` | `shares` |
| `app/(app)/shares/[uid].tsx` | `shareDetail` |
| `app/(app)/shares/create/index.tsx` | `monetize` |
| `app/(app)/shares/create/confirm.tsx` | `confirmShare` |
| `app/(app)/balance/history.tsx` | `balanceHistory` |
| `app/(app)/balance/withdrawals.tsx` | `withdrawals` |
| `app/(app)/businesses/[uid].tsx` | `businessDetail` |
| `app/(app)/guides/index.tsx` | `guides` |
| `app/(app)/guides/monetization.tsx` | `monetizationGuide` |
| `app/(app)/settings/index.tsx` | `settings` |
| `app/(app)/settings/app.tsx` | `settingsApp` |
| `app/(app)/settings/instagram.tsx` | `settingsInstagram` |
| `app/(app)/settings/account/index.tsx` | `settingsAccount` (no strings — delegates to form components) |
| `app/(app)/settings/account/referral.tsx` | `settingsReferrals` (no strings — delegates to referral form components) |
| `app/(app)/settings/account/delete.tsx` | `settingsAccount` |
| `app/(app)/settings/account/email.tsx` | `settingsAccount` (+ `commonCustomer` for `exampleEmail`) |
| `app/(app)/settings/notifications/email.tsx` | `settingsNotifications` |
| `app/(app)/settings/notifications/push.tsx` | `settingsNotifications` |
| `app/(auth)/login-cancelled.tsx` | `loginCancelled` |
| `app/(auth)/professional-account.tsx` | `professionalAccount` |
| `app/(auth)/page-didnt-load.tsx` | `pageDidntLoad` |

### Navigation header titles

Stacked-screen header titles are **not** in the screen body files — they live in the `_layout.tsx` files as `Stack.Screen options={{ headerTitle: ... }}` (rendered into `TopMenu centeredTitle`), and the tab headers in `(tabs)/_layout.tsx` pass `TopMenu title=`. These are localized via the **`navigation`** namespace: each layout component calls `useTranslation("navigation")` and uses `t("...")` for every `headerTitle` / `title`. Wired layouts: `(tabs)`, `(other)`, `balance`, `guides`, `shares`, `shares/create`, `settings`, `settings/account`, `settings/notifications`. (`businesses/_layout.tsx` has no static title — it shows the dynamic business name.)

---

## How to Wire Up a File

1. Import `useTranslation` from `react-i18next`.
2. Call `const { t } = useTranslation('namespaceName')` inside the component — **before any early returns** (Rules of Hooks).
3. Replace every hardcoded string with `t('keyName')`.
4. Add the new keys to both `locales/en/<folder>/<namespace>.json` and `locales/cs/<folder>/<namespace>.json` (`<folder>` = `shared` or `customer`).

```tsx
import { useTranslation } from "react-i18next";

export default function MyScreen() {
  const { t } = useTranslation("myNamespace");
  return <Text>{t("someKey")}</Text>;
}
```

For a component that needs keys from a second namespace:

```tsx
const { t } = useTranslation(["myNamespace", "common"]);
// primary namespace key: t("myKey")
// secondary namespace key: t("myKey", { ns: "common" })
```

---

## How to Add a Central Namespace (`tagly-shared/client` or legacy)

> For an **app screen/component, colocate instead** (see [Colocated namespaces](#colocated-namespaces-v2--preferred-for-app-screens)). Use the central route below only for a `tagly-shared/client` namespace, or when extending the not-yet-migrated central set.

1. Pick the consumer folder: `shared/` if any `tagly-shared/client` component will use it, otherwise the owning app's folder (`customer/`, `advertiser/`).
2. Create `locales/en/<folder>/<namespace>.json` with all English strings, starting with a `"//"` comment listing its consumers.
3. Create `locales/cs/<folder>/<namespace>.json` with the Czech translations (same keys, same structure).
4. Add `import` statements for both files in `index.ts` (paths include the folder).
5. Register both under their language in the `resources` object in `index.ts` (namespace name is the bare file name, no folder).

If a namespace ends up mixing shared-component keys and app-only keys, **split it** rather than placing it in one folder — see the "Folder rules" under Directory Structure above.

---

## Colocated namespaces (v2 — preferred for app screens)

Going forward, **app** namespaces live next to their component, not in `locales/`. The central `locales/` tree stays for **`shared/` namespaces** (consumed by `tagly-shared/client`, which a shared package must own) and for not-yet-migrated screens. Migrate gradually: when a screen is rebuilt, colocate its strings.

**Why it's structured this way:** Metro can't auto-discover JSON, and `tagly-shared/client` (where the i18next singleton lives) can't import app code. So each app registers its own colocated namespaces against the singleton at boot, and contributes their types via interface merging.

### How to add a colocated namespace

1. Put `MyScreen.en.json` + `MyScreen.cs.json` **next to the component**. Start each with the `"//"` consumer comment; keep en/cs in lockstep (same keys). Nesting is fine (`t("slides.find.heading")`).
2. Register + type it in the app's locale registry (`tagly-customer/i18n/appLocales.ts`):
   ```ts
   import { registerLocale } from "@tagly/client";
   import myScreenEn from "@/components/.../MyScreen.en.json";
   import myScreenCs from "@/components/.../MyScreen.cs.json";

   registerLocale("myScreen", { en: myScreenEn, cs: myScreenCs });

   declare module "@tagly/client" {
     interface TaglyI18nResources { myScreen: typeof myScreenEn }
   }
   ```
   The `declare module` line is what keeps `t()` type-checked — `TaglyI18nResources` is the open interface `CustomTypeOptions.resources` points at, so merging a member into it gives full key autocomplete for that namespace. **No edit to `tagly-shared/client/i18n/index.ts` is needed.**
3. `appLocales.ts` is imported once at app boot (`app/_layout.tsx`, right after `import "@tagly/client"`), so all colocated namespaces are registered before anything renders.
4. In the component: `const { t } = useTranslation("myScreen")`, then `t("...")` as usual.

Namespace names are still globally flat (one name across central + colocated) — and the **namespace can differ from the filename** (e.g. `SignInScreen.{en,cs}.json` is registered as `"signIn"`). `registerLocale` and `TaglyI18nResources` are exported from `@tagly/client`. First examples: the customer landing namespaces — `OnboardingCarousel`→`onboarding`, `SignInScreen`→`signIn`, `OtpScreen`→`otp`, `LocalePicker`→`localePicker` (in `tagly-customer/components/landing/`, registered in `tagly-customer/i18n/appLocales.ts`).

---

## Localization in `tagly-shared/client`

`tagly-shared/client` is a **shared** package consumed by `tagly-customer`, `tagly-advertiser`, and `tagly-admin`. Customer-facing design components now call `useTranslation(...)` directly, exactly like app components.

- **No separate i18n instance.** They resolve against the **global i18next singleton** that `@tagly/client` boots (every app imports `@tagly/client`, which runs `index.ts`'s synchronous init). The locale JSON still lives here in `tagly-shared/client/i18n/locales/`, not in `tagly-shared/client`.
- **react-i18next is a peer/dev dependency of `tagly-shared/client`** (`tagly-shared/client/package.json`). It resolves from the single root `node_modules`.
- **Other apps fall back to English safely.** The advertiser/admin apps don't switch language, so a shared component's `t()` returns the English value. The customer namespaces are bundled into the singleton regardless of app.
- **Mode-conditional strings:** many shared components take a `mode` (`"customer"`/`"advertiser"`, or `"public"`/`"owner"`). Both branches' strings live in the same namespace (e.g. `getPaidCustomer` / `getPaidAdvertiser`) so the file stays in sync; the component picks the key by mode.
- **Scope:** advertiser/owner-only components and branches are intentionally **left in English** (e.g. `CreateLocalFormBase`, `LocalDetails` owner overlays, `ShareDetails` `ChangeShareRating`/`PriceBreakdownOverlay`, `SubaccountsList` owner placeholders). Only customer-reachable surfaces were localized.
- **Namespace mapping:** `ShareDetails/*` → `shareDetail`, `LocalDetails/*` + local previews → `businessDetail` (these two are large shared namespaces the customer detail screens also consume). Components whose keys were split out of a customer namespace now use a dedicated shared namespace: share preview → `sharePreview`, ledger preview + `BalanceChanges` → `ledger`, `InterestsSelector` → `interests`, the `guides/` example components → `contentGuides`. Generic picker/CTA defaults + subaccount placeholders → `common` (the cross-app shared namespace).

---

## Auditing the `tagly-shared/client` Localization Refactor

Context for a future agent reviewing or security/quality-auditing the `tagly-shared/client` localization pass. Read this before flagging "missing" translations — many omissions are deliberate.

### Exactly what was localized (and to which namespace)

| Component(s) | Namespace |
|--------------|-----------|
| `drawer/SlideInDrawer.tsx`, `feedback/AboutSheet/index.tsx` | `drawer` |
| `overlays/UpdateRequiredModal.tsx` | `appUpdate` |
| `overlays/AcceptLatestTosModal.tsx`, `overlays/AcceptLatestPrivacyPolicyModal.tsx` | `legal` |
| `referral/ReferralStatisticsComponent.tsx`, `referral/QRCodeModal.tsx` | `referral` |
| `details/ShareDetails/{index,utils.ts,components/ShareStatusCard,ShareInfo,ShareLifecycleOverlay,ReportDetailsOverlay,Insights,Rewards,RelatedTransactions}` | `shareDetail` |
| `details/LocalDetails/{index,components/PublicInfo,RewardInfo}` | `businessDetail` (+ `common` for "Earn here") |
| `previews/LocalPreviewNormal.tsx`, `previews/LocalPreviewSmall.tsx` | `businessDetail` |
| `previews/SharePreviewNormal.tsx` | `sharePreview` |
| `previews/CustomerLedgerEventPreviewSmall.tsx`, `balance/BalanceChanges.tsx` | `ledger` |
| `pickers/InterestsSelector.tsx` | `interests` |
| `pickers/CustomPicker.tsx`, `pickers/CustomPickerModal.tsx` | `common` (default heading/search/Done/Select/no-results) |
| `guides/OtherBusinessNamesInfo.tsx`, `guides/InstagramTagOptions.tsx` | `contentGuides` |

### Intentionally left in English (NOT bugs)

Scope was **customer-reachable surfaces only**. These advertiser/owner-only components and code branches were deliberately skipped (the customer never renders them; the advertiser/admin apps are not being translated):

- `forms/CreateLocalFormBase.tsx`, `previews/AdvertiserLedgerEventPreviewSmall.tsx`, `pickers/TypeSelector.tsx`.
- `details/ShareDetails/components/ChangeShareRating.tsx` (advertiser-only) and `PriceBreakdownOverlay.tsx` (rendered only when `mode === "advertiser"`).
- `details/LocalDetails` **owner-mode** pieces: `BannerOverlayButtons.tsx`, `LocalVisibilityOverlay.tsx`, `Statistic.tsx`, `LatestShares.tsx`, and the `mode === "owner"` branches in `index.tsx` / `PublicInfo.tsx`.
- `previews/LocalPreview{Normal,Small}.tsx`: the **owner overlays** ("Not visible", "Removed → Hidden from other users", owner "Not shareable") and **incomplete-mode** placeholders ("Business name/type/address", `x KM away`).
- `lists/Subaccounts*`: the owner `PlaceholderCard` ("Add a business page", multi-branch text).

If the advertiser app is ever localized, these become the next scope.

### Values left untranslated by design (data, not UI copy)

These render dynamic/enum/back-end values and are **expected** to stay as-is:

- Instagram post type — `capitalizeText(share.igPostType)` injected into `shareDetail.instagramPostType` = `"Instagram {{type}}"` (the `{{type}}` token stays English: "Story"/"Post"/"Reel").
- Ledger event title — known kinds map to `ledger.kind*`; **unknown** kinds fall back to `event.kind.split("_").map(capitalizeText).join(" ")`.
- `rewardMessages` (backend, e.g. the "Reward influenced by:" bullets on the map marker), vertical/interest names (API), and all `formatBudget` output.

### Rating value labels (localized)

The share **rating** enum (`EXCEPTIONAL | GOOD | BAD | UNRATED | REPORTED`) **is** localized — it used to render the raw enum via `capitalizeText(share.rating)`. There is **one canonical mapping**: `getRatingLabel(rating, t)` in `tagly-shared/client/components/details/ShareDetails/utils.ts`, backed by the `shareDetail.ratingValue*` keys. Consumers: `ShareDetails/ShareInfo.tsx` and `previews/SharePreviewNormal.tsx` (which pulls a `shareDetail`-bound `t` via a second `useTranslation("shareDetail")`). The advertiser rate-flow button labels in the `rating` ns (`ratingGood/Bad/Exceptional`) are a separate surface and stay where they are.

### Report type labels (localized)

The share **report type** enum (`NOT_PROMOTION | MISLEADING_LOCATION | INAPPROPRIATE | DUPLICATE | VIOLATES_GUIDELINES | CUSTOMER_NOT_SPENT_MONEY`) is localized through the same pattern: `getReportTypeLabel(reportType, t)` in `tagly-shared/client/components/details/ShareDetails/utils.ts`, backed by the `shareDetail.reportType*` keys. Consumers: `ShareDetails/ShareLifecycleOverlay.tsx`, `ShareDetails/ReportDetailsOverlay.tsx`, and `tagly-advertiser/components/rating/ReportModal.tsx` (re-exported from `@tagly/client`; the modal pulls a `shareDetail`-bound `t` via a second `useTranslation("shareDetail")` because its primary namespace is `rating`). The previous flat `reportTypeLabels` map in `@tagly/models/shared` was removed.

### Date/time formatting (locale-aware)

`formatDate` (`tagly-shared/client/utils/formatting/formatDate.ts`) uses `dayjs`, whose **global locale is kept in sync with the app language** by `setAppLanguage()` in `i18n/index.ts` (`dayjs.locale(lang)`). Czech renders day-first (`"D. MMMM YYYY"`) with Czech month names; English keeps `"MMM D, YYYY"`. The app never shows a time-of-day, so there is only a **date** formatter (no `formatDateTime` / 12h-24h setting). No call-site changes are needed — the formatter reads the active locale from dayjs.

### Pluralization

Czech plural categories are **not** used. "Visited N times" picks `businessDetail.visitedTimeSingular` vs `visitedTimesPlural` via a manual `count > 1` check (mirrors the original code); the Czech form is the count-invariant `"{{count}}×"`. If more plural-sensitive strings are added later, prefer i18next's native `_one/_few/_other` cs categories instead.

### Security posture (verified during the refactor)

- **No `t()` key is built from untrusted input.** All keys are string literals, or come from fixed `switch`/enum maps (`CustomerLedgerEventPreviewSmall` `kindLabel`, `ShareLifecycleOverlay` `STEPS[].labelKey`). There is no `t(userControlledValue)`, so user input cannot select arbitrary keys.
- **User-generated content is rendered as data, not as a key.** e.g. a report message renders as `` `"${share.report.reportMessage}"` ``, never via `t()`.
- **Interpolation:** `init` sets `interpolation.escapeValue: false` (correct for React, which escapes children; there is no `dangerouslySetInnerHTML` / web HTML sink in these RN `Text` nodes). Interpolated values are app/back-end-controlled (amounts, dates, counts, the user's own referral code/URL) — no third-party HTML.
- **No new network/eval surface** — locale JSON is bundled at build time; nothing is fetched or evaluated at runtime.

### Verification commands

```bash
# 1. en/cs key parity for every namespace (must print OK for all)
cd tagly-shared/client/i18n/locales && for f in en/shared/*.json en/customer/*.json; do n=${f#en/}; \
  node -e "const e=require('./en/$n'),c=require('./cs/$n');const ek=Object.keys(e).sort(),ck=Object.keys(c).sort();const m=ek.filter(k=>!(k in c)),x=ck.filter(k=>!(k in e));console.log('$n', m.length||x.length?('MISMATCH '+JSON.stringify({m,x})):'OK')"; done

# 2. JSON validity (catches the Czech typographic-quote gotcha)
cd tagly-shared/client/i18n/locales && for f in en/*/*.json cs/*/*.json; do node -e "require('./$f')" || echo "PARSE FAIL $f"; done

# 3. Type safety of the shared design package
cd tagly-shared/client && npx tsc --noEmit -p tsconfig.json

# 4. Residual hardcoded UI strings in a localized component (should be empty
#    except intentionally-skipped owner/advertiser strings and JSDoc comments)
grep -rnE 'heading="|label="|>[A-Z][a-z]+ [a-z]' tagly-shared/client/components/details
```

### Known limitations / risk areas for the auditor

- **Global-singleton coupling.** `tagly-shared/client` components have no `I18nextProvider`; they depend on `@tagly/client` having been imported (which runs the synchronous `init`) before they render. A consumer that renders a shared component *without* importing `@tagly/client` would get raw key strings back. All three apps currently import it at startup.
- **Advertiser/admin mixed-register risk (latent).** Advertiser-only English keys live in customer namespaces (e.g. `shareDetail.statusPaidDescAdvertiser`). They're harmless today because advertiser/admin never switch to `cs`; if that changes, those apps would show a mix of Czech customer copy and English advertiser copy until separately translated.
- **`shareDetail` is now large (~105 keys)** and shared between the customer screen `app/(app)/shares/[uid].tsx` and the `ShareDetails/*` design components. Keep both consumers in mind when editing.
- **Language flash on cold boot** still applies (see "Known Limitation" above) — unrelated to this refactor but visible on the newly localized screens too.
- **Register consistency** is a manual invariant (see the tykání gotcha) — there is no automated check that new strings stay informal.

## Recurring Patterns and How to Handle Them

These came up across many components — follow the same approach for screen files.

### Module-level objects/constants with hardcoded strings
Move them inside the component body, after `const { t } = useTranslation(...)`.

### Module-level functions that return strings
Add `t` as an explicit parameter: `function getLabel(item, t: TFunc): string`.  
Define the type alias above the function: `type TFunc = ReturnType<typeof useTranslation<"myNamespace">>["t"]`.

**Type the `t` param with its namespace** — a bare `t: TFunction` resolves to `defaultNS` (`"common"`), so calling `t("someShareDetailKey")` inside fails to typecheck. Use `t: TFunction<"shareDetail">` (or the `TFunc` alias above) so the param is bound to the namespace whose keys the function actually uses.

### Dynamic keys built from a `string` variable
With typed keys, `t(someString)` no longer compiles — `t` wants a known key literal. If you store/compute a key, type the variable as that namespace's key union (e.g. `keyof typeof enShareDetail` or a `const`-typed `labelKey`) rather than `string`. See the `useMemo` pattern above for storing keys safely.

### `useMemo` with `[]` deps that stores translated strings
Store translation **keys** (strings like `"igStoryPlaceholder"`) in the memo, not the translated values. Call `t(item.labelKey)` at render time. This avoids stale closures.

### Inline clickable links embedded in translated text
Translate the full sentence as one key. Split the translated string at the link text to reconstruct JSX:
```ts
const termsLink = t("termsLinkText");
const parts = t("fullSentence", { ... }).split(termsLink);
// render: {parts[0]} <PressableText>{termsLink}</PressableText> {parts[1]}
```

### Sub-components that need translations
Each React function component can call `useTranslation` independently — no need to prop-drill `t`.

### Variable name conflicts
If a callback already uses `t` as a parameter name (e.g. `onChangeText={(t) => ...}`), rename the callback parameter to avoid shadowing the hook's `t`.

### Interpolation
Use `{{variableName}}` in JSON strings, pass values as `t("key", { variableName: value })`.

---

## Common Gotchas

### Typographic quotes in Czech strings break JSON
Czech uses `„lower"` and `"upper"` quotation marks. The closing `"` (U+201C, a Unicode left double quotation mark) looks like an ASCII `"` to a JSON parser and will terminate the string early, causing a `SyntaxError`.

**Wrong:**
```json
"permissionModalRetryHint": "Klepni na „Zkusit v anonymním okně"."
```
**Correct — escape the closing quote:**
```json
"permissionModalRetryHint": "Klepni na „Zkusit v anonymním okně\"."
```

Always validate JSON files after editing: `node -e "require('./locales/cs/<folder>/myFile.json')"`.

### Czech uses the informal register (tykání)

All Czech strings address the user informally — second-person singular "ty" (e.g. "Tvoje sdílení", "Co tě baví?", "Připoj Instagram", "Zkus to později"), **not** the formal "vy" ("Vaše", "Připojte", "Zkuste"). Keep new Czech translations informal to match. Gendered past-tense/participles use the `/a` form (e.g. "vydělal/a", "Přečetl/a jsem si"). **This applies to `tagly-advertiser` too** — it deliberately uses the same register, so the existing tykání `cs/shared/*.json` values are reused by both apps directly. Register consistency is a manual invariant — there is no automated check.

### Czech terminology — payments use "zaplaceno", never "vyplaceno"

For a completed payment / reward, the Czech is **"zaplaceno"** (paid), **not** "vyplaceno" (paid out) — and the same family: **"nezaplaceno"**, not "nevyplaceno". This is a deliberate brand-voice choice; prefer the `zaplatit`/`zaplaceno` family over `vyplatit`/`vyplaceno` for anything the user gets paid.

### Czech terminology — withdrawals are "výběr", never "výplata"

When the customer takes their own money out of Tagly (the `StripeWithdrawal` flow), the Czech is **"výběr"** / **"výběr peněz"** (and the verb `vybrat (si) peníze`) — **never "výplata"** (payout) or its family (`vyplatit`, `výplatu`, …). "Výplata" reads like a wage/salary and is off-brand. So: the action is a *výběr*, and even the bank step is phrased as a *převod do banky* (transfer to the bank), not a *výplata*. Same brand-voice reasoning as the `zaplaceno`/`vyplaceno` rule above.

### Write each language natively — never translate one into the other

Do **not** translate copy from English to Czech (or vice-versa). Write each
locale's string **separately**, thinking in that language: pick the wording a
native speaker would actually use, not the literal equivalent of the other side.
The two files can phrase the same idea differently — that's correct, not drift.
Literal translations read stiff and foreign (e.g. "Násobitel odměn" for "Reward
multiplier" — a native would say "Bonus k odměnám"). When adding/editing a key,
author the `en` and `cs` values independently rather than running one through the
other.

### Czech copy is full sentences, not clipped English-style fragments

Punchy telegraphic microcopy is native to **English** UI ("All optional. Add
anytime.", "Any card. Unlink anytime.", "Three steps to your first payout"), but
mirrored literally it reads as broken, machine-translated Czech. Czech wants a real
sentence: a finite verb and a natural connective, not two stubs joined by a period.
This is a direct corollary of "write each language natively" above. The fix is
almost never a tighter translation; it's a proper Czech sentence.

Applies to **descriptive** copy: subtitles, hints, footnotes, body, value-props.
Turn the fragment into a sentence:

- ❌ `Vše nepovinné. Můžeš doplnit kdykoli.` → ✅ `Přidej, co se hodí. Všechno je nepovinné a doplnit to můžeš i později.`
- ❌ `Nepovinné. Až {{max}} fotek.` → ✅ `Fotky jsou nepovinné, přidat jich můžeš až {{max}}.`
- ❌ `Jakákoli karta. Kdykoli ji můžeš odpojit.` → ✅ `Funguje s jakoukoliv kartou a kdykoli ji můžeš odpojit.`
- ❌ `Sledující blízko tebe, kteří můžou přijít.` → ✅ `Platí se jen za sledující blízko tebe, kteří k tobě můžou zajít.`

**Not a fragment problem, keep these short:** buttons, tab/nav and field labels,
section headings, and short **pro-drop** sentences that already carry a verb
(`Neplatíš předem`, `Kredity nikdy nepropadnou`, `Rozpočet určuješ ty`). The target
is copy that's *doing a sentence's job* while missing the verb or connective, not
every short string. English can stay clipped; Czech shouldn't.

### No dashes in user-facing copy — they read as AI-written

**Never use an em dash (`—`) or en dash (`–`) in a user-facing string** (en or cs). They make copy feel machine-generated. Split into two sentences, or use a comma / colon / parentheses instead. A hyphen *inside* a word (`e-mail`, `pay-as-you-go`) is fine — this rule is about the sentence-joining dash. It applies to translated **values** only; the `"//"` dev notes at the top of each catalog are internal and exempt (and developer-facing code/comments are out of scope).

### Non-component utils resolve against the global singleton
Files that aren't React components (e.g. `tagly-advertiser/utils/pickMedia.native.ts`, `utils/pdfUtils.{native,web}.ts`) can't call `useTranslation`. Import the singleton instead: `import { i18n } from "@tagly/client"`, then `i18n.t("key", { ns: "namespace", ...vars })`. Developer-facing `throw new Error(...)` strings are left English (only the user-facing fallback/alert is translated).

### Rules of Hooks — `useTranslation` before early returns
`const { t } = useTranslation(...)` must appear before any `if (!customer) return null` or similar guard. Violating this causes a React hooks error at runtime.

---

## Rules

- **Never hardcode strings** in `tagly-customer` or `tagly-advertiser` components — always use `t()`. (Exception: SEO/web-only `PageHead` titles in the advertiser app stay English by design.)
- **Both locale files must stay in sync.** Every key in `en/` must exist in `cs/` and vice versa. Missing keys fall back to English silently, which can hide translation gaps.
- **One namespace per screen.** Don't reach into another screen's namespace.
- **`common` (shared) is only for cross-app strings that `tagly-shared/client` components render** — `earnHere`, `localBusinessPlaceholder`, picker defaults. Don't add customer-only strings here.
- **`commonCustomer` is for customer-app cross-cutting strings** (tab labels, drawer items, shared toast/label copy). Don't use it as a dumping ground; if a string belongs to one screen, put it in that screen's namespace.
- **Always put a comment at the top of each namespace file** stating which pages/components use it: `"//": "Used in: path/to/file.tsx"`.
- **No em dashes (`—`), en dashes (`–`), or other typographic dashes in user-facing copy** (`en` or `cs`). They read as machine-written and don't match how people actually type. Use a period, comma, colon, or parentheses instead, and split run-on sentences in two — e.g. `"…on your profile — reconnect the same one."` becomes `"…on your profile. Reconnect the same one."`. A plain ASCII hyphen (`-`) between words is fine (`opt-in`, `back-to-back`). Applies to translated values only; the internal `"//"` consumer comment is exempt.
