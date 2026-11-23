# Customer Mobile App Development Guide

This file provides guidance for Claude Code when working in `tagly-customer/`.

**Platform:** iOS + Android (native mobile). Web is not in scope.

For the advertiser app (also iOS + Android native in v2), see [tagly-advertiser/CLAUDE.md](../tagly-advertiser/CLAUDE.md).

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../CLAUDE.md).

## Check Before You Build

Before writing any component, hook, utility, or type — **check the shared packages first**. The monorepo exists precisely so that implementations are written once and used by all apps.

| You need                 | Check here first                                                        |
| ------------------------ | ----------------------------------------------------------------------- |
| A UI component           | `tagly-shared/client/components/` — lists, overlays, pickers, buttons, inputs |
| A spacing or color value | `tagly-shared/client/misc/` — `spacing`, `colors`, `textStyles`               |
| A client utility or hook | `tagly-shared/client/`                                                         |
| An API call pattern      | `tagly-shared/client/api/caller.ts` — `callAuthed`, `callPublic`               |
| A Zod schema or enum     | `tagly-shared/models/src/core/` (+ `constants/`, `catalogs/` — permanent)     |
| A shared TypeScript type | `tagly-shared/models/src/dtos/v2/<group>`                                     |
| An endpoint schema       | `tagly-shared/models/src/endpoints/v2/<group>`                                |
| An SDK endpoint function | `@tagly/sdk/v2/customerApp` (+ `@tagly/sdk/v2/crossApp`)                      |

If something almost fits but not quite, generalize the shared version rather than creating a local parallel. App-specific code lives in `tagly-customer/components/` and `tagly-customer/hooks/` only when there is no reasonable shared equivalent and no other app will need it.

## Shared Package Usage

| Package         | Used By         | Description                                                            |
| --------------- | --------------- | ---------------------------------------------------------------------- |
| `@tagly/models` | Mobile + Admin  | DTOs, Zod schemas, endpoint types                                      |
| `@tagly/sdk`    | Mobile + Admin  | API client functions                                                   |
| `@tagly/client` | **Mobile only** | React Native design system (components, spacing, colors, fonts, icons) + utilities (callAuthed, hooks, etc.) |

## Code Organization

| Code Type               | Location                    | Used By          |
| ----------------------- | --------------------------- | ---------------- |
| Reusable RN components  | `tagly-shared/client/components/` | Both mobile apps |
| Reusable RN utilities   | `tagly-shared/client/`             | Both mobile apps |
| API types and schemas   | `tagly-shared/models/` (`endpoints/v2/<group>`, `dtos/v2/<group>`) | All apps |
| SDK endpoint functions  | `tagly-shared/sdk/` (v2-only; `@tagly/sdk/v2/crossApp`) | All apps         |
| App-specific components | `[app]/components/`         | Single app only  |
| App-specific contexts   | `[app]/contexts/`           | Single app only  |
| App-specific utils      | `[app]/utils/`              | Single app only  |

**Rules:**

1. Before creating a new component/util, check if it exists in `shared/`
2. If used by both mobile apps, move it to `tagly-shared/client/`
3. App-specific code stays in that app's directory

---

## Design Conventions

| Rule                  | Description                                                                             |
| --------------------- | --------------------------------------------------------------------------------------- |
| Use spacing constants | Never use arbitrary numbers - always use `spacing.*` from `@tagly/client`               |
| Use design components | Use `CustomButton`, `CustomTextInput`, `StatisticCard`, etc. instead of building custom |
| Use theme colors      | Always use `colors.*` from `useColorTheme()`, never hardcode colors                     |
| Components full width | Components use `width: "100%"`, parent controls constraints                             |

---

## Shared Design Components (@tagly/client)

### Spacing Constants

Always use spacing constants from `@tagly/client` instead of arbitrary numbers:

```typescript
import { spacing } from "@tagly/client";

// Screen-level
spacing.screenPaddingVertical; // 24 - Vertical padding
spacing.screenPaddingHorizontal; // 20 - Horizontal padding
spacing.topMenuHeight; // 50 - Top menu height

// Component-level
spacing.componentGap; // 24 - Gap between major sections
spacing.listItemGap; // 8 - Gap between list items
spacing.cardPadding; // 12 - Padding inside cards
spacing.formFieldGap; // 12 - Gap between form fields
spacing.formRowGap; // 8 - Gap between form rows
spacing.headingContentGap; // 6 - Heading to content spacing
spacing.headingInfoGap; // 0 - Heading to info text spacing
spacing.statisticsGap; // 6 - Gap between statistic cards
spacing.previewGap; // 10 - Gap in horizontal scroll previews
spacing.modalPadding; // 20 - Modal internal padding
```

### Primitive Components

**CustomButton - Primary/secondary buttons:**

```typescript
import { CustomButton } from "@tagly/client";

<CustomButton
  type="primary"           // "primary" | "secondary"
  height="large"           // "small" | "large"
  label="Submit"
  onPress={handleSubmit}
  loading={isSubmitting}
  disabled={!isValid}
  corners={["all"]}        // Optional: tl, tr, bl, br, all
/>
```

**CustomTextInput - Text inputs with optional prefix/icon:**

```typescript
import { CustomTextInput } from "@tagly/client";

<CustomTextInput
  heading="Email"
  placeholder="Enter email"
  value={email}
  onChangeText={setEmail}
  size="large"             // "small" | "large"
  prefix="$"               // Optional prefix
  rightIconName="close"    // Optional Ionicon
  onRightIconPress={clear}
/>
```

**PressableText - Clickable text links:**

```typescript
import { PressableText } from "@tagly/client";

<PressableText onPress={handlePress}>
  Learn more
</PressableText>
```

**StepProgressOverline - Onboarding step counter ("Setup · 2 of 4"):**

Rendered at the top of every counted onboarding *task* step (notifications, consent, profile, instagram). Get `step`/`total` from `useOnboarding().stepProgress("<step>")` — it excludes steps resolved before the session started and returns `null` when the line should be hidden (never render a counter that jumps, and never count identity screens or transitions like `finishing`).

```typescript
import { StepProgressOverline } from "@tagly/client";

const progress = stepProgress("consent");
{progress && <StepProgressOverline step={progress.step} total={progress.total} />}
```

### Statistics

**StatisticCard - Display metrics with optional icons:**

```typescript
import { StatisticCard } from "@tagly/client";

<StatisticCard
  heading="Total Earnings"
  statistic="$1,234"
  position="topLeft"       // Controls border radius
  onPress={handlePress}
  backgroundIconName="cash-outline"
  topRightIconName="chevron-forward"
/>
```

### Lists

**Always use `GeneralVerticalList` for paginated lists:**

```typescript
import { GeneralVerticalList } from "@tagly/client";

<GeneralVerticalList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  loading={isLoading}
  hasMore={hasMore}
  onEndReached={loadMore}
  emptyHeading="No items found"
  emptySubheading="Check back later"
/>
```

**Available list components in `tagly-shared/client/components/lists/`:**

- `GeneralVerticalList.tsx` - Generic paginated vertical list
- `GeneralHorizontalList.tsx` - Generic horizontal list

### Pickers

**Use shared pickers from `tagly-shared/client/components/pickers/`:**

```typescript
import { CustomPicker } from "@tagly/client";

<CustomPicker
  items={[{ label: "Option 1", value: 1 }]}
  value={selected}
  setValue={setSelected}
  open={pickerOpen}
  setOpen={setPickerOpen}
  placeholder="Select option"
/>
```

### Overlays

**Use `BottomOverlay` for info sections, confirmations, action sheets:**

```typescript
import { BottomOverlay } from "@tagly/client";

<BottomOverlay
  open={showInfo}
  setOpen={setShowInfo}
  type="bottom"            // "bottom" (sheet) or "modal" (centered)
>
  <Text style={styles.title}>Important Information</Text>
  <Text style={styles.body}>Details here...</Text>
</BottomOverlay>
```

**SlideInDrawer - Side navigation drawer:**

```typescript
import { SlideInDrawer } from "@tagly/client";

<SlideInDrawer
  mode="customer"
  isOpen={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  customer={customerData}
  colorMode={colorMode}
  setColorMode={setColorMode}
  quickAccessItems={[...]}
  router={router}
  qc={queryClient}
/>
```

### Loading

**Use `PageLoading` for full-screen or modal loading:**

```typescript
import { PageLoading } from "@tagly/client";

if (isLoading) return <PageLoading />;
if (isLoading) return <PageLoading text="Loading data..." />;
if (isLoading) return <PageLoading fullscreen />;
if (isLoading) return <PageLoading modal />;
```

---

## Security

### Token & Sensitive Data

| Rule                       | Description                                        |
| -------------------------- | -------------------------------------------------- |
| SecureStore for tokens     | JWT stored via `SecureStore`, never `AsyncStorage` |
| No token in logs           | JWT never logged to console (even in dev)          |
| No token in state          | JWT not stored in React state or context           |
| No sensitive data exposure | Passwords, OTPs, tokens never displayed in UI      |
| Secure API calls           | All authenticated calls use `callAuthed()` wrapper |

```typescript
// ✅ CORRECT - Token retrieved inside callAuthed (getSomething is illustrative)
const result = await callAuthed(navigation, (jwt) =>
  getSomething({ jwt }),
);

// ❌ WRONG - Never store JWT in state
const [jwt, setJwt] = useState(storedJwt);

// ❌ WRONG - Never log tokens
console.log("Auth token:", jwt);
```

### Error Messages

- No stack traces shown to users
- No internal database IDs exposed
- Generic fallback: "Something went wrong"

---

## API Call Patterns

### callAuthed / callPublic

All API calls must use the wrapper functions from `tagly-shared/client/api/caller.ts`:

```typescript
const submitChanges = async () => {
  setLoading(true);
  const result = await callAuthed(
    navigation,
    (jwt) => updateData({ jwt, body: data }),
    { handleSpecificErrorManually: true },
  );

  if (!result.ok) {
    // Handle specific error codes
    if (result.error?.error.code === 1234) {
      Alert.alert("Specific Error", "Specific message");
    }
    setLoading(false);
    return;
  }

  // Success path
  updateContext(result.data);
  Toast.show({ type: "success", text1: "Success" });
  setLoading(false);
};
```

**Anti-Patterns:**

```typescript
// ❌ WRONG - Not using callAuthed wrapper
const response = await fetch("/api/data", { headers: { Authorization: jwt } });

// ❌ WRONG - Not handling loading state on error
if (!result.ok) return; // Loading state never cleared!

// ❌ WRONG - Not passing navigation
await callAuthed((jwt) => getData({ jwt })); // Missing navigation!
```

### Error Handling

The `callPublic` and `callAuthed` wrappers already handle:

- All OTP errors (302-310)
- Network errors, timeouts
- Rate limiting (429)
- Validation errors (Zod)

**Only use `handleSpecificErrorManually: true` when the error provides actionable, user-relevant feedback:**

Good candidates:

- "Address not found" - User can re-enter
- "Content already monetized" - Choose different content
- "Insufficient balance" - Add funds
- "Email already registered" - Log in instead

Skip manual handling for:

- Rare server errors (502, 500)
- OTP errors (already handled)
- Generic validation failures

**HARD RULE — `handleSpecificErrorManually` means you own EVERY domain code.**
The flag mutes **all** codes ≥ 1000 in the central handler (`caller.ts`
returns before the fallback alert), not just the ones you plan to map. So the
error branch must map each specific code the endpoint can throw **and end in
an `else` fallback alert** — an unmapped code must never fail silently. This
bit twice in the v2 review: account deletion swallowed 1201/1100 with zero
feedback (E043), and the share-assessment 4093 conflict surfaced as a generic
"Something went wrong" loop (E046). Pattern:

```typescript
if (code === 1201) { /* specific alert */ }
else if (code === 1100) { /* specific alert */ }
else if (typeof code === "number" && code >= 1000) {
  customAlert(t("failedTitle"), t("failedBody")); // never silent
}
// codes < 1000 (OTP, network, 429...) still alert centrally
```

**HARD RULE — never sign out (or take any destructive session action) on a
transient or protocol-level status.** A failed authed call proves nothing about
the session: the SDK synthesizes its own `408` on its 15s timeout, `429` is a
rate limit, and `426` is the FORCED-UPDATE response — `callAuthed` shows the
update wall and still returns `{ok:false, status:426}`, so a status-range
sign-out fires *behind the wall* and would log out + de-push the entire
outdated user base the moment the min-version gate is raised (E040). `401` is
already fully handled inside `callAuthed`. The only status that means "this
session is dead" is a **specific domain signal** — for `/me` it's `404` +
domain `4043` (account row gone under a valid JWT). Match that exactly
(`contexts/Customer.tsx` is the worked example + its jest status-matrix test);
never a `status >= 400` range check.

**Fetch-dedupe keys are committed only on SUCCESS (E042).** A screen that
skips refetches via a "last fetched key" (the Discover shelves pattern) must
burn the key only when `result.ok && result.data` — committing it in the
failure path records the failure as a successful empty load and pins the empty
state for the whole session (the tab stays mounted, so nothing resets it). On
failure: keep stale data, settle a loading state, leave the key un-burned so
tab re-focus retries — and give the screen a pull-to-refresh throttled by the
shared `useCooldown` (the stories-picker shape), with the refresh nonce inside
every fetch key. `app/(app)/(tabs)/discover/index.tsx` + its
`__tests__/Discover.e042.test.tsx` are the worked example.

---

## Hook Patterns

### Standard Cache Times

```typescript
// Detail endpoints (single resource)
{ staleTime: 10 * 60 * 1000, gcTime: 7 * 24 * 60 * 60 * 1000 }  // 10min stale, 7day gc

// List endpoints - managed by usePagedList
```

| Check                    | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| useDetailQuery for details | Single-resource fetches use `useDetailQuery` (plain fresh fetches, staleness bounded by `staleTime`; no ETag layer — a probe-based ETag can pin derived fields stale behind 304s) |
| usePagedList for lists   | Paginated lists use `usePagedList` hook                      |
| Navigation in hooks      | Hooks that call API receive `navigation` parameter           |

---

## Context Patterns

```typescript
const MyContext = createContext<MyContextType>({
  value: null,
  setValue: () => {},
  hydrated: false,
});

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error("useMyContext must be used within MyContextProvider");
  }
  return context;
}

export function MyContextProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<Value | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync("myValue").then((stored) => {
      if (stored) setValue(JSON.parse(stored));
      setHydrated(true);
    });
  }, []);

  const api = useMemo(() => ({ value, setValue, hydrated }), [value, hydrated]);

  return <MyContext.Provider value={api}>{children}</MyContext.Provider>;
}
```

**Rules:**

- Hook throws error if used outside provider
- Default values provided (not undefined)
- Async-loaded contexts have `hydrated` flag
- Complex context APIs wrapped in `useMemo`

---

## Screen Patterns

> **Keyboard-aware forms.** `KeyboardProvider` (`react-native-keyboard-controller`)
> is mounted at the app root, so any form screen can use `KeyboardAwareScrollView`
> (with `bottomOffset` for a gap above the keyboard) for robust iOS+Android keyboard
> avoidance — prefer it over `automaticallyAdjustKeyboardInsets` for new full-screen
> forms whose inputs can sit low on the screen. It's a **native module**, so a
> `yarn ios:dev` / `yarn android:dev` rebuild is required. (Inputs inside a
> `BottomSheet` already get keyboard handling from the sheet — no change needed.)

> **Onboarding bottom CTAs use `BottomActionBar`.** Every `(onboarding)` step
> (consent, notifications, instagram, profile) pins its bottom action(s) in the
> shared `BottomActionBar` (`@tagly/client`) rather than a hand-rolled bottom
> `View` — one home for the top shadow + `insets.bottom + screenPadding`, so the
> CTA can never scroll away and every step matches. Pattern: `SafeAreaView
> edges={["top"]}` (the bar owns the bottom inset), the content scroll reserves
> the bar's measured height via `onHeightChange` → `paddingBottom: barHeight +
> spacing.lg`, and a form step (profile) pairs it with a `KeyboardAwareScrollView`
> + `keyboardBehavior="hide"` (fades the CTA while a field is focused). Same shape
> as the advertiser `StepShell`.

```typescript
import { spacing } from "@tagly/client";

export default function MyScreen() {
  const { colors } = useColorTheme();
  const { customer } = useCustomer();
  const navigation = useNavigation<NavigationProp>();
  const { data, isLoading, refetch } = useMyData(navigation);
  const scrollRef = useRef<ScrollView>(null);

  useScrollToTop(scrollRef);

  // Guard clause for loading
  if (!customer || isLoading) return <PageLoading />;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingVertical: spacing.screenPaddingVertical,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={{ marginHorizontal: spacing.screenPaddingHorizontal }}>
        {/* Content with consistent horizontal padding */}
      </View>
    </ScrollView>
  );
}
```

**Checklist:**

- Guard clauses before hooks for conditional rendering
- `<PageLoading />` while essential data loads
- `RefreshControl` for pull-to-refresh
- `useScrollToTop` ref for scrollable screens
- Use `spacing.screenPaddingVertical` for vertical padding
- Use `spacing.screenPaddingHorizontal` for horizontal margins
- Use `spacing.componentGap` between major sections

---

## Component Patterns

| Rule                    | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| Controlled loading      | Components manage loading state for async operations                 |
| Context updates         | Mutations update relevant context on success                         |
| Toast for success       | Non-blocking success feedback uses `showToast()` from `@tagly/client` |
| Alert for errors        | Blocking error messages use `customAlert()` from `@tagly/client`     |
| Alert for confirmations | Destructive actions require user confirmation via `customAlert()`    |

**Important:** Always use `customAlert()` from `@tagly/client` instead of React Native's `Alert.alert()`. This keeps alert styling/behavior consistent across both apps.

**Important:** Always use `showToast()` from `@tagly/client` instead of `Toast.show()` directly. This ensures consistent toast behavior across both apps.

```typescript
import { showToast } from "@tagly/client";

// ✅ CORRECT
showToast({
  type: "success",
  text1: "Success",
  text2: "Your changes were saved",
});

// ❌ WRONG - don't use Toast directly
Toast.show({ type: "success", text1: "Success" });
```

---

## Internationalization (i18n)

**Every user-facing string must be translated — no hardcoded copy in any file that renders text.** This is non-negotiable and applies to **screens, components, contexts, hooks, and `customAlert`/toast messages** alike. The app ships English (`en`) and Czech (`cs`); both must exist for every string.

**Colocate the translations next to the file that uses them** — exactly like the screens in `app/(onboarding)/` (e.g. `otp/otp.en.json` + `otp/otp.cs.json` next to `otp/index.tsx`). The same rule holds for non-route files: a component's JSON sits next to the component (`components/drawer/CustomerDrawer.{en,cs}.json` next to `CustomerDrawer.tsx`), a context's next to the context, etc.

**To add a namespace (do all four):**

1. **Create** `<Name>.en.json` + `<Name>.cs.json` next to the file. Start each with a `"//"` key noting where it's used (`"Used in: app/(app)/(tabs)/map.tsx (map namespace)."`), then the keys. Both language files must have identical key sets.
2. **Register** both in [`i18n/appLocales.ts`](i18n/appLocales.ts): import them and `registerLocale("ns", { en, cs })`.
3. **Augment** the `TaglyI18nResources` interface in that same file (`ns: typeof nsEn`) so `t()` stays type-checked against your keys.
4. **Consume** with `const { t } = useTranslation("ns")` and `t("key")` — never inline a literal.

```tsx
// ❌ WRONG — hardcoded English
<TopMenu title="Map" />
<CustomButton label="Log out" onPress={signOut} />

// ✅ CORRECT — colocated namespace + t()
const { t } = useTranslation("map");
<TopMenu title={t("title")} />
```

Notes:
- `@tagly/client` has **no central catalog** (the old `i18n/locales/{en,cs}/…` v1 namespaces are gone) — every namespace is colocated with its component and registered via `registerLocale`, which deep-merges with `overwrite`, so an app namespace may reuse a bare name (`account`, `map`) and its keys win. Don't recreate a central catalog — colocate.
- Module-level constants can't call `t()` — move config that needs translation **inside** the component (see `(tabs)/_layout.tsx`, where the `tabs` array moved into the body so labels can use `t()`).
- Don't forget the Czech file. A missing `cs` key falls back to the key string, which ships untranslated copy.
- **Czech glossary — a balance _withdrawal_ is "výběr / výběry (peněz)", never "výplata"** (which means a payout / wages). The whole cash-out feature already standardises on "výběr" (account CTA `setUpPayouts` = "Vybrat peníze", the drawer row, the transactions feed, the `withdraw` screen) — match it. Use "vybrat peníze" for the action, "nastavit výběry" (not "nastavit výplaty") for setting up payouts.

---

## Money Display & Currency Localization

All money is stored as integer cents in USD on the ledger. CZ-locale users see CZK as a courtesy conversion. Two display patterns:

- **Owned/transactional displays** (balance, transaction history, withdrawals): show USD as the primary line; render a small `≈ X Kč` secondary line under it. The USD stays the "real" number.
- **Estimate displays** (estimated reward, projections): show CZK only for CZ users (no USD, no `≈`).

Use the `useFormatBudget()` hook from `@tagly/client` — it reads the viewer's locale and current USD→CZK rate from `ExchangeRateContext`, so call sites don't have to thread either:

```typescript
import { useFormatBudget } from "@tagly/client";

const formatBudget = useFormatBudget();

// Estimate site (CZK for CZ, USD for US)
formatBudget(cents);

// Dual-display primary (always USD, regardless of locale)
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

For inline `<Text>` rendering, gate on the secondary string:

```tsx
const primary = formatBudget(cents, { forcedCurrency: "USD" });
const secondary = formatBudget(cents, { asCzkSecondaryLine: true });

<Text>{primary}</Text>
{secondary && <Text style={...}>{secondary}</Text>}
```

The rate is fetched from frankfurter.app once per 24h on app launch, only for CZ users. If the rate is unavailable, the hook silently falls back to USD. The `ExchangeRateProvider` is mounted in `(app)/_layout.tsx` after the customer loads.

The pure `formatBudget(cents, opts?)` from `@tagly/client` is still exported for USD-only contexts (admin dashboard, tests) — it does not know about locale or rate.

Strings interpolated inside `t()` should stay USD unless a translator handles them.

## Analytics (PostHog)

Product analytics run through PostHog, mounted **anonymously** in `app/_layout.tsx`
(`personProfiles: "identified_only"`, no `identify()` — legitimate-interest basis,
no consent screen). **One PostHog project is shared with the advertiser app**, kept
apart by a global `app` super-property (`app: "customer"` here, stamped on every
event via `customAppProperties` — filter/break down by `app`, never prefix event
names or split into two projects). Every event goes through the typed catalog in
[`utils/analytics.ts`](utils/analytics.ts) — **never call `posthog.capture()`
directly**:

```typescript
import { useAnalytics } from "@/utils/analytics";

const { track } = useAnalytics();
track("share_created", { businessUid, shareUid }); // payload type-checked
track("onboarding_signin_viewed");                 // no-payload events take none
```

To add an event, give it a key in `AnalyticsEventMap` (value = its payload, or
`EmptyPayload` for none); `track()` is then compile-checked against the catalog.
**Never put PII in a payload** (no email/name/IG handle/token) — enums, booleans,
counts, and prefixed UIDs only. **Naming convention:** `<funnel>_<step>_<pastTense
Action>`; onboarding uses `path_` for the two parallel identity paths (email vs
oauth) and omits it on the linear shared steps. Two funnels are instrumented today:
**onboarding** (`onboarding_started` → `onboarding_path_{email_submitted,
email_verified,oauth_submitted}` → `onboarding_push_resolved` →
`onboarding_consent_submitted` → `onboarding_profile_submitted` →
`onboarding_completed`; events live in `OnboardingContext`, with the
`onboarding_started` top-of-funnel in `components/onboarding/SignIn`, and the
Instagram-step failure signals — `onboarding_instagram_cancelled {outcome}` /
`onboarding_instagram_error {instagramError, instagramErrorReason}` — in the
`(onboarding)/instagram` screen's connect handler) and **share
creation** (`share_create_started` → `share_create_confirm_viewed` →
`share_create_submitted` → `share_create_succeeded`, with `share_create_failed` as
the drop-off signal). Shares are created from **two** surfaces — the story-picker
flow and the app-open `ShareOpportunitySheet` one-tap create — both of which go
through the **`useCreateShare()`** hook ([hooks/useCreateShare.ts](hooks/useCreateShare.ts)),
which owns the create-share request, the analytics trio
(`share_create_{submitted,succeeded,failed}`), the IG-stories cache drop, the
store-review prompt, **and error presentation** (domain-code → alert, copy in the
colocated `useCreateShare` i18n namespace — so both surfaces show the same specific
messages, not a generic fallback). **Create shares only through this hook** — pass
the `source` (`"picker"` | `"opportunity_sheet"`; threaded through the picker via a
route param so an `inBusiness` handoff stays attributed to the nudge) and
`navigateOnError` (**picker `true`** → 4100 routes to the tag screen, 4106 offers
"pick another"; **sheet `false`** → those just alert, since there's no picker stack
behind it). Every share event carries `source`, and `share_create_succeeded` is the
single canonical "share created" count across both surfaces (sum for totals; break
down by `source`). The `started`/`confirm_viewed` steps fire in the picker screens;
the nudge sheet also emits `share_opportunity_shown`. Callers keep only their
surface-specific success toast + exit/nav. The catalog stays app-local (the
advertiser app has its own twin in `tagly-advertiser/utils/analytics.ts`; both
share ONE PostHog project split by the `app` super-property).

**Push opens:** `push_opened { slug }` fires from the shared
`usePushOpenedListener` hook (`@tagly/client`) mounted in `RootNavigator` —
outside the auth gate so pending-customer taps count, inside the PostHog
provider. It's the only observable push "open" (a tap; the OS never reports
tray views) and pairs with the backend's `promo_notification_sent` for
per-step open rates. It deliberately does no navigation — push deep linking is
deferred (v2.0.0.md §Notifications).

**Passive autocapture** (no manual events): **app-lifecycle** events
(`captureAppLifecycleEvents` in the provider options — DAU/retention/session
length) and **screen views**, captured manually by `useScreenTracking()` (mounted
in `RootNavigator`). Screen names come from the expo-router **route pattern**
(`useSegments()` → `/shares/[uid]`, not the resolved URL) so ids never leak and
screens aggregate by route. PostHog's `captureScreens` autocapture is **disabled**
— it can't reach expo-router's NavigationContainer; **touch** autocapture is off
too (noisy). Don't re-enable either.

## Color & Theming

```typescript
const { colors } = useColorTheme();

// ✅ CORRECT - Dynamic style
<View style={{ backgroundColor: colors.background }}>

// ✅ CORRECT - Memoized StyleSheet
const styles = useMemo(() => StyleSheet.create({
  container: { backgroundColor: colors.background },
}), [colors]);

// ❌ WRONG - Hardcoded colors
<View style={{ backgroundColor: "#f9f9f9" }}>

// ❌ WRONG - Static StyleSheet with theme colors
const styles = StyleSheet.create({
  container: { backgroundColor: colors.background }, // colors not in scope!
});
```

---

## Navigation Patterns

| Pattern                | Usage                                              |
| ---------------------- | -------------------------------------------------- |
| `useNavigation()`      | Get navigation prop (typed as `any` is acceptable) |
| `navigation.goBack()`  | Modal/form screens after success                   |
| `navigation.replace()` | Auth flows to prevent back navigation              |
| `navigation.reset()`   | Logout to clear stack                              |

---

## Loading States

| Check          | Description                                        |
| -------------- | -------------------------------------------------- |
| Initial load   | Screen shows loading indicator while data fetches  |
| Button loading | Submit buttons show loading state and are disabled |
| Inline loading | Inline actions show loading indicator              |

---

## Error States

| Check          | Description                                        |
| -------------- | -------------------------------------------------- |
| Network errors | User-friendly message for network failures         |
| API errors     | Domain errors (code >= 1000) handled appropriately |
| Empty states   | Meaningful UI when list is empty                   |
| Not found      | Handles 404 responses gracefully                   |

---

## Edge Cases

| Check          | Description                                    |
| -------------- | ---------------------------------------------- |
| Empty inputs   | Form validation prevents empty required fields |
| Long text      | UI handles long text (truncation, wrapping)    |
| Missing images | Fallback shown when images fail to load        |
| Rapid taps     | Prevents double-submission on button taps      |

**Double-Tap Prevention:**

```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  if (loading) return; // Prevent double-tap
  setLoading(true);
  // ... API call
  setLoading(false);
};

<Button disabled={loading} onPress={handleSubmit} />
```

---

## Performance

### List Performance

```typescript
// ✅ CORRECT - FlatList for long lists
<FlatList
  data={items}
  keyExtractor={(item) => item.id.toString()}
  renderItem={({ item }) => <ItemComponent item={item} />}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
/>

// ❌ WRONG - ScrollView with map for long lists
<ScrollView>
  {items.map((item) => <ItemComponent key={item.id} item={item} />)}
</ScrollView>
```

### Memoization

| Check                 | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| Memoized callbacks    | Event handlers wrapped in `useCallback` when passed to children |
| Memoized values       | Expensive computations wrapped in `useMemo`                     |
| Context splitting     | Large contexts split to prevent unnecessary re-renders          |
| FlatList optimization | Uses `keyExtractor`, `getItemLayout` when possible              |

---

## Documentation Requirements

Every screen, component, hook, and utility must have a docblock describing what it does and any non-obvious dependencies or behavior. **Update the docblock whenever you change behavior** — a stale docblock is worse than none.

---

## Common Anti-Patterns

### Direct API Calls

```typescript
// ❌ WRONG
const response = await fetch("/api/endpoint", { ... });

// ✅ CORRECT
const result = await callAuthed(navigation, (jwt) => endpoint({ jwt, ... }));
```

### Missing Loading State Reset

```typescript
// ❌ WRONG - Loading never cleared on error
const submit = async () => {
  setLoading(true);
  const result = await callAuthed(...);
  if (!result.ok) return; // Loading stuck!
  setLoading(false);
};

// ✅ CORRECT - a finally covers every exit: success, failure, AND throws
const submit = async () => {
  setLoading(true);
  try {
    const result = await callAuthed(...);
    if (!result.ok) return;
    // ... success
  } finally {
    setLoading(false);
  }
};
```

**Never skip the reset on the success path on the assumption that "the caller
navigates away and unmounts."** Components rendered with an `open`/`visible`
prop from a layout (sheets, modals, the app-open nudge) NEVER unmount — their
hook state survives, and a leaked flag re-disables their buttons the next time
they open. This is the E012 wedge: `useCreateShare` left `submitting` true
after a successful create, and the permanently-mounted `ShareOpportunitySheet`
reopened with both buttons dead and no dismissal path — force-quit was the
only recovery. Default to `try/finally`; if a flag genuinely must persist
through an exit (a success beat), the hosting overlay must keep one
always-enabled exit (see the shared-client CLAUDE.md rule).

### Missing Navigation in API Utils

```typescript
// ❌ WRONG
export async function doThing(data) {
  const result = await callAuthed((jwt) => api({ jwt, data })); // No navigation!
}

// ✅ CORRECT
export async function doThing(navigation, data) {
  const result = await callAuthed(navigation, (jwt) => api({ jwt, data }));
}
```

---

See [README.md](README.md) for commands, deployment status, and Android setup.
