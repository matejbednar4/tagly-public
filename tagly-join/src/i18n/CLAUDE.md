# tagly-join i18n Guide

Internationalization for the standalone `tagly-join` (the referral/join landing page). This is a **separate i18n system from the React Native one** in `tagly-shared/client/i18n/` — its own dependencies, its own architecture — because `tagly-join` is a standalone Next.js project (own `node_modules` + `yarn.lock`) and a server-rendered web app, not React Native.

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../../../CLAUDE.md).

## Overview

Two languages: **English (`en`, default)** and **Czech (`cs`)**. Translation uses **i18next** + **react-i18next** + **i18next-resources-to-backend** (installed in `tagly-join` only).

**Status — WIRED and translated.** The whole rendered page is localized: every user-facing string flows through `t()`, there is a navbar language switcher, and the language is detected per request. **The `cs/*.json` values are real Czech copy** (written in tykání — see the register gotcha), at full key parity with `en`. The only `cs == en` values that remain are intentionally identical (the `~250`/`~1,000` view counts, `FAQ`, and the `English` switcher label).

## Why this diverges from the RN system: per-request factory, not a singleton

The RN system (`tagly-shared/client/i18n/index.ts`) uses **one mutable global i18next singleton** with `setAppLanguage()` flipping `i18n.language`. That is safe in React Native: one user, one process, one active language.

On a Next.js **server** that model is unsafe. One process serves many concurrent requests, so a Czech and an English visitor render at the same time. A shared instance has a single `language` field — `changeLanguage()` in one request can leak into another's response (a cross-request race).

So we build a **fresh i18next instance per request** via `createInstance()` (the official i18next App Router pattern), init it with the detected language, use it, discard it.

## Directory Structure

```
src/i18n/
├── settings.ts             # languages, fallbackLng, namespaces, LOCALE_COOKIE, getOptions()
├── index.ts                # initI18next() factory + getTranslation() — SERVER ONLY (no react-i18next)
├── detectLocale.ts         # cookie -> Accept-Language -> Language (server-side)
├── TranslationsProvider.tsx# CLIENT i18next provider, seeded with server resources
├── i18next.d.ts            # type-safe keys derived from en JSON
└── locales/
    ├── en/{copy,layout}.json   # English — source of truth
    └── cs/{copy,layout}.json   # Czech — mirrors en's key set exactly (tykání copy)
```

The switcher UI lives outside this dir, inside `src/components/NavDrawer.tsx`.

## Server vs Client boundary (important)

- **`src/i18n/index.ts` is server-only and must NOT import `react-i18next`.** It is imported by Server Components (`page.tsx`, `layout.tsx`, `TopMenu`, `EarningsShowcase`), which run in the RSC graph. `react-i18next` evaluates `React.createContext` at import time, and React's `react-server` build doesn't expose it — importing it there crashes the build (`(0, S.createContext) is not a function`). Keep the React binding out of this file.
- **Server Components** call `await getTranslation(lng, ns)` and use the returned `t` (and `i18n.getFixedT(lng, ns)` for a second namespace — see `page.tsx`, which needs both `copy` and `layout`).
- **Client Components** (`NavDrawer`, `StepCard`) call `useTranslation(ns)`. They resolve against the **`TranslationsProvider`**, a `"use client"` wrapper mounted in `layout.tsx` around `{children}`. The server detects the language, builds an instance, and passes `i18n.services.resourceStore.data` to the provider as a serializable prop; the provider re-creates a browser instance seeded with those resources (`initAsync: false` → synchronous, no flash). Server-component children passed through it are unaffected.
- **`StepCard` needs no `t`** — `page.tsx` translates its `title`/`description` server-side and passes them as props, so it is a plain server component with no JS. (The old `FaqItem` followed the same pattern; both it and the FAQ section have been removed.)

## Namespaces

| Namespace | Covers | Consumed by |
|-----------|--------|-------------|
| `copy` (default) | Hero (all variants), store labels, how-it-works steps, examples, final CTA, earnings scroller | `src/app/page.tsx`, `src/components/EarningsShowcase.tsx`, `src/components/StepCard.tsx` |
| `layout` | Metadata, navbar, business CTA + pitch, switcher, footer | `src/app/layout.tsx` (`generateMetadata`), `TopMenu.tsx`, `NavDrawer.tsx`, footer in `page.tsx` |

Rules:
- **`en` and `cs` must stay identical** in file set and key set. Add/rename keys in both in the same change.
- **Every namespace file starts with a `"//"` comment** listing its consumers (a valid, harmless key).
- **The hero has exactly two variants**: `heroDefaultHeading` and `heroBusinessHeading` (takes `{{businessName}}`). The per-entry-point variants (leaflet, instagram_bio, referral) were removed — they were five near-identical headings saying the same thing. `heroSocialProof` is the hero's **subheading** and takes the live `{{count}}`; when the stats fetch fails there is no subheading at all.

### The `as const` key-array pattern (`copy.ts`)

`HOW_IT_WORKS_STEPS`, `EARNINGS_SHARES` and `WHY_REASONS` in `src/lib/constants/copy.ts` hold only non-text data (image file, venue name, icon id) plus **literal key strings** (`kickerKey`, `titleKey`, `descriptionKey`, `reachKey`, `rewardKey`, `bodyKey`) under `as const`. `page.tsx` renders `t(step.titleKey)`. The `as const` keeps those fields as literal types, so the typed `t` accepts them (a plain `string` would not compile). There is no longer a `getHeroCopy(...)` helper — with two hero variants the choice is a ternary inline in `page.tsx`. If you ever reintroduce a copy-selecting helper, type its `t` param as `TFunction<"copy">` (a bare `TFunction` resolves to `defaultNS` and rejects copy keys).

## Locale Detection

`detectLocale()` (`detectLocale.ts`) runs server-side and resolves in order:

1. **`tagly-locale` cookie** (`LOCALE_COOKIE` in `settings.ts`) — set by the switcher; an explicit choice wins.
2. **`Accept-Language`** header, ranked by `q`: `cs-*`/`cs` → `cs`, `sk-*`/`sk` → `cs` (Slovak gets Czech, matching the RN reference), everything else → `en`.

Both `cookies()` and `headers()` are async in Next 16. **No middleware, no `/en` `/cs` URL prefixes** — that would collide with the `/:code` → `/?code=:code` referral rewrite in `next.config.ts`. Because detection reads per-request state, `/` (and `/_not-found`) are dynamically rendered; SSR emits the right language on first paint (no flash).

### Language switcher

The picker lives **inside `src/components/NavDrawer.tsx`** (client), under a `languageSwitcherLabel` heading, as a compact `EN | CS` toggle. On select it writes the `tagly-locale` cookie, calls `i18n.changeLanguage(lng)` (instant for client components) and `router.refresh()` (`next/navigation`, re-renders the server tree), then closes the drawer. It takes the server-detected `current` language as a prop to show the active code in `text-ink` (inactive: `text-text-tertiary`).

There is **no standalone `LanguageSwitcher` component** — it was deleted when the drawer became the single home for secondary nav. The navbar (`TopMenu.tsx`) now carries only the logo, the primary "Get Tagly" CTA, and the drawer button, **at every width**. Nothing collapses at a breakpoint any more, so drawer copy can't silently go missing on desktop the way the business pitch and `talkToSales` CTA once did. (The `languageEnglish`/`languageCzech` full-name strings stay unused — kept for a possible future >2-language dropdown.)

## Type Safety

`i18next.d.ts` augments i18next's `CustomTypeOptions` with `typeof` the English `copy.json` / `layout.json`, so `t("key")` autocompletes and typo-checks at build time across both server and client. Keys are derived from **English only** — en/cs parity is a runtime concern (verify manually). Run `npx tsc --noEmit` after edits.

## Link destinations are NOT localized

Every `href` — social links, `Contact`, footer "How it works"/"FAQ", and the customer/advertiser URLs from `links.ts` / `buildJoinUrls.ts` — points at the **same (US) destinations for both `cs` and `en`**. Only the visible link text is translated. **Future agent:** once the Czech socials build a following, we may want locale-aware link targets (e.g. a Czech Instagram handle). This is a deliberate "bring it up later," not an oversight — raise it with the team before changing.

## Adding a key / namespace

1. Add the key to **both** `locales/en/<ns>.json` and `locales/cs/<ns>.json` (identical key; Czech value in tykání — see the register gotcha for the gender/CTA-mood conventions).
2. For a new namespace: create `en/<ns>.json` + `cs/<ns>.json` (each starting with `"//"`), add it to `namespaces` in `settings.ts`, and add a `typeof` line to `i18next.d.ts`.

## Intentionally NOT extracted

- **Brand / accessibility proper nouns:** the social aria-labels (`Instagram`/`TikTok`/`LinkedIn`) and the `Tagly` logo aria-label stay literal — identical in every language.

## Gotchas

- **The how-it-works artwork is localized too, not just the strings.** The four step images are app screenshots (shared with the customer app's onboarding carousel), so they carry UI copy and live under `public/images/step-by-step/<lang>/`. `page.tsx` picks the folder from the detected `lng`, and `HOW_IT_WORKS_STEPS.hasEnglishArtwork` marks which steps actually exist in English — only step 2 today; the rest fall back to the Czech frame, so an English visitor sees Czech UI inside those images until the shots land. Adding an English step = drop `step-N.webp` into `en/` **and** flip the flag.
- **Server file must stay react-i18next-free.** See the Server vs Client boundary above — re-adding `react-i18next` to `index.ts` breaks the build.
- **Czech typographic quotes break JSON.** Czech uses `„lower"` and `"upper"` marks. The closing `"` (U+201C) looks like an ASCII `"` to a JSON parser and terminates the string early. Escape it: `"...okně\"."`. Validate after editing: `node -e "require('./src/i18n/locales/cs/copy.json')"`.
- **Czech uses the informal register (tykání)** — second-person singular ("Připoj Instagram", "Co tě baví?"), not formal "vy". Matches the RN reference. Two related sub-conventions, all manual invariants (no automated check):
  - **The brand refers to itself in 1st-person plural** ("zaplatíme ti", "ukážeme", "oceníme") — i.e. "my" → "ty". Keep new copy in that voice.
  - **Gender:** prefer phrasings that avoid a gender-marked form. When one is unavoidable, use the slashed both-gender form (`Připraven/a`) rather than masculine-only. Don't mix the two strategies across strings.
  - **The download CTA is a tykání imperative** ("Stáhni si Tagly"), not the impersonal infinitive ("Stáhnout Tagly"). (Page-title metadata is the one place a nominal/infinitive form is acceptable.)
- **`initAsync: false`** (i18next v26's rename of `initImmediate`) on the client provider keeps init synchronous so client translations are ready on first render.
- **`headers()` / `cookies()` are async** in Next 16 — always `await` them.
- **Keep the `resourcesToBackend` dynamic-import template literal** (`` import(`./locales/${language}/${namespace}.json`) ``) in its exact shape so the bundler can code-split each locale file.
