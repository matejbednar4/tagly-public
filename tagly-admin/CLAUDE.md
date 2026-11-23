# tagly-admin (Internal Admin App)

Internal admin app — **native mobile, iOS only**, distributed to the team via **TestFlight** (no hosting, no
public URL). It reuses the `@tagly/client` design system + shared components from the monorepo.

> ### v2 rewrite — decision record: `v2.0.0.md` §3B (the plan file was retired 2026-08-14 — it lives in git history, `git log --all -- v2.0.0.md`; its still-open items moved to [FUTURE.md](../FUTURE.md))
>
> Admin was Expo Web (web-only, cookie auth); the v2 rewrite (2026-07) rebuilt it as a native iOS app
> (Android dropped 2026-07-24 — every admin has an iPhone). Key facts:
>
> - **Bearer-token auth, not cookies.** JWT in `expo-secure-store` sent as `Authorization: Bearer`, gated by
>   the admin capability. **Login = email that must end in `@taglyapp.com` (or the legacy `@flaer.app`) + password + a long one-time code
>   emailed to that address** (`/v2/public/auth/admin/{login,verify}`) — no OAuth, no self-signup; admin
>   keeps its `Admin.passwordHash`/argon2 path.
> - **No web, no 426 update gate, no drawer.** Admin ships in lockstep via TestFlight (never force-updated);
>   Log out lives in each tab's `TopMenu`.
> - **Backend:** the **`/v2/admin`** group (thin over shared logic, all data routes `requireSuperAdmin`).

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../CLAUDE.md).

## No back-compat for admin endpoints / DTOs

Unlike `tagly-customer` and `tagly-advertiser` (whose old builds linger in the App Store for weeks), the admin dashboard ships from a single source we control and gets pushed in lockstep with the backend. **Admin endpoints and DTOs in `tagly-shared/models/src/dtos/v2/adminApp/` and `tagly-shared/models/src/endpoints/v2/adminApp/` are not bound by client back-compat.**

Practical consequences:

- **No deprecated dual-write fields.** When renaming an admin DTO field (e.g. `balanceCents` → `balanceUsdCents`), drop the old field outright — don't keep a `@deprecated` alias. The admin hydrator should write only the new field; the admin frontend should read only the new field.
- **Breaking changes are fine.** A breaking change to `/admin/*` only needs the admin dashboard's deploy to land within the same window as the backend. There's no "old client in the wild" failure mode.
- **By contrast**, anything under `customerApp/`, `advertiserApp/`, or `crossApp/` DOES need back-compat — keep deprecated aliases until old mobile builds roll off (typically months).

This rule keeps admin DTOs lean and discourages stale code lingering after a rename.

## Check Before You Build

Before writing any component, hook, utility, or type — **check the shared packages first**.

| You need | Check here first |
|----------|-----------------|
| A UI component | `tagly-shared/client/components/` — lists, overlays, pickers, buttons, inputs |
| A spacing or color value | `tagly-shared/client/theme/` — `theme.ts` tokens (`spacing`, `layout`, colors, text) |
| A client utility | `tagly-shared/client/` |
| An API call pattern | `callAuthed` from `@tagly/client` (bearer JWT from secure-store) |
| A Zod schema or enum | `tagly-shared/models/src/core/` (+ `constants/`, `catalogs/` — permanent) |
| A shared TypeScript type | `tagly-shared/models/src/dtos/v2/<group>` (e.g. `v2/adminApp`) |
| An endpoint schema | `tagly-shared/models/src/endpoints/v2/<group>` (e.g. `v2/adminApp`) |
| An SDK endpoint function | `@tagly/sdk/v2/adminApp` (+ `@tagly/sdk/v2/crossApp`) |

App-specific code lives in `tagly-admin/components/` only when there is no reasonable shared equivalent and no other app will need it.

See [README.md](README.md) for commands.

## Shared Packages

- `@tagly/client` — Design system (components, spacing, colors, fonts, icons) + shared utilities (storage, toast, formatting)
- `@tagly/models` — DTOs and Zod schemas (`@tagly/models/v2/adminApp`)
- `@tagly/sdk` — API client (`@tagly/sdk/v2/adminApp`)

## Design Principles

The shared design system governs all UI — read [tagly-shared/client/CLAUDE.md](../tagly-shared/client/CLAUDE.md) before
any component work. Tokens come from `useTheme()` (`theme.color.*`, `theme.text.*`, `theme.spacing`,
`theme.layout`, `theme.radius`, `theme.shadow`) — never `useColorTheme()`/static `textStyles` (retired v1
system) and never hardcoded values.

### Component rules

- Use `customAlert()` from `@tagly/client` — never `Alert.alert()` (consistent styling across apps)
- Use `showToast()` from `@tagly/client` — never `Toast.show()` directly
- Components should use `width: "100%"` — screens control constraints
- No `aspectRatio` for height — use fixed `height` with optional `maxHeight`
- No `%` values except `"100%"` — use spacing tokens instead

## Auth Notes

Bearer-token auth (see the v2 banner above): the SDK (`@tagly/sdk/v2/adminApp`) sends the JWT from
`expo-secure-store` as `Authorization: Bearer`.

- `adminLogin(body)` — POST `/v2/public/auth/admin/login` (emails the long code)
- `adminVerifyOtp(body)` — POST `/v2/public/auth/admin/verify` (returns `{ jwt }`)
- `adminGetMe({ jwt })` — GET `/v2/admin/me`
- `adminLogout({ jwt })` — POST `/v2/admin/logout` (bumps `jwtVersion` — revokes all live tokens)

## Project Structure

```
tagly-admin/
├── app/              # Expo Router file-based routing
│   ├── (app)/        # Protected app routes
│   ├── (auth)/       # Auth screens (login, verify)
│   ├── _layout.tsx   # Root layout with providers
│   ├── index.tsx     # Entry point (auth check + redirect)
│   └── +not-found.tsx
├── components/       # App-specific components
├── contexts/         # React contexts (AdminContext, session/SessionContext)
├── hooks/            # Custom React hooks
├── providers/        # App providers (DesignBridge)
├── utils/            # App-specific utilities
└── constants/        # App constants
```

## Key Patterns

- Uses `@/` path alias (maps to project root)
- `TaglyDesignBridge` provider mounts the shared `ThemeProvider` (always Cream)
- Toast notifications via react-native-toast-message
- QueryClient from `@tanstack/react-query` for data fetching

## Destructive / irreversible actions must confirm first (non-negotiable)

**Every action that is destructive, hard to reverse, or high-impact must show a
confirmation `customAlert` before it runs — no exception.** The admin app acts on
real user money and accounts, so a mis-tap can log an operator out mid-task,
reject a legitimate share, ban a customer, or move funds. A confirm step is the
cheap insurance.

What counts (confirm before doing it):

- **Session / auth:** log out, sign out other sessions.
- **Money movements:** assigning credit, refunds, withdrawal actions, PAYG charges — anything touching the ledger.
- **Moderation with side effects:** approving / rejecting a share (fires payouts, penalties, and emails), reviewing a report.
- **Account state:** banning / unbanning a customer, subsidizing / un-subsidizing a business, changing an advertiser's account.
- Anything that emails the user, or that you can't trivially undo from the same screen.

Plain, reversible reads and navigation (opening a detail screen, switching a
sort, pull-to-refresh) do **not** need a confirm — don't add friction to those.

Pattern — use `customAlert` from `@tagly/client` (never `Alert.alert`), with a
`cancel` button first and the real action `destructive`:

```tsx
customAlert("Log out?", "You'll need to sign in again to get back in.", [
  { text: "Cancel", style: "cancel" },
  { text: "Log out", style: "destructive", onPress: () => void doLogout() },
]);
```

Keep the copy plain (no em dashes — see the global copy rule), name the concrete
consequence in the body, and label the confirm button with the verb ("Reject",
"Ban", "Refund"), not a generic "OK". The dashboard log-out button is the
canonical example.

## v2 notes (current rewrite)

- **Dashboard statistics UI lives in `components/statistics/StatKit.tsx`** — `StatSection` (collapsible, tinted icon chip + collapsed summary figure), `StatTile` (hero figure, optional tinted `chip`), `StatRows` (dense secondary-stat rows card), `TopList`, `LineChart` (long-press pointer shows exact month + figure). Section layout convention: two hero tiles over one `StatRows` card. Reuse these for any new admin stat surface; don't hand-roll tiles.
- **Chart gotcha (`react-native-gifted-charts`):** the default cubic bezier (`curved`) overshoots below zero on flat-then-rising series and the area fill gets clipped flat at the baseline. Always pass `curveType={CurveType.QUADRATIC}` (midpoint Q-curves stay inside the data hull). For series that can genuinely go negative, shift the baseline with `yAxisOffset` (the lib subtracts it from every value) — `StatKit.LineChart` already does both.
- Vertical/type slugs from admin endpoints are localized client-side via `useCatalogLocalizer()` (`verticalName`/`typeName`) — never render raw slugs.
- **Per-uid detail screens** live at `app/(app)/{customers,advertisers,businesses,shares}/[uid].tsx`, backed by `GET /v2/admin/<entity>/:uid` (thin controllers over the same `adminHydrate*` hydrators the list/search endpoints use — full DTO, no separate preview shape). Shared chrome in `components/details/DetailKit.tsx`: `DetailScaffold` (the shared white `TopMenu` with a back button + loading/not-found), `InfoRows` (selectable label→value rows; `onPress` turns a row into a chevron link), `LedgerEventsList` (money trail with non-zero deltas + meta), and `MediaCarousel` (contained banner + full-width photo strip; every tile taps into a swipeable fullscreen gallery, mirroring the customer app's business-details media block). Sections use `StatKit`'s `StatSection`/`StatTile`.

- **All media renders through `CustomMedia`** (`@tagly/client/components/media/CustomMedia`), never a raw `<Image>` — banners, business photos, share media, and Instagram pfps alike. It resolves CDN keys itself (pass the `MediaPreview` straight through, no `withQualityCdnUrlFromKey`), fades in, handles video/deleted-media placeholders, and (unless suppressed) opens a fullscreen gallery on tap. **Inside a tappable card row** (`EntityRows`' `HThumb`/`VCard`), pass `disablePress` so the tap falls through to the card's `onPress` instead of being swallowed by CustomMedia's own touchable. For a **URL-only** source (the customer pfp), pass `media={{ url, type: "IMAGE", aspectRatio }}` rather than a key.
- **Detail headings show the entity**, not a generic label — pass the loaded name/email as `DetailScaffold`'s `title` (fall back to the generic label while loading), e.g. `title={c ? c.fullName || c.email : "Customer"}`. `TopMenu` truncates to one line, so a long email is safe.

- **All screens use the shared white `TopMenu`** (`@tagly/client`), the same bar as the customer/advertiser apps. Admin has **no drawer**, so:
  - **The four tab roots** (Home / Review / Entities / Manage) pass `title` + `rightAction={useLogoutAction()}` — Log out lives in the bar (top-right) on every tab, via the shared [`hooks/useLogoutAction`](hooks/useLogoutAction.ts) (confirm-guarded). `rightAction` is a generic `TopMenu` slot (icon + onPress) that replaces the hamburger.
  - **Pushed screens** (details, list, search, map, shares-from) pass `showBack hideMenu` — back chevron + centered title, no right button (`hideMenu` drops in a spacer so the title stays centered). The old admin `BackHeader` was removed in favor of `TopMenu`.
  - `TopMenu` owns the safe-area top inset (screens must NOT add their own `insets.top` — that double-pads) and carries a `spacing.lg` bottom pad. **Every screen's content starts with `paddingTop: layout.screenPadding`** below the bar (the tab roots, `DetailScaffold`, and the control-first list/search screens all follow this).
- **An entity's shares are a real list, not just stats.** `GET /v2/admin/shares/from/:uid` (one endpoint; the uid **prefix** picks customer / advertiser / business) returns the paginated `AdminShare[]`, sortable (newest / oldest / highest-/lowest-reward). The route is registered **before** `/shares/:uid` so the literal `from` segment isn't swallowed. The list screen is `app/(app)/shares/from/[uid].tsx` (a `PaginatedList` of clickable `ShareRow`s, `?title=<name>` for the header); each entity detail's Shares/Statistics section links to it via a "View all N shares" button. Reward sort survives hydration by re-ranking hydrated rows against the paged uid order (the batch hydrator's `id: { in }` query doesn't preserve order).
- **An entity's full money trail is a real list too.** `GET /v2/admin/ledger-events/from/:uid` (same uid-prefix resolution; a **business** shows its advertiser's ledger, since businesses have no ledger of their own) returns the paginated `AdminLedgerEvent[]`, sortable newest / oldest, registered **before** `/shares/:uid` (own `ledger-events/from` segment, no conflict). The screen is `app/(app)/transactions/from/[uid].tsx` (a `PaginatedList` of `LedgerEventCard`s, `?title=<name>`); the customer / advertiser / business detail screens link to it via a single `InfoRows` "Transactions" nav row (chevron, straight to the list) — the embedded per-withdrawal / per-credit-purchase detail sections were dropped in favour of that one row. This is the **entity-wide** feed (locks, settles, referral payouts, PAYG charges, …). `LedgerEventCard` (one event) is the single canonical renderer, exported from `DetailKit`, used both by this list and by `LedgerEventsList` (a stack of cards, still used by the share detail's inline trail) — reuse the card, don't re-roll a ledger row. In the card, `meta` renders as humanized, zebra-striped `key → value` lines (`humanizeKey` + `MetaLines`), never a raw JSON dump.
- **Entity previews are clickable**: every `EntityRows` card (`CustomerRow`/`AdvertiserRow`/`BusinessRow`/`ShareRow`) takes an optional `onPress` — always pass a push to the matching detail route when rendering them in a new surface. `Badge`/`BadgeRow` are exported for detail-screen headers.
- **The Review tab is a hub → four queue screens** (`app/(app)/review/{pending-approval,reports,unrated,links}.tsx`). The hub fetches `GET /v2/admin/review/counts` on focus (count > 0 renders the danger pill). Queue screens share `hooks/useReviewQueue` (oldest-10 + total, optimistic `remove`, auto-refetch when the page empties) and `components/review/{QueueScreen,QueueShareCard}`. In `QueueShareCard` the media deliberately keeps CustomMedia's own tap (fullscreen — reviewing IS looking at the post) while the info column pushes the share detail; every mutation is confirm-guarded per the destructive-actions rule. Subsidized rating + report-dismiss use the shared half-star `StarRating` from `@tagly/client` (1–10 half-star units, same input as the advertiser app).
- **Business pages: create + edit reuse the shared `@tagly/client` business forms** (the same
  `pageForm` steps + `CreateBusinessWizard` the advertiser app uses — see
  `tagly-shared/client/CLAUDE.md` §Business page forms). The Manage tab's "Create business page" pushes
  `/businesses/create`: the shared wizard with an admin **US/CZ market selector** (admin has no locale of
  its own — the chips ride the wizard's `stepHeader` slot), `enableTags` (the admin-only search-aliases
  section), `draftKey: LOCAL_KEYS.ADMIN_CREATE_BUSINESS_DRAFT`, and the `/v2/admin/businesses/{init,confirm}`
  SDK twins. The created page is **unowned** (subsidized track) — subsidizing is a separate action. The
  business detail (`businesses/[uid]/index.tsx`, **focus-refetching** so edits show on back) carries an
  "Edit page" section → `businesses/[uid]/edit/{basics,media,details}.tsx`, thin hosts over the shared step
  forms via `hooks/useAdminBusiness` (fetch-once seed), saving through `adminUpdateBusiness` /
  `adminUpdateBusinessMedia{Init,Confirm}` — every save confirm-guarded (`saveConfirm*` copy from the
  shared `businessPageForm` namespace; shared i18n self-initializes in English, so `useTranslation` works
  here with no i18n bootstrap). The page's market derives from `address.countryCode`. DELETED pages hide
  the edit section (the backend 404s them). `react-native-image-crop-picker` is a **native dep** — a new
  dev-client build is required after install.
- **Business actions live in `components/details/BusinessActions.tsx`** (`SubsidizeButton` /
  `BanButton` / `AssignAdvertiserButton`), wired into the business detail's Subsidization / Info /
  Advertiser sections — all confirm-guarded, all `onDone` → the detail's focus-refetch. Each button
  mirrors its server gate for visibility (the server re-enforces): subsidize needs unowned + ACTIVE
  (owned XOR subsidized); ban shows for ACTIVE/BANNED; **assign-advertiser is the onboarding-assist
  handover only** (page unowned + ACTIVE + never subsidized + zero shares; the admin pastes the
  advertiser's UID from their detail screen; no share or money state moves). Unsubsidize warns that
  in-flight shares still settle subsidized; ban warns the page vanishes for customers while the owner
  keeps read-only sight of it.
- **QR stickers live in `components/details/QrStickerSection.tsx`** — the business detail's "QR
  stickers" section (physical printed stickers, ids shown zero-padded to 6 digits). Self-contained:
  owns its own focus-refetch of `GET /v2/admin/businesses/:uid/stickers` (the host only passes
  `businessUid`), renders the numbers as a chip list (tap → note + assigned date + confirm-guarded
  Remove → `adminUnassignQrSticker`, a hard delete meaning "sticker physically taken down") and an
  "Add sticker" sheet (`adminAssignQrSticker`, number 1–999999 + optional note). A 409 code **5310**
  (sticker hangs in a different business; the server message names it) is caught with
  `handleSpecificErrorManually` and surfaced as a confirm that retries with `reassign: true`.
- **Customer actions live in `components/details/CustomerActions.tsx`** (`BanCustomerButton` /
  `SetMultiplierButton`), wired into the customer detail's Account + Balance sections, `onDone` →
  `fetchCustomer()`. Ban opens a sheet with the **required reason** (emailed to the customer, surfaced
  as `banReason`, IG blocklisted); unban is confirm-only. The multiplier sheet takes an x-value
  ("0.85"), converts to bps, and the server rejects values outside the rating-algo bounds (1544) — the
  client deliberately doesn't duplicate the bounds.
- **Click-through reference data opens externally.** Any value that has a real destination off-app — Instagram handles/tags, emails, Stripe object ids, coordinates — must be openable, not just selectable text. Build the URL with `utils/links.ts` (`instagramProfileUrl`, `emailUrl`, `mapsUrl`, `stripeDashboardUrl`) and open it with `openUrl`. In an `InfoRows` row, set `link: "external"` + `onPress: () => openUrl(...)` — the value renders underlined with an `open-outline` icon (distinct from the `link: "nav"` default, which is an in-app push with a chevron). `stripeDashboardUrl` is **mode-aware**: it reads `APP_ENV` from `Constants.expoConfig.extra` and points non-production builds at the Stripe test dashboard (`/test`), production at live — so a staging id doesn't 404 against live data.
