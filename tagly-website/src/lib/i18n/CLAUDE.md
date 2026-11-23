# i18n (internationalization)

This site is localized with **i18next + react-i18next**. It currently ships
**English (`en`, default)** and **Czech (`cs`)**. This document explains how the
setup works and the process for localizing a page.

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../../../../CLAUDE.md).

## Why locale-prefixed routes

Languages map to distinct URLs via a `[lng]` route segment: `/en/...` and
`/cs/...`. Every rendered route lives under `src/app/[lng]/`. This gives each
language its own crawlable URL with `hreflang` alternates, which is the
SEO-correct approach (SEO is this project's top priority).

Structural notes:
- `<html lang>` is set from the `[lng]` param in `src/app/[lng]/layout.tsx`,
  which also defines `generateStaticParams` so both locales prerender as static
  HTML.
- There is **no** `src/app/layout.tsx`. The `[lng]` layout owns `<html>`/`<body>`.
  Because of that, the 404 page is the global `src/app/not-found.tsx`, which
  renders its own `<html>`/`<body>`. See "404 handling" below.
- `src/middleware.ts` detects the locale (cookie → `Accept-Language` →
  `defaultLng`) and redirects locale-less paths (e.g. `/restaurants` →
  `/cs/restaurants`). A locale already in the URL always wins over the cookie.

### Two different "defaults" — don't merge them

`settings.ts` deliberately exports both, and they hold different values:

| | value | decides |
|---|---|---|
| `defaultLng` | `cs` | which language a visitor is **shown** when we can't tell what they want (Prague is the home market, and crawlers send no `Accept-Language`) |
| `translationFallbackLng` | `en` | which language **patches a missing key** — EN is the source language, so a gap in CS shows English, never the reverse |

Collapsing them into one constant reintroduces two bugs: Czech text leaking onto
English pages, and the deliberately-English global 404 announcing `lang="cs"`.
`not-found.tsx` therefore hardcodes `lang="en"` and must not follow `defaultLng`.

**Gotcha in the middleware:** `accept-language`'s `.get()` returns the **first
language it was configured with** when nothing matches — it never returns null.
So `acceptLanguage.languages()` is given `defaultLng` first; passing the plain
EN-first `languages` array silently sends every unmatched visitor to English.
`x-default` in `buildAlternates` must keep pointing at `defaultLng` too, or the
site tells crawlers one thing and does another.
- `src/app/sitemap.ts` emits every path for both locales with `hreflang`
  alternates. `robots.ts` and `/api/*` are language-agnostic and stay at the
  `src/app/` root.

## Where the JSON lives: next to what uses it

One **namespace per page and its components**. Shared layout pieces
(`navbar`, `footer`) and shared strings (`common`) get their own namespaces.

**Translation files are colocated with their page or component** (the same rule
the RN apps follow — see `tagly-shared/client/CLAUDE.md`). There is **no central
`locales/` catalog**; it was removed 2026-08-08.

```
src/app/[lng]/pricing/pricing.{en,cs}.json          ← next to pricing/page.tsx
src/app/[lng]/home.{en,cs}.json                     ← next to the homepage
src/components/layout/navbar.{en,cs}.json           ← next to Navbar.tsx
src/components/sections/legal.{en,cs}.json          ← rendered via LegalDocPage
src/lib/i18n/common.{en,cs}.json                    ← genuinely cross-page
```

The **filename stem equals the namespace id** (`pricing.en.json` ⇢
`getTranslation(lng, "pricing")`), so a namespace and its files are one grep.

Two namespaces stay here in `src/lib/i18n/` because they have no single owning
page or component: `common` (used everywhere) and `comparison` (shared by the
three `*-vs-tagly` pages, which have no shared parent route folder).

### The registry — `resources.ts`

Colocated files can't be globbed by one dynamic path, so `resources.ts` maps
every namespace to a **lazy loader per language**:

```ts
pricing: {
  en: () => import("@/app/[lng]/pricing/pricing.en.json"),
  cs: () => import("@/app/[lng]/pricing/pricing.cs.json"),
},
```

Both `index.ts` (server) and `client.ts` (browser) resolve namespaces through
its `loadNamespace(language, namespace)`, so the two instances can never drift.

**Each value must stay a function returning `import(...)`.** The thunk is what
lets the bundler put each namespace in its own chunk so a page downloads only
what it renders; rewriting these as eager top-level imports would pull all 58
JSON files into the client bundle. `loadNamespace` rejects with a named error on
an unregistered namespace rather than resolving empty, because an empty resource
renders raw keys ("hero.title") to users.

### Adding a namespace

1. Create `<namespace>.en.json` + `<namespace>.cs.json` next to the page or
   component that uses them (with the `"//"` comment first — see below).
2. Add one entry to `resources.ts`.

That's it — no folder convention to satisfy, no index to regenerate.

### Every namespace JSON starts with a `"//"` comment

Standard JSON has no comments, so the first key of every namespace file is `"//"`
describing where the namespace is used. It is never referenced in code:

```json
{
  "//": "Used in: src/components/layout/Navbar.tsx — main nav, dropdowns, CTAs.",
  "links": { "howItWorks": "How It Works" }
}
```

Use **stable identifier keys** (e.g. `forBusinesses.faq`), never the English
text as the key.

## The three core modules

- `settings.ts` — `languages`, `defaultLng`, `translationFallbackLng`, `defaultNS` (`common`),
  `cookieName`, and `getOptions()`. Single source of truth.
- `index.ts` — **server**. `getTranslation(lng, ns)` creates a per-request
  i18next instance and returns `{ t, i18n }`.
- `client.ts` — **client**. A `useTranslation(lng, ns)` hook backed by a single
  browser instance that keeps its language in sync with the route.
- `metadata.ts` — `buildAlternates(lng, path)` (canonical + hreflang) and
  `ogLocale(lng)`.

## Localizing a page (extract → translate → wire)

1. **Extract**: move the page/component's hardcoded English strings into
   `<ns>.en.json` **next to that page/component** (with the `"//"` comment
   first).
2. **Translate**: create `<ns>.cs.json` beside it with the same key shape and
   Czech values. Preserve interpolation vars (`{{year}}`) and `<Trans>`
   placeholders. Follow the root CLAUDE.md tone rules (clear, direct; avoid
   overusing em dashes).
3. **Register**: add the namespace to `resources.ts`.
4. **Wire**: replace the JSX strings with `t("key")`.

### Server vs client usage

| Context | Get `lng` | Translate |
|---|---|---|
| Server component / page | `await params` (or a prop) | `const { t } = await getTranslation(lng, ["<ns>", "common"]);` |
| Client component (`"use client"`) | `useParams().lng` | `const { t } = useTranslation(lng, ["<ns>", "common"]);` from `client.ts` |

- Cross-namespace keys use `t("common:getInTouch")`.
- Arrays/objects: `t("how.steps", { returnObjects: true }) as Array<...>`.
- Keep one `<h1>` per page and the existing heading hierarchy. Only text moves
  to JSON — never markup or token classes.

### Metadata

Replace `export const metadata` with `generateMetadata({ params })`:

```ts
const { lng } = await params;
const { t } = await getTranslation(lng, "<ns>");
return {
  title: t("meta.title"),
  description: t("meta.description"),
  alternates: buildAlternates(lng, "/<path>"), // "" for the homepage
  openGraph: { title: t("meta.title"), description: t("meta.description") },
};
```

## Internal links

Write bare paths everywhere: `href="/pricing"`. The locale prefix is added
automatically by `LocalizedLink` (`src/components/ui/LocalizedLink.tsx`), which
`Button` and `PressableText` delegate to. External (`http`) and `mailto:` links
are left untouched. Only direct `next/link` usages (e.g. logos) need a manual
`/${lng}` prefix.

### Inline links inside a sentence

Use react-i18next `<Trans>`. In server components import it from
`react-i18next/TransWithoutContext` and pass `t` explicitly:

```tsx
<Trans
  t={t}
  i18nKey="faq.costInline"
  components={{ link: <PressableText href="/pricing" /> }}
/>
```

with JSON like: `"costInline": "... See <link>how pricing works</link>."`
The plain `answer` string (no markup) stays in the JSON too, because
`FaqSection` builds FAQ JSON-LD from it.

## 404 handling

There is a single global 404 at `src/app/not-found.tsx` (English, self-contained
`<html>`/`<body>`, returns HTTP 404). It handles both unmatched URLs and any
`notFound()` calls.

A per-locale `[lng]/not-found.tsx` does **not** work in this setup: because
there is no root `app/layout.tsx`, `notFound()` always renders the global
boundary rather than a nested not-found inside `[lng]/layout`. This matches the
official Next.js App Router i18n example (no root layout, global 404). Rendering
a localized 404 from a catch-all page would mean a soft-200, which is worse for
SEO than the correct 404 status the global page returns — so the global page is
the deliberate choice. (Do not add `cookies()`/`headers()` to any file in the
`[lng]` tree: it would opt the whole segment into dynamic rendering and lose
static prerendering.)

## Adding a new language

1. Add the code to `languages` in `settings.ts`.
2. Add a `<ns>.<lng>.json` beside every existing namespace file, and a matching
   loader line in each `resources.ts` entry.
3. Everything else scales automatically: `generateStaticParams`, the middleware
   detector, the sitemap hreflang, and the `LanguageSwitcher`.

A namespace missing the new language throws a named error from `loadNamespace`
the first time a page requests it, so a half-added language fails loudly instead
of rendering raw keys.
