# Tagly — Design System Rules

This file governs all UI work. Read it before writing or editing any component.
The design tokens live in `tagly-shared/client/theme/theme.ts` (the `themes` object plus
`spacing`, `layout`). Always pull values from there. Never hardcode a hex, size,
radius, or shadow that exists as a token.

---

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../../CLAUDE.md).

## Package structure & conventions

`@tagly/client` is the shared RN package (design system + cross-app client lib).
Top-level layout:

```
theme/        design tokens, ThemeProvider, fonts, colorUtils
i18n/         i18n infra ONLY: init, registerLocale, detectLocale, useCatalogLocalizer (no string catalog)
api/          callAuthed / callPublic (+ apiErrors.{en,cs}.json colocated here)
contexts/     app-wide providers (CurrentLocation, ExchangeRate, UserPreferences, BusinessMapCache)
hooks/        reusable hooks
components/    ALL RN UI — grouped by domain (primitives, feedback, media, navigation, overlays, pickers, maps, previews, drawer, businesses)
utils/        pure helpers: formatting/ · geo/ · ids/ · media/ · platform.ts · composeProviders.tsx
services/     side-effecting platform integrations: storage/ · permissions/ · auth/ · attribution/ · reviews/ · uploads/ · media/ (pickMedia) · links/
index.ts      the public barrel (consumers import by symbol; never deep-import)
```

Two rules for adding to `components/`:

1. **Folder per component.** A component lives in its own folder with `index.tsx`,
   its translation files, `styles.ts` (if non-trivial), and any subcomponents —
   e.g. `components/previews/BusinessPreview/{index.tsx, BusinessPreview.en.json,
   BusinessPreview.cs.json}`. Match `tagly-customer/app/(onboarding)/` and
   `tagly-customer/components/`.
2. **Colocate i18n.** A component's strings live in `<Name>.{en,cs}.json` **next
   to it** (a feature shared by several components, e.g. the map cluster, may use
   one `<feature>.{en,cs}.json` at the feature-folder level). There is **no central
   `locales/` catalog** — register colocated namespaces in `i18n/index.ts`
   (`enResources`/`csResources`). See [i18n/CLAUDE.md](i18n/CLAUDE.md).

Don't hardcode a value owned by another module (collapse the micro-folders into
`utils/`/`services/`, don't recreate single-file folders).

> The hex/values quoted below are the **cream** theme, **for reference only** — the
> token in code is the source of truth. They can drift, so if you change a token in
> `tagly-shared/client/theme/theme.ts`, update this file to match (there's a reminder at
> the top of `theme.ts`).

---

## The one rule that gets broken most: borders vs shadows

**Do NOT put borders around cards, tiles, or containers.**
Separation comes from SHADOW, not from outline lines. The cream background
(`#FFFCF2`) and white surfaces (`#FFFFFF`) are close in tone on purpose — the
two-layer warm shadow is what makes a card read as lifted. A border line makes
everything look corporate and flat. This is the most common mistake. Stop adding
borders.

When you think "this element needs an edge," reach for `shadow.card`, not a border.

Borders are allowed in only these narrow cases:

1. **Dividers** between rows inside a card — a single hairline `color.border.divider`.
2. **Empty / "add" states** — a dashed `color.border.strong` (e.g. an empty
   "add a business" slot). Dashed only, to signal "nothing here yet."
3. **Buttons and inputs** legitimately have edges — but you never draw those by
   hand. Use the `CustomButton` / `CustomTextInput` primitives, which own them.

---

## Inputs — use `CustomTextInput`

Never hand-roll a field. `CustomTextInput` owns the look and every state
(resting, focus, valid, error) — don't restyle it. Drive state through props:
pass `error` (a message) to put the field in its error state, and `valid` for the
success check. Focus is handled internally and uses **ink**, never accent (accent
is reserved for selection).

## Toggles — use `Toggle`

For any on/off switch, use the shared `Toggle` primitive
(`components/primitives/Toggle.tsx`) — an ink/muted pill track with a sliding
knob. Never use RN's `Switch` (off-theme colors, buggy `ios_backgroundColor`)
and never hand-roll a track+knob.

## Business page forms — use `components/businesses/`

The business-page create/edit UI is shared by the **advertiser and admin** apps:
`components/businesses/pageForm/` (`StepShell`/`StepBasics`/`StepMedia`/
`StepDetails` + `formMappers` — host-agnostic step forms; `StepDetails` gains
the admin-only search-tags section via `enableTags`) and
`components/businesses/CreateBusinessWizard/` (the 3-step create flow with an
**injected api** — `CreateBusinessWizardApi<TBusiness>` — plus `locale` and
`draftKey` props, so each app wires its own `/v2` endpoints). Image picking is
`services/media/pickMedia.ts` (`pickBanner`/`pickPhotos` over
`react-native-image-crop-picker` — a native module; apps that adopt it need a
dev-client rebuild). Never fork these forms per app; extend via props.

**Submit errors go through `alertBusinessFormError`**
(`components/businesses/pageForm/formErrorAlert.ts`) — the single mapper from
the business endpoints' domain codes (address 1203/1204/5200/4944, profanity
4951, moderation 5210, image validation 5203/5204/5205, photo cap 5206) to
user copy in the `businessPageForm` namespace. The backend attaches
`errors: [{ path, message }]` detail on moderation/image failures (which
field/image + a machine reason like `tooLarge` or `nudity`), and the mapper
names them in the alert; it returns the step (`basics`/`media`/`details`) that
can fix the error so stepped hosts jump there. Call sites must pass
`handleSpecificErrorManually: true`. Never hand-roll these alerts in a screen.

## Star ratings — use `StarRating`

For any half-star rating display or input (1–10 half-star units = ½★–5★), use
the shared `StarRating` primitive (`components/primitives/StarRating.tsx` —
brand-butter fill, `shadow.text` lift, drag-or-tap input). Used by the
advertiser rate/report flow and the admin subsidized-rating queue. Never
hand-roll star glyph rows.

---

## Elevation (shadows) — the ladder

Every surface sits on exactly one rung. Pick by what the element actually is,
not by how important it feels.

| Token           | Use for                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `shadow.chip`   | barely-lifted small things: filter chips, unselected pills |
| `shadow.card`   | resting cards, panels, venue cards, the earnings summary   |
| `shadow.button` | a floating action button (FAB) that hovers ALONE over scrolling content |
| `shadow.float`  | modals, bottom sheets, dialogs                             |
| `shadow.text`   | a lifted **glyph/text** (e.g. the rating stars) — the only shadow for type |

`shadow.chip`/`card`/`button`/`float` are CSS `boxShadow` strings (spread as
`boxShadow: shadow.card`). `shadow.text` is the odd one out: text can't take a
box-shadow, so it's an **object of RN `textShadow*` props** — spread it into a
`Text`/icon style (`style={shadow.text}`), never as `boxShadow`. Same warm tint as
the surface shadows but heavier (a thin glyph needs more drop than a card to read
as lifted). It's the one warm-tinted way to lift a glyph; don't hand-roll
`textShadowColor`/`Offset`/`Radius`.

Rules:

- Shadows are ALWAYS the warm burgundy-tinted values in `theme.ts`. **Never use a
  black shadow** (`rgba(0,0,0,...)`). A black shadow is the one thing that cheapens
  the whole palette. (Exception: the `neutral` theme has its own black-based shadows;
  use the active theme's tokens, never hardcode.)
- **Buttons own their elevation** (`CustomButton`) — never shadow a button by hand.
  Only the `soft` tier carries an inline shadow, so don't drop a soft button into an
  already-shadowed card (don't stack shadows).
- A surface only floats when it genuinely hovers over scrolling content: a FAB
  (`shadow.button`), or a pinned bottom CTA where **the bar carries the top shadow**
  (`0 -2px 12px rgba(56,39,36,0.08)`) and the content inside stays flat.

---

## Color — roles, not decoration

Pull every color from the active theme (`themes.brand` = cream, the default).
Hex values below are the cream theme for reference; in code use the token.

| Token                                   | Hex (cream) | Job — use ONLY for this                                                                      |
| --------------------------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `color.background`                      | `#FFFCF2`   | the page background                                                                          |
| `color.surface`                         | `#FFFFFF`   | cards, input fills, white chips/tiles                                                        |
| `color.brand`                           | `#FFF3B0`   | butter. ACCENTS ONLY — pills, badges, selected chips, small highlights. Never a large field. |
| `color.accent`                          | `#C1DBE8`   | soft blue. Secondary accent — tags, selected states, avatars, fills.                         |
| `color.ink`                             | `#382724`   | ALL text + the primary action fill                                                           |
| `color.success`                         | `#3F9B6E`   | money / earnings / positive / verified                                                       |
| `color.danger`                          | `#D4523E`   | errors, destructive only                                                                     |
| `color.text.primary/secondary/tertiary` | brown ramp  | text tiers (see Type)                                                                        |
| `color.on.*`                            | —           | text/icon color when sitting ON a colored fill                                               |

### Color rules

- **60 / 30 / 10.** ~60% background + white surfaces, ~30% content/photos,
  ~10% accent color. Accents are small. If a screen looks "all yellow," you've
  used `brand` as a fill instead of an accent — fix it.
- **Butter and blue never appear as large blocks, and never touch each other
  directly** — separate them with white or background.
- **Bottom sheets use `color.background` (cream), not surface.** A content sheet
  is a mini-page: its white children (inputs, chips, cards) need the cream
  underneath to separate, exactly as on a screen — a white sheet would put white
  on white. Reserve a white `surface` sheet for a plain dialog with no white
  sub-elements.
- **Burgundy `ink` anchors everything**: all body text, all headings, all primary
  buttons. It is the workhorse.
- **Green is reserved for money and success.** Earnings figures, "verified",
  positive deltas, success banners. Don't use green decoratively.
- **Red is rare** — errors and destructive actions only. Keep it rare so it keeps
  its punch. One sanctioned exception: the **"Ending soon" scarcity signal**
  (`isLowBudget` — the business may run out of budget and disappear) uses the
  soft `dangerBg` + `on.dangerBg` pair (never solid `danger`) in the
  `BusinessPreview` pill and the business-detail notice. Don't add further
  non-error reds.
- **Text on a colored fill uses the matching `color.on.*` value**, never plain
  black, never gray. (Butter fill → `on.brand` `#382724`; blue fill → `on.accent`
  `#2E4A55`; ink fill → `on.ink` `#FFF3B0`.)
- **Text color is never grey.** Use the warm-brown text tiers (`text.secondary`
  `#8A6F5F`, `text.tertiary` `#B59A7E`). Grey looks dead on cream.

---

## Typography

Two families, accessed via `theme.font` (`heading` = Playfair Display,
`body` = Stack Sans Text). Always apply via the composed `text` styles
(`theme.text.title`, etc.) — never assemble font + size + weight by hand.

### textStyles and what each is for

| Style        | Font / size / weight   | Use for                                                    |
| ------------ | ---------------------- | ---------------------------------------------------------- |
| `display`    | Playfair 30 / bold     | onboarding hero, screen hero                               |
| `title`      | Playfair 24 / bold     | venue names, big screen titles                             |
| `heading`    | Playfair 19 / semiBold | section headers ("Earn at these places")                   |
| `body`       | Stack 16 / 400         | primary reading text, descriptions                         |
| `bodyMedium` | Stack 16 / 500         | emphasized body, list-row titles                           |
| `label`      | Stack 14 / 500         | chips, active nav, form labels                             |
| `caption`    | Stack 13 / 400         | supporting / meta text                                     |
| `micro`      | Stack 11 / 500         | timestamps, overlines                                      |
| `amount`     | Stack 24 / 500         | earnings figures (kept in SANS, not serif, for legibility) |
| `amountLg`   | Stack 40 / 500         | balance hero — the one big "available" figure on a card    |
| `amountSm`   | Stack 15 / 500         | inline amounts in rows (`+180 Kč`)                         |

### Type rules

- **Playfair (heading font) is for names, headers, and moments only.** Never in
  buttons, labels, captions, or body. If it's small or functional, it's Stack Sans.
- **Playfair never below 18–19px, and never below semiBold (600).** It's
  high-contrast, so anything below 600 has hairline strokes that get fragile and hard
  to read at app sizes. 600 is the FLOOR, not the ceiling — weight scales up with
  size: `display`/`title` use **bold** (`heading.bold`) for presence at large sizes,
  `heading` uses **semiBold** (`heading.semiBold`) since bold gets chunky at 19px.
  Bigger = bolder; never lighter than 600.
- **Stack Sans never heavier than 500.** Two weights only (400 / 500). Emphasis
  comes from size and color, not extra weight.
- **Money stays in sans** (`amount` / `amountSm`), never serif — legibility.
- **Sentence case.** No Title Case, no ALL CAPS (except `micro` overlines may use
  uppercase + letter-spacing).
- Color is NOT baked into textStyles — pass it separately. Same `title` style is
  ink on a card, white on a photo.
- **Font loading:** Playfair ships **semiBold (600) + bold** (semiBold for `heading`,
  bold for `display`/`title`). Stack Sans ships **400 + 500**. Don't load weights that
  aren't in this list.

---

## Radius

From `theme.radius`. Three tiers, and the contrast between them is intentional.

- `radius.structure` (8) — cards, images, panels, inputs, sheets.
- `radius.button` (4) — buttons.
- `radius.pill` (999) — pills, tags, chips, badges. ALWAYS fully round.

Rules:

- Pills/tags/badges are always `radius.pill`. Never give a chip an 8px corner.
- **No rounded corners on a single-sided border/accent.** If you use a
  `border-left` accent strip, set the radius to 0 on that element — rounded corners
  only work with all-sides treatment.

---

## Spacing & layout

From `spacing` (the 4-based scale) and `layout` (fixed constants). Both are
theme-independent top-level exports.

`spacing`: `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 · 3xl 48`
`layout`: `screenPadding 16 · cardPadding 16 · cardPaddingCompact 12 · gap 12 · minTapTarget 44`

Rules:

- **Every margin, padding, and gap comes from `spacing`.** No arbitrary values
  (`padding: 15px`, `margin: 18px` are forbidden). If something feels between two
  steps, pick the nearer step — don't invent a value.
- **Screen-edge inset is always `layout.screenPadding`** — use it, not `spacing.lg`
  (even though both are 16). Every element flush to a screen edge takes it: the
  **horizontal** inset of any full-width component, and the **top** gap above the
  first/topmost element (a screen's `paddingTop`, or a notice floating below the
  top bar). The semantic token keeps every screen edge aligned and tunable in one
  place; reserve the raw `spacing.*` scale for _between_-element gaps and
  component-internal padding.
- Default card interior padding is `layout.cardPadding` (16); compact cards use 12.
- Gap between cards / between sections: 12 / 24.
- **Every interactive element has a hit area ≥ `layout.minTapTarget` (44).**
  This is touch area including padding, not visible size — a 16px icon button still
  needs ~44px of tappable region. Never shrink a tap target below this.

---

## Screen layout, safe areas & vertical rhythm

`layout.screenPadding` (16) controls how far content sits from the **left/right**
edges. This section covers the other axis — top/bottom spacing, notch/home-indicator
clearance, and the gaps between a screen's blocks. There are no dedicated vertical
tokens; vertical rhythm is built from the **`spacing` scale**, so the same steps
apply up-down as side-to-side.

### Safe areas — non-negotiable

This is what breaks on real devices: content slipping under the notch or the home
indicator. The pattern is always **safe-area inset + a spacing token**, never one
alone and never a hardcoded number:

- **Never hardcode notch/status-bar/home-indicator padding** (`paddingTop: 44`,
  `paddingBottom: 34`, etc.). Those numbers differ per device and per OS version.
- **React Native:** read insets with `useSafeAreaInsets()` from
  `react-native-safe-area-context`, or wrap the screen in its `SafeAreaView`
  (`edges`). Then add the design gap on top: `paddingTop: insets.top + spacing.sm`.
- **Web (advertiser):** use the CSS `env(safe-area-inset-*)` variables, same idea —
  inset plus a token.
- A `SafeAreaView` already consumes the inset, so **don't also add a full
  `screenPadding` on top of it** — that double-pads the top. Add only the small
  rhythm gap (see below).

### Vertical rhythm — the steps between blocks

Build every vertical gap from the scale. Defaults that keep screens consistent:

| Between                                          | Gap                                         |
| ------------------------------------------------ | ------------------------------------------- |
| Safe-area top → first row (header / back / chip) | `spacing.sm` (8)                            |
| Safe-area top → step progress overline (ALL onboarding/setup step screens, both apps) | `layout.screenPadding` (16) |
| Title → its eyebrow/subtitle                     | `spacing.xs`–`spacing.sm` (4–8), kept tight |
| Title block → first content block                | `spacing.xl` (24)                           |
| Section → section                                | `spacing.xl` (24)                           |
| End of scroll content → bottom                   | `insets.bottom + layout.screenPadding` (or the floating-menu form — see below) |

- A title and its subtitle are **one unit** — keep them tight (4–8) and put the
  larger gap (24) _below_ the pair, not between them.
- **Scroll bottom padding** ends in a `layout.screenPadding` gap, same screen-edge
  convention as the top/sides:
  - **No bottom menu** (a pushed detail/list screen): `paddingBottom:
    insets.bottom + layout.screenPadding` — clears the home indicator + the gap.
  - **A floating bottom menu overlays content** (the tab screens): clear the whole
    menu footprint + the gap → `bottomMenuHeight + layout.screenPadding`. Don't
    hand-roll it: call **`useNavBottomPadding()`** (from `@tagly/client`), which
    returns exactly this (`insets.bottom + NAV_HEIGHT + layout.screenPadding`
    floating; just `layout.screenPadding` classic — the in-flow bar consumes
    `insets.bottom` itself). Use its value **as** the `paddingBottom` — don't
    add extra `spacing.*` on top.
- A **pinned bottom CTA** sits in a bar inset by `screenPadding` horizontally, with
  `spacing.lg` (16) of breathing room above it; per the Elevation section the _bar_
  carries the top shadow and the button inside stays flat.

### Top-to-bottom reference

```
┌─────────────────────────────┐ ← safe-area top (insets.top)
│         spacing.sm (8)       │
│  Header row (back · chip)    │
│         spacing.xl (24)      │
│  Title            (display)  │
│      spacing.xs–sm (4–8)     │
│  Subtitle    (body, 2ndary)  │
│         spacing.xl (24)      │
│  Section                     │
│         spacing.xl (24)      │
│  Section                     │
│      spacing.2xl (32)        │
│        + bottom inset        │
├─────────────────────────────┤ ← pinned CTA bar (top shadow); button flat inside
└─────────────────────────────┘ ← safe-area bottom (insets.bottom)
   all content inset by layout.screenPadding (16) left/right
```

---

## Buttons — use `CustomButton`

Never hand-roll a button. `CustomButton` owns the visuals (fill, shadow, border,
radius, label, disabled + pressed states). Your only job is to pick the **tier** —
ranked by surface weight, by how much you want the action used, never by color.

| Tier          | Use for                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `primary`     | the one main action on the screen (**one per screen**)                              |
| `soft`        | a high-traffic secondary you want tapped often (social login, "use another method") |
| `secondary`   | a subordinate / low-traffic action (back, dismiss, "maybe later")                   |
| `tertiary`    | lowest priority, text-only (skip, resend, forgot email)                             |
| `destructive` | a destructive action                                                                |

Choosing:

- **One `primary` per screen.** Soft buttons are not primaries; keep them below it,
  and never use a second ink-filled button as a stand-in primary.
- **Rank by weight, never by color.** Don't recolor a button to signal importance —
  color stays semantic (ink = action, green = money/success, red = destructive).
- **Soft vs Secondary** — ask *"do I want this tapped often?"* Yes → `soft`
  (real presence); escape hatch → `secondary` (recedes). E.g. social logins are
  `soft`; a dialog's "Cancel" is `secondary`.
- For inline text where only **part** of a run is tappable (Terms/Privacy), use
  `PressableText`, not a `tertiary` button.
- **Icons** are passed as an Ionicons name string (`icon="logo-google"`) —
  `CustomButton` sizes and tints it to the tier's label color. Never pass a
  pre-colored icon node. Icons lead the label by default; pass
  `iconPosition="trailing"` for an onward glyph (e.g. `arrow-forward` on a
  "Continue" CTA), where a leading arrow would point away from the text.

---

## Press feedback — one helper for every tappable surface

Every tappable thing reacts to a press the **same** way: a subtle scale-down +
opacity dip (and a slight opacity lift on web hover). This is centralized in
**`pressFeedbackStyle({ pressed, hovered })`** (`@tagly/client`,
`utils/pressFeedback.ts`). **Never hand-roll press opacity/scale values** — always
spread this helper so the feel stays identical and tunable in one place.

- **`CustomButton` already applies it internally** — you get it for free; don't
  add your own.
- **Any custom `Pressable`** (cards, tiles, rows, list items, icon buttons,
  "See all" links, etc.) must spread it into the `Pressable`'s style function,
  alongside the surface's own styles:

  ```tsx
  <Pressable
    style={({ pressed, hovered }) => [
      baseStyle,
      pressFeedbackStyle({ pressed, hovered }),
    ]}
  />
  ```

If you find yourself writing `opacity: pressed ? 0.x : 1` or
`transform: [{ scale: pressed ? … }]` by hand, stop and use the helper.

## Selected / active state pattern (used everywhere)

- **Selected pill / chip / toggle**: `color.ink` fill + `color.on.ink` text
  (e.g. an active filter, a chosen toggle option).
- **Unselected**: white surface + `shadow.chip` (NOT a border).
- **Chosen tags** (multi-select like interests): `color.brand` or `color.accent`
  fill with matching `on.*` text, plus an inline `close` (X) icon to remove.
- **Active nav item**: `color.ink` icon + label; inactive: `color.text.tertiary`.

---

## Non-dismissable sheets & busy flags — never build an inescapable state

A `BottomSheet` without `onClose` has NO exit the component doesn't provide
itself: no backdrop tap, no pull-down, no Android back (`onRequestClose` gets
`undefined`). That's a legitimate tool for forced decisions (ToS re-accept, the
share-opportunity nudge, mid-payment verify states) — but it makes a leaked
busy flag catastrophic instead of cosmetic. E012 was exactly this: a
`submitting` flag that skipped its reset on the success path, inside a
permanently-mounted non-dismissable sheet, wedged the whole customer app until
force-quit. Two rules, both mandatory:

1. **Every busy/loading flag resets on every exit path — use `try/finally`**
   (or a `catch` that restores the form when a phase must survive success,
   like the billing sheets' success beat). "The caller navigates away and
   unmounts" is not a reset: components rendered with an `open` prop from a
   layout never unmount, and `callAuthed` CAN throw (a rejecting SecureStore
   read propagates through the unwrapped SDK closure), as can any native
   module. A reset-on-open effect is not a substitute either — it can only run
   if the sheet can close.
2. **A sheet with no `onClose` must always keep at least one enabled exit.**
   Never let one state combination disable every button (`disabled`/`loading`
   on all of them) while the sheet is non-dismissable. If a phase renders no
   buttons at all (a success beat), its way out must not depend on a flag —
   e.g. a timer firing a host callback that closes the sheet.
3. **Releasing `useBlockBackWhile` and navigating in the same tick does not
   work.** Its `usePreventRemove` reads `preventRemove` from the latest
   COMMITTED render, so `setSubmitting(false)` followed immediately by
   `router.back()`/`replace()` still sees `true` and silently
   `preventDefault()`s the navigation. The screen stays put — typically with a
   success toast already shown and the submit button live again, which is
   exactly how the business-create wizard produced duplicate pages. **Defer the
   navigation a tick** (`setTimeout(..., 0)`) so the release commits first, and
   keep a terminal "done" phase so the form can't be re-submitted in the
   meantime. Worked examples: the handoff at the end of
   `CreateBusinessWizard`'s `submit` (whose `onSubmittingChange` deliberately
   reports `false` for the terminal phase, so the host's block lifts) and the
   `finish` in both media-edit screens.

---

## Icons

- One library only: **Ionicons** (`@expo/vector-icons/Ionicons`) — outline/regular
  weight to match the type. Never mix icon sets.
- Match stroke weight to the type — thin/regular, not heavy.
- Inline icon size 16–20px; 24px max decorative.
- Inactive icons use `color.text.tertiary`; active use `color.ink`.

---

## Quick pre-commit checklist

Before finishing any UI, verify:

- [ ] No borders on cards/containers (shadow does separation)
- [ ] Buttons use `CustomButton`, inputs use `CustomTextInput` — never hand-rolled
- [ ] Button tier picked by weight, not color; one `primary` per screen; Soft vs Secondary by traffic
- [ ] Every surface uses a `shadow.*` token, and it's warm-tinted (not black)
- [ ] Top/bottom padding = safe-area inset + a spacing token (no hardcoded notch value)
- [ ] Vertical rhythm from the scale (8 below safe top · 24 between sections · 32 + inset at scroll end)
- [ ] `brand` (butter) and `accent` (blue) are accents, not large fills, and don't touch
- [ ] Green used only for money/success; red only for error/destructive
- [ ] Text on colored fills uses `color.on.*`, never black/gray
- [ ] Headings in Playfair (≥600: bold for display/title, semiBold for heading), functional text in Stack Sans (≤500); money in sans
- [ ] All spacing from the `spacing` scale; no arbitrary px
- [ ] Every tap target ≥44px
- [ ] Corners: 8 structure / 4 button / 999 pill; no rounded single-sided borders
- [ ] Busy/loading flags reset on every exit path (`try/finally`); a no-`onClose` sheet always keeps one enabled exit
