# CLAUDE.md

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../CLAUDE.md).

## What this site is — read before touching anything

`tagly-website` is the **public marketing site for Tagly** (`taglyapp.com`). Four
facts decide almost every judgement call here:

### 1. It sells to businesses. Only businesses.

The reader is a **local business owner** (restaurant, cafe, gym, salon, bar)
deciding whether Tagly is worth their budget. Every page is written for them.

**Customers (the people who post) are NOT acquired here — they are served by
[`tagly-join/`](../tagly-join/CLAUDE.md)** (`join.tagly.cz`), the standalone
referral/join landing page. That is the customer-facing product surface: it
carries the referral code, the app pitch, and the store handoff.

This site still has a few customer-facing pages (`/for-customers/how-it-works`,
`/for-customers/faq`, `/referrals`). They exist **for search traffic and trust**,
because customers google those questions and the answers have to live on an
indexable domain. They are not an acquisition funnel:

- their only CTA is the app-store / OneLink download link (or the join page) —
  never a form, signup, or flow implemented here
- they never grow into a second product narrative; keep them factual and short
- when a decision trades off business clarity against customer-page polish,
  business clarity wins every time

Never restructure the site so the two audiences share top-level billing. The nav,
the homepage, and the IA are business-first by design.

### 2. The landing page is the product. Everything else is SEO.

`/` (`src/app/[lng]/page.tsx`) is the real pitch — it is where the product is
explained and where conversions happen. It gets the most attention, the best
copy, and the most careful design.

Every other page (industry pages, comparison pages, FAQ, pricing, about, …)
exists to **rank for a distinct search intent and funnel the visitor back to the
landing page or to a sales CTA**. That means for those pages:

- one focused intent per page, real differentiated content, no near-duplicates
- internal links back to `/` and to the sales CTA are mandatory, not optional
- they are content surfaces, not places to invent new layout systems — reuse the
  existing section components
- adding a page is only worth it if it targets a search intent no existing page
  covers

Never let a secondary page drift into being a second homepage.

### 3. It ships two languages: English and Czech.

Both are first-class, live under `/en/...` and `/cs/...`, and both are prerendered
static. **Czech is the default** (`defaultLng` in `src/lib/i18n/settings.ts`):
the device's `Accept-Language` still decides for anyone whose browser says
English or Czech, but a visitor we can't place — including crawlers, which send
no `Accept-Language` — gets Czech, matching the Prague home market. Note this is
NOT the same setting as `translationFallbackLng` (EN), which only patches missing
keys; see `src/lib/i18n/CLAUDE.md`. **Any copy change must land in both locales in the same pass** — an EN
string added without its CS twin is a bug. Strings live in `<ns>.{en,cs}.json`
**colocated with the page or component that uses them**, registered in
`src/lib/i18n/resources.ts`; nothing user-visible is hardcoded in
JSX. The full setup (namespace rule, server vs client usage, metadata,
`LocalizedLink`, 404 handling) is in
[`src/lib/i18n/CLAUDE.md`](src/lib/i18n/CLAUDE.md) — read it before localizing.

**Czech on this site is written in VYKÁNÍ** (formal "vy" — Matej's call
2026-08-08: the whole site addresses business owners, matching the sales
one-pager and every SEO page; the landing page was converted the same day).
The brand still refers to itself in 1st-person plural. Note this deliberately
differs from the apps and the join page, which speak tykání — copy ported
from an app (e.g. the RewardInfoSheet pricing factors) must be converted to
vykání on the way in. Matej authors/reviews CS by hand; keep CS line-for-line
with EN in structure and key shape.

Three CS grammar/wording rules (Matej, 2026-08-08):

- **"Tagly" is grammatically NEUTER** ("to Tagly"): "Tagly fungovalo",
  "Tagly je stavěné", "aby pomáhalo", "Tagly uložilo" — never masculine
  ("fungoval", "stavěný", "pomáhal"). Predicate nouns keep their own gender
  ("Tagly je malý tým", "nezávislá platforma" are fine).
- **"story" is grammatically NEUTER too** ("to story"): "každé další story",
  "jedno story", "story bylo proplacené", "story, které jste zveřejnili",
  "odešlete ho", "jeho hodnota" — never feminine ("každá story", "kterou",
  "proplacená", "její"). Plural is neuter as well: "všechna story, která
  ještě nebyla vyplacená", "jaká story budou sdílet". Matches the apps and
  the legal docs, which were already neuter.
- **Never use "pokecáme"** — too colloquial. Use "popovídáme si" or similar.

### 4. The home market is Prague, Czech Republic.

Tagly's home market **was** Tampa, Florida. It is now **Prague**. Anywhere the
site names a city, a market, a neighbourhood, a currency, or an example business,
it is Prague and Czechia — never Tampa, never Florida, never "the US".

Rules:

- **Never write Tampa, Florida, or the US as Tagly's market, city, or home
  base.** If you find such a string, it is stale copy: replace it with Prague /
  Czechia (in both locales).
- Examples, sample business names, sample neighbourhoods, and screenshots should
  read as Prague, not as an American city.
- Money in examples is **CZK (Kč)**, not dollars. Czech pricing copy must not be
  a currency-converted echo of a dollar figure that no longer applies.
- **The one legitimate US reference:** the legal entity is *Flaer, Inc.*,
  incorporated in Delaware, USA. That is a fact of company registration and stays
  exactly as-is on `/about` (the company-information block moved there from
  `/contact` 2026-08-09) and in legal documents. It is not a statement about
  the market — do not "fix" it to Prague.
- English is still a real locale (expats, international chains, and search reach
  in Prague), so EN copy is not "the US version". It is the English-language view
  of the same Prague market.

> Known stale copy still saying otherwise, to be corrected when those pages are
> next touched: the dollar figures throughout `pricing.{en,cs}.json` and
> `faq.{en,cs}.json` (both unpublished). (The Organization JSON-LD and the
> social profiles in `src/lib/social.ts` were fixed 2026-08-13 — one tagly
> handle set for both locales. The sitemap/robots/metadataBase base URL moved to
> `src/lib/site.ts` → `https://www.taglyapp.com`, 2026-08-09; the about page's
> Tampa strings went away with the 2026-08-09 rewrite; the home marquee's
> "v USA a Česku" heading went away with the partners marquee, 2026-08-08.)

---

## Standalone project — install & run

Like `tagly-join/`, this is **NOT** part of the monorepo's yarn workspaces. It
has its own `node_modules/` and `yarn.lock` (yarn classic, same as root). Root
`yarn install` / `yarn clean:install` do not touch it:

```bash
cd tagly-website
yarn install   # run separately from root installs
yarn dev       # development server
yarn build     # production build (reads ../tagly-legal at build time)
```

Always yarn, never npm (the original repo's `package-lock.json` was retired
2026-08-08).

**Deployment:** AWS Amplify app `d3p9jakxhc1wfc`, still connected to the old
`Flaer-Inc/marketing-site` repo until the repointing to this monorepo (the full
repoint checklist lives in `docs/DEVOPS.md`). There is
**no `amplify.yml` in this folder** — the build spec lives as the `tagly-website`
entry in the monorepo's root [`../amplify.yml`](../amplify.yml), alongside
`tagly-join` and `tagly-redirect` (moved 2026-08-08). Two consequences:

- Build-spec changes go in the root file, never in the Amplify console — the
  deploy workflows re-sync the console buildSpec from the repo file and assert
  `AMPLIFY_MONOREPO_APP_ROOT`, so console edits get overwritten (E004 in the root
  CLAUDE.md).
- At repointing time the app needs `AMPLIFY_MONOREPO_APP_ROOT=tagly-website` set,
  or it will build the wrong folder.

**Multi-env (2026-08-09):** one app, two branches — `main` → production
(`www.taglyapp.com`), `staging` → the staging host on `tagly.dev` (non-prod
never lives on the brand domain). Deploys are triggered by
`.github/workflows/{staging,production}-deploy-amplify.yml`: staging deploys
automatically on a push to `staging` touching `tagly-website/**` **or
`tagly-legal/**`** (the legal pages read `../tagly-legal` at build, so a
legal-only commit rebuilds the site — this replaces the old legal-sync
workflows' trigger role), production via the release workflow / manual
dispatch. Both website jobs skip while the `AMPLIFY_APP_ID_WEBSITE` repo
variable is unset (pre-repoint state).

**`APP_ENV` is required at build** (`development` | `staging` | `production`,
validated in `next.config.ts`, set locally in `tagly-website/.env` and
per-branch on Amplify). Any non-production value makes the deploy completely
unfindable by search engines: `X-Robots-Tag: noindex, nofollow, noarchive` on
every response, robots.txt disallow-all, an empty sitemap, and a `noindex`
robots meta (`src/lib/site.ts` is the single switch). Never point the staging
branch at `APP_ENV=production`.

The build injects two env values into `.env.production` for the SSR runtime:
`RESEND_API_KEY` (SSM SecureString, never a plaintext Amplify env var) and the
optional non-secret `API_BASE_URL` (public stats counters). See `docs/DEVOPS.md`.

---

## Writing style

Do not overuse em dashes (—) in copy. They feel unnatural and AI-generated when used frequently. Prefer periods, commas, parentheses, or just restructuring the sentence. Em dashes are fine sparingly (e.g. in page title separators) but should not appear repeatedly in body text.

---

## Page tracking

`tracking.md` in the project root tracks the status of every page across three dimensions: Content, SEO, and Design. When you finish work on a page, update `tracking.md` to reflect the current state. Always consult it before starting work on a page to understand what still needs to be done.

---

## Legal pages source of truth

The legal documents (`/privacy-policy`, `/terms-of-service`,
`/terms-of-monetization`) are NOT authored in this folder. The canonical
markdown lives in the monorepo's [`../tagly-legal/`](../tagly-legal/CLAUDE.md)
(one folder per document, `en.md` + `cs.md`), and `src/lib/legal-docs.ts` reads
those files directly during the static build. Rules:

- Never create a site-local copy of a legal document (the old `new-legal-docs/`
  folder is gone for this reason). To change legal text, edit `../tagly-legal/`
  and follow its CLAUDE.md (naming registry, CS glossary, lockstep EN/CS rules).
- The legal pages are statically generated (`generateStaticParams` in
  `src/app/[lng]/layout.tsx`), so the cross-folder read happens on the build
  machine where the whole monorepo is checked out. Don't convert these pages to
  runtime rendering — the deployed server bundle does not contain
  `../tagly-legal/`.
- Amplify gotcha: monorepo build-skipping only watches this app's root, so a
  commit touching only `tagly-legal/` may not trigger a site rebuild. See the
  publishing flow in `../tagly-legal/CLAUDE.md`.
- Never remove or rename the served legal URLs — they are baked into shipped
  app builds, store listings, and the Meta developer console.

---

## Project goal

This repository contains the marketing website for **Tagly**.

The site exists to attract **businesses** in Prague (especially restaurants,
cafes, gyms, salons, and other local businesses). Customer acquisition belongs to
`tagly-join/` and the apps; the handful of customer-facing pages here are search
surface only (see "What this site is" above).

This is **not** just a design project. It is a business-critical website that must:

- explain the product clearly
- rank well in search engines
- be easy for AI systems and crawlers to understand
- convert business visitors into demo requests or sales conversations
- be maintainable by humans long-term

The default assumption for all implementation decisions should be:
**clarity, crawlability, maintainability, and conversion are more important than visual cleverness.**

---

## Core priorities

When generating or editing code for this project, optimize for these priorities in this order:

1. **Clear business communication**
2. **Strong SEO foundations**
3. **Fast performance**
4. **Clean, industry-standard code**
5. **Simple maintenance and future editing**
6. **Visual polish**

Do not sacrifice structure, semantics, or content clarity for flashy animations or unusual patterns.

---

## Product and positioning context

Tagly helps local businesses get promoted by their real customers posting on Instagram.

The site speaks to **business owners**, not influencers and not customers.
The homepage and main structure are **business-first**.

Important positioning points:

- ordinary customers can participate, not just influencers
- businesses pay for relevant value, not empty reach
- Tagly is especially relevant for local businesses in **Prague** — reach that is
  actually local is the whole point, so the local market is named, not implied
- authenticity and local relevance matter more than generic ad impressions
- the site should feel trustworthy, simple, and easy to understand

Avoid language that makes Tagly sound like it is only for influencers or content creators.

---

### Semantic HTML requirements

Reusable components must still produce clean semantic HTML.

Important rules:

- each page should have one clear H1
- headings must follow a logical H2/H3 hierarchy
- links should be real links
- buttons should be real buttons
- important textual content should be present in the rendered HTML
- semantic structure must not be sacrificed for styling convenience

## Information architecture

Every route lives under `src/app/[lng]/`, so each path below exists twice:
`/en/<path>` and `/cs/<path>`. Write internal links as bare paths (`/pricing`) —
`LocalizedLink` adds the prefix.

### The landing page (the one that matters)

- `/` — the business pitch and the main conversion surface. Everything below
  funnels here.

Structure worth knowing before editing it (reworked 2026-08-08):

- **Section anchors are English in both locales** (`#how-it-works`,
  `#why-tagly`, `#examples`, `#pricing`, `#contact`) — they are part of the
  URL. The Navbar's section links and the ids in `page.tsx` must stay in sync.
- **The contact form is embedded at the bottom of the page** (`#contact`,
  `ContactForm` with the colocated `contact-form` namespace), and every CTA on
  the page is a scroll-to-form `ScrollLinkButton` — the landing never
  navigates away to convert. The old `/contact-sales` page was REMOVED
  (2026-08-08): every other page's sales CTA links to `/#contact`, and
  `next.config.ts` 301s `/contact-sales` (bare + locale-prefixed) to the
  anchor. Same treatment for the removed `/partners` page (301 to `/`; the
  partners content and marquee were deleted outright).
- **Live social-proof chips** in the hero come from `GET /v2/public/stats`
  via `src/lib/fetchPublicStats.ts` (optional `API_BASE_URL` env, 5-min Next
  data cache, never throws — chips simply don't render on failure/absence).
  **The landing page is `dynamic = "force-dynamic"` because of this count.**
  Left prerendered, the fetch's `revalidate: 300` turns the page into an ISR
  entry that Amplify was not regenerating: on 2026-08-30 the API said 5,248,
  join (rendered per request) showed 5,248, and this page served a frozen
  3,769 — ~1,500 signups behind, unchanged across repeated requests. Rendering
  per request, as tagly-join does by construction (it awaits
  `searchParams`/`headers()`), caps staleness at the 5-min data cache. Don't
  "optimize" the homepage back to static while the live count is in the hero.
  `API_BASE_URL` is inlined at build time via `next.config.ts` `env` (same
  reason as tagly-join: Amplify SSR compute doesn't reliably expose runtime
  env vars), but stays OPTIONAL here — a missing var must never fail the
  build, it only drops the number for a skeleton pill.
- **The trusted-by strip under the hero is hand-curated, never fetched**
  (Matej's call 2026-08-09): who appears is an editorial decision
  (permission given, still a happy customer, recognizable), so the names
  live in `TRUSTED_BUSINESSES` in `page.tsx` — styled wordmarks by design
  (several venues have no logo; uniform type beats a mixed logo wall).
  Don't wire it to the backend and don't collect logo files for it.
- **The hero is a two-column row on desktop** (1200px+): copy + CTA left,
  the explainer video right, with the trusted-by strip under the row —
  all stretched to fill the first viewport (`--spacing-hero-min-height`)
  with a `ScrollCue` chevron pinned at the fold (nothing peeks above it
  anymore). Phones/tablets stack the same blocks centred.
- **The explainer video autoplays muted on BOTH locales**
  (`src/components/ui/ExplainerVideo.tsx`). Its voiceover and burned-in
  subtitles are Czech — showing that on /en is an accepted decision
  (Matej, 2026-08-14, replacing the earlier EN "Speak Czech?" reveal
  toggle). The served file is the compressed web encode
  (`public/videos/explainer.mp4`, H.264 1080p30, ~8 MB + poster jpg) — never
  commit a raw export into `public/`.
- **Copy mirrored from other surfaces must stay in sync with its source**: the
  "What decides the price" section mirrors the apps' `RewardInfoSheet`
  (advertiser voice, `tagly-shared/client/components/feedback/RewardInfoSheet`),
  the how-it-works artwork comes from the apps' onboarding carousels
  (`public/images/how-it-works/`), and the share examples reuse three of the
  join page's real shares (`public/images/examples/`; the card leads with
  reach, with the price the business paid — reward / 0.6, CZK in both
  locales — and what the posting customer spent at the venue as secondary
  lines; on phones each share is a stacked row card like the how-it-works
  steps — story left, stats right on a frosted-blur column — from md up the
  three-column overlay-panel grid).
- `src/components/sections/IconRowsCard.tsx` is the shared icon-row card used
  by "Why Tagly works" (butter) and "What decides the price" (blue).

### Business-facing pages (SEO surface, primary audience)

- `/how-it-works` — long-form explanation for businesses
- `/pricing` — explain pricing logic clearly
- `/faq` — business FAQ
- `/demo` — product walkthrough

(Removed 2026-08-08, both with 301s in `next.config.ts`: `/contact-sales` →
`/#contact` — the form now lives on the landing page — and `/partners` → `/`.)

### Industry landing pages

- `/restaurants`
- `/cafes`
- `/gyms`
- `/salons`
- `/local-businesses` — general local business page

### Comparison pages

- `/instagram-ads-vs-tagly`
- `/influencer-marketing-vs-tagly`
- `/marketing-agencies-vs-tagly`

### Customer-facing pages (search surface only — acquisition lives in `tagly-join/`)

- `/for-customers/how-it-works`
- `/for-customers/faq`
- `/referrals`

These answer what a customer googles and then hand off: the CTA is the app
store / OneLink download (or the join page). Do not build signup, onboarding, or
referral-code handling here — that is `tagly-join/`'s job. Keep the set small;
new customer-facing pages need a real search-intent justification.

### Company pages

- `/about` — deliberately short (2026-08-09): mirrors the apps' AboutSheet copy
  (converted to vykání) + the team grid + CTA. The old long-form
  story/mission/beliefs copy is parked in `src/_unpublished/removed-copy/`.
- `/contact` — the single contact AND support page (the standalone `/support`
  was merged into it 2026-08-09; `/support` 301s here, bare + locale-prefixed,
  in `next.config.ts`). Never remove that redirect — external support links
  (App Store / Meta developer console) point at the support URL.
- `/careers` (unpublished)

### Legal pages

- `/privacy-policy`
- `/terms-of-service`
- `/terms-of-monetization`
- `/instagram-data-deletion`

### API routes

- `/api/contact` — sales contact form submission (the landing `#contact` form)
- `/api/support` — the `/contact` page's dynamic form. The submitted `category`
  (support / feedback / other) picks the delivery inbox server-side via
  `src/lib/contact-inboxes.ts` (support@ / feedback@ / hello@taglyapp.com) —
  the client never supplies a target address. The path is historical (the form
  was support-only).

### Future pages

- `/resources`
- `/blog`
- `/guides`

All page implementations should reinforce this structure and avoid muddling the audience split.

Every one of these paths must be emitted for **both** locales in
`src/app/sitemap.ts` with `hreflang` alternates. Adding a route means adding it
there in the same pass.

---

## SEO requirements

This project must be built with **strong technical and on-page SEO** from the start.

### General SEO principles

- Every indexable page must have a clear purpose.
- Every page must target a distinct search intent.
- Avoid thin, duplicate, or near-duplicate content.
- Use descriptive, human-readable URLs.
- Use clean internal linking between related pages.
- Use semantic HTML that makes page structure obvious.
- Content must be easy for search engines and AI systems to parse.
- Pages should explain concepts directly and explicitly.
- Do not hide important text inside accordions, tabs, carousels, or client-only widgets unless there is a strong reason.

### Bilingual + local SEO

Since the landing page is the conversion surface and everything else is search
surface, the SEO shape of the site matters as much as its copy:

- **Both locales are indexable.** Every page needs a canonical plus `hreflang`
  alternates for `en` and `cs` — always via `buildAlternates(lng, path)` from
  `src/lib/i18n/metadata.ts`. Never hand-write `alternates`.
- CS is not a translation afterthought: for a Prague-market business, the Czech
  page is usually the one that ranks. Czech keywords are chosen for how Czech
  owners actually search, not by translating the English keyword.
- **Local intent is Prague.** Industry pages target "<industry> marketing in
  Prague"-shaped intent. Never target US cities or US-market phrasing.
- Non-substitutable content across locales (a page that exists in only one
  language) is a bug — both locales prerender from `generateStaticParams`.

### Metadata

For each page, implement:

- unique `<title>`
- unique meta description
- canonical URL
- Open Graph metadata
- Twitter metadata where relevant
- clean social sharing image handling where practical

Use Next.js metadata APIs in a standard, maintainable way.

### Structured content

Pages should use:

- exactly one meaningful H1
- clear H2/H3 hierarchy
- descriptive section headings
- short, direct paragraphs
- visible explanatory copy, not just slogans

### Structured data

Where appropriate, support structured data such as:

- Organization
- WebSite
- FAQPage
- BreadcrumbList

Only add structured data when it truthfully reflects the page.
Do not add spammy or misleading schema.

### Technical SEO basics

Ensure support for:

- `robots.txt`
- XML sitemap
- canonical management
- indexability controls for non-public pages if needed
- proper status codes
- clean redirects when routes change
- no broken internal links

### Performance and crawlability

The site should be easy to crawl and render.
Prefer server-rendered or statically generated content for marketing pages whenever practical.
Do not depend on client-side rendering for core page meaning.
Do not build pages that require JavaScript to reveal essential business information.

---

## AI discoverability guidance

This site should not rely on gimmicky “AI SEO.”
The correct approach is to make the website:

- factually clear
- well-structured
- easy to quote
- easy to crawl
- easy to understand by both humans and machines

That means:

- strong explanatory copy
- explicit answers to common questions
- pages with focused intent
- trustworthy company and legal pages
- clean headings and semantic markup
- sensible metadata and internal links

Avoid vague marketing language when a direct explanation would be better.

Bad example:

- “Reinventing authentic local growth.”

Better example:

- “Tagly helps restaurants and local businesses get promoted by real customers posting on Instagram.”

Favor explicitness over cleverness.

---

## Code quality standards

All code must be:

- easy to read
- easy to maintain
- conventional for a modern Next.js codebase
- understandable by another engineer without extra explanation

### General rules

- Prefer simple, standard solutions over clever or abstract ones.
- Avoid over-engineering.
- Avoid premature abstractions.
- Avoid unnecessary custom frameworks or patterns.
- Keep components focused and composable.
- Use clear naming.
- Keep file structure intuitive.
- Avoid large monolithic components.
- Avoid deeply nested conditional rendering when simpler composition would work.
- Do not introduce complexity unless there is a clear long-term benefit.

### React / Next.js expectations

- Use standard Next.js App Router patterns unless there is a strong reason not to.
- Prefer server components by default for content-heavy pages.
- Use client components only where interactivity is required.
- Keep metadata, layout, and route structure idiomatic to Next.js.
- Keep page content easy to edit.
- Prefer static or server-rendered marketing pages.

### Styling expectations

- Use a clean and maintainable styling approach consistently.
- Prioritize readability and consistency.
- Do not let styling decisions make semantic structure worse.
- Avoid excessive animation, especially above the fold.
- Avoid layout tricks that make content harder to parse.

### Design token rules

All spacing, colors, and typography must come from the project's design tokens defined in `src/app/globals.css`. Do not use arbitrary values.

**Spacing:**
- Never use raw numeric spacing values (e.g. `p-4`, `mt-6`, `gap-8`). Always use the spacing tokens defined as CSS custom properties in `src/app/globals.css` (e.g. `--spacing-section-gap`, `--spacing-block-gap`, `--spacing-element-gap`).
- Spacing tokens are responsive: mobile values are the default, desktop values kick in at the `1200px` breakpoint.
- Prefer `margin` and `padding` over `gap`. Only use `gap` when margin/padding genuinely does not make sense (e.g. a flex container where children have no natural margin context).

**Colors:**
- Never use colors outside of the tokens defined in `src/app/globals.css`. All color values in Tailwind classes must reference the project's color tokens.
- Surfaces: `bg-background` is the cream page background (`#FFFCF2`), `bg-surface` is white for cards and input fills.
- Text: `text-text` / `text-ink` is the burgundy ink used for all primary copy. Secondary copy uses `text-text-secondary`, and meta or decorative text uses `text-text-tertiary`. **Never use grey text** — it looks dead on cream. Do not put `text-text-tertiary` on body copy; its contrast is only sufficient for captions, separators, and other non-essential text.
- Accents: `brand` is butter yellow and `accent` is soft blue. Both are small accents only. Never use them as large fills, and never place them next to each other. On a butter fill use `text-on-brand`; on a blue fill use `text-on-accent`; on an ink fill use `text-on-ink`.
- Status: `success` (green) is for money and success states only. `danger` (red) is for errors only. Never decorative.
- Hairlines: `border-divider` for dividers and row separators, `border-border-strong` for input edges and table header rules.

**Elevation, not borders:**
- Cards are separated from the page by a warm shadow, never by a border. Use the `card` utility class (`src/app/globals.css`), which sets `radius-lg` + `bg-surface` + `shadow-card` in one place. Add companion classes (padding, `overflow-hidden`, aspect ratios) alongside it.
- Available shadows: `shadow-chip` (small tiles, avatars), `shadow-card` (resting cards), `shadow-float` (hover lift, overlays), `shadow-bar` (sticky navbar), `shadow-pinned` (pinned bottom bar). All are burgundy-tinted. **Never use a black shadow or a black overlay.**
- Cards inside an ink band get `bg-surface` with no shadow — the contrast against the ink already separates them.

**Radius:** `rounded-sm` (4px) for buttons, `rounded-lg` (8px) for structure and cards, `rounded-max` for pills.

**Typography:**
- Never use font families, sizes, or weights outside of what is defined in `src/app/globals.css`. All text styling must use the `.text-style-*` CSS classes (`h1`, `h2`, `h3`, `h4`, `lead`, `body`, `body-bold`, `small-body`, `small-body-bold`, `micro` for sub-caption metadata, `amount` for money figures — always paired with `text-success`, never serif). One companion modifier exists: `.text-style-h1-fit` (applied WITH `text-style-h1`, hero title only) renders the title's `\n`-split copy as exactly two lines at any width, fluidly shrinking via `cqw` — its container must be a size container (`@container`), and its `11.8` divisor is derived from the widest title line (re-derive on copy changes).
- Headings h1–h3 are Playfair (serif), set through `--font-heading`. Playfair is never used below 18px or below weight 600, and bigger means bolder. `text-style-h4` is deliberately Stack Sans, because at 16–18px it sits below Playfair's floor. Never put Playfair in a button label.
- Body text is Stack Sans (`--font-body`) at weight 400 or 500 only. Emphasis comes from size and color, not from a heavier weight.
- `text-style-lead` is for hero and section subtitles, one step above body.
- Both fonts are self-hosted via `next/font/local` from `src/fonts/`. Do not add a Google Fonts import.
- Typography classes are responsive: mobile font sizes are the default, desktop sizes kick in at the `1200px` breakpoint.

### Accessibility

Treat accessibility as a standard requirement, not an optional enhancement.
At minimum:

- use semantic HTML
- ensure heading hierarchy is correct
- use buttons for actions and links for navigation
- include alt text where needed
- ensure keyboard accessibility for interactive elements
- avoid low-contrast text

Accessibility improvements generally help SEO and maintainability too.

---

## Content implementation guidance

This is a content-heavy marketing site. Code should support that reality.

### Content style principles

- clear over clever
- specific over generic
- direct over vague
- useful over flashy
- structured over artistic chaos

### Avoid

- placeholder marketing fluff
- repeated sections saying the same thing
- duplicate content across pages
- overuse of buzzwords
- unexplained claims
- generic headlines with no context

### Prefer

- explicit descriptions of what Tagly does
- clear audience targeting on each page
- examples and plain-English explanations
- FAQ sections where useful
- comparisons that are balanced and honest

Industry pages like `/restaurants`, `/cafes`, and `/gyms` must not be copy-paste clones with a few nouns swapped. Each should contain real differences in messaging and use cases.

Comparison pages like `/instagram-ads-vs-tagly` must be balanced and useful, not deceptive. If another approach is better in some situations, say so.

---

## Conversion and analytics guidance

**Analytics is PostHog, and only PostHog** (`src/lib/analytics/PostHogTracker.tsx`).
Google Tag Manager, GA4, and Microsoft Clarity were removed 2026-08-08 so the
whole product runs on one stack. Rules:

- **One shared project for everything** — the same PostHog project as the apps,
  backend, and join page. Separate by the `app` super-property
  (`app: "tagly-website"`) and `app_env`. Never create a second project, never
  prefix event names per surface. See `docs/DEVOPS.md`.
- **Nothing loads before consent.** The tracker initializes only on an explicit
  accept (see `ConsentProvider`); don't add an analytics script that bypasses it.
- **Session replay stays off.** It is billed per recording and is PostHog's
  priciest product. Turning it on is a spend decision, not a config tweak.
- Autocapture is on, which is what makes CTA/form tracking work without
  per-element wiring. It is also the main driver of event volume — if the shared
  project nears its ceiling, that is the first dial to turn.
- **Campaign attribution is read by us, not left to posthog-js.** The tracker
  reads `utm_source/medium/campaign/content/term` from the LANDING url at first
  render and registers them as super-properties, so they ride every event of the
  visit instead of only the one fired on the url that carried them. Property
  names match the join page's, so one breakdown spans both web surfaces — keep
  them identical if you touch either side. **QR table-sticker ids are NOT read
  here**: stickers lead to `tagly-join`, never to this site, so `sticker_id`
  belongs to the join page alone. Don't add it.
- `NEXT_PUBLIC_POSTHOG_KEY` is a publishable `phc_*` project key, inlined at
  build time. It belongs in `NEXT_PUBLIC_`; the *personal* API key never does.

The site should be built so that important actions are easy to track.
Examples:

- demo/contact sales clicks
- form submissions
- CTA clicks by page section
- navigation clicks to key pages

Use standard analytics-friendly patterns.
Do not build interaction logic in a way that makes event tracking brittle or confusing.

Important CTAs should be implemented clearly and consistently.

---

## Maintainability requirements

This site will likely evolve quickly.
Code and content structure should make it easy to:

- add new landing pages
- update copy
- add comparison pages
- add guides/resources later
- change CTAs
- add analytics events cleanly

Prefer reusable section patterns where they genuinely reduce duplication, but do not abstract so early that content becomes harder to control.

A good rule:

- abstract repeated layout structure
- do not abstract away page meaning

---

## What to avoid

Do not introduce any of the following unless explicitly requested:

- heavy animation systems
- unusual rendering strategies for simple marketing pages
- excessive client-side state
- over-complicated CMS integration
- overuse of generic wrapper components
- cryptic utility layers
- SEO “tricks” that reduce content quality
- pages that are visually impressive but semantically weak

Do not make the site harder to crawl, harder to maintain, or harder to understand in the name of novelty.

---

## Decision rules

When multiple implementation options exist, prefer the one that is:

1. more standard in the Next.js ecosystem
2. easier for a new engineer to understand
3. better for SEO and semantic clarity
4. faster to maintain and edit
5. less fragile

If a proposed approach is flashy but weaker for crawlability, semantics, or maintainability, reject it.

If a proposed approach is over-engineered for a marketing site, reject it.

---

## Output expectations for Claude

When generating code or recommending architecture for this repository:

- explain major decisions briefly and clearly
- prefer industry-standard implementations
- preserve semantic HTML
- preserve SEO-friendly structure
- keep components readable
- keep content editable
- do not silently introduce unnecessary complexity

If there is a tradeoff between visual complexity and SEO clarity, prefer SEO clarity unless told otherwise.

If there is a tradeoff between custom cleverness and maintainability, prefer maintainability.

This project should feel like a high-quality, modern, trustworthy business website built with discipline.

## Technical stack and architecture

This project uses:

- Next.js App Router
- TypeScript
- Tailwind CSS

### Project structure expectations

Use a clear, conventional structure.

Recommended structure:

- `src/app` for routes, layouts, metadata, sitemap, and robots
- `src/components` for reusable components
- `src/components/layout` for global layout pieces like navbar and footer
- `src/components/sections` for marketing page sections
- `src/components/ui` for small presentational UI primitives
- `src/lib` for helpers and shared utilities
- `src/content` for static page content, FAQ data, and other structured copy where useful

Do not put unrelated logic everywhere inside `src/app`.
Keep route files focused on page composition and metadata.

### Next.js implementation expectations

- Use App Router conventions
- Use `layout.tsx` appropriately
- Prefer server components by default
- Use client components only when interactivity is actually needed
- Keep marketing pages mostly static or server-rendered
- Do not require client-side JavaScript for important page meaning or SEO-critical content

### Reusable component guidance

Reusable components are encouraged when they improve consistency and maintainability.

Good reusable components include:

- navbar
- footer
- section/container wrappers
- CTA sections
- FAQ sections
- comparison tables
- testimonials or trust sections
- shared heading/block patterns

However:

- do not over-abstract simple marketing content
- do not create giant generic components with too many props
- do not hide semantic structure behind overly clever abstractions
- do not make pages harder to edit in the name of reusability

Prefer:

- reusable layout patterns
- reusable visual structure
- explicit page content

Avoid:

- “one component for everything”
- deeply nested config-driven page builders unless explicitly requested
