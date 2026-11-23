# tagly-join

Standalone Next.js project for the Tagly referral/join landing page. Replaces the legacy `invite-page/` (static HTML).

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../CLAUDE.md).

## Standalone Project

This is **NOT** part of the monorepo's yarn workspaces. It has its own `node_modules/` and `yarn.lock`. This is intentional — it keeps deployments independent and avoids coupling the join page's build to the monorepo's dependency tree.

```bash
cd tagly-join
yarn install   # Run separately from root yarn install
yarn dev       # Development server
yarn build     # Production build
```

## Design System

**The page mirrors the app's cream design system** (source of truth:
`tagly-shared/client/theme/theme.ts` + the rules in `tagly-shared/client/CLAUDE.md` —
read both before styling anything here; keep `globals.css` tokens in sync):

- **Fonts:** the app's real files via `next/font/local` (`src/app/fonts/`) —
  Playfair (headings, ≥600: bold for h2, semiBold for h3) + Stack Sans Text
  (body, 400/500 only). **The hero `h1` is the one deliberate deviation from the
  app ladder: Stack Sans 500, not Playfair.** The hero heading runs ~75
  characters over three lines on a phone, and a high-contrast display serif gets
  tiring at that length. Playfair still opens the page via the wordmark and
  carries every section `h2`, so the serif is not lost
- **Colors:** cream `#FFFCF2` background, white `#FFFFFF` surfaces, ink
  `#382724` (text + primary actions), butter `#FFF3B0` + blue `#C1DBE8` as
  small accents only, success green `#3F9B6E` for money figures
- **Separation by warm shadow, never borders** — `var(--shadow-chip|card|float|button)`
  in `globals.css`; hairline `--color-divider` only for dividers
- **Radius:** `--radius-lg: 8px` structure, `--radius-sm: 4px` buttons, `--radius-max` pills
- **Typography classes:** `.text-style-h1…` in `globals.css` map onto the app
  ladder (h1→**Stack Sans 30/500**, see Fonts above; h2→title 24 bold,
  h3→heading 19 semiBold, h4/body-bold→bodyMedium, small-body→caption,
  small-body-bold→label, **micro→11/500 for metadata that must sit below
  caption**, `.text-style-amount` for green money figures at 24/500)
- Legacy CSS var aliases (`--color-contrast`, `--color-placeholder`, …) are
  mapped onto the new roles — prefer the role names in new markup
- **Copy voice matches the app:** warm, sentence case, plain punctuation, the
  unit is a "share"; Czech in tykání with the brand in 1st-person plural

## UI Primitives

| Component | Path | Description |
|-----------|------|-------------|
| `Button` | `src/components/ui/Button.tsx` | App CustomButton twin: `primary` = ink fill/butter label, `secondary` = white surface; radius 4 |
| `PressableText` | `src/components/ui/PressableText.tsx` | Animated underline link component (ink) |
| `ImageLightbox` | `src/components/ui/ImageLightbox.tsx` | Zoomable image using `react-medium-image-zoom` |
| `TaglyLogo` | `src/components/TaglyLogo.tsx` | The brand mark (`public/tagly-logo.png`, ink "g" on transparent) at 32px, `priority`-loaded. Mark only, no wordmark — "Tagly" is already in the navbar CTA and all over the page |
| `NavDrawer` | `src/components/NavDrawer.tsx` | The navbar's secondary menu **at every width** — web port of the apps' `SideDrawer` + `TopMenu` hamburger: rotate+cross-fade menu↔close icon (220ms), right-side panel clipped to the content column and to below the bar, warm ink scrim, scroll lock, Escape, rendered in a portal. Holds the business pitch + CTAs and the `EN/CS` picker |

## Tech Stack

- Next.js 16.2.3 (Turbopack)
- React 19
- Tailwind CSS 4 (via `@tailwindcss/postcss`)
- TypeScript

## Internationalization (i18n)

The join page has its own standalone i18n system (English + Czech) under `src/i18n/`, separate from the React Native system in `tagly-shared/client/i18n/`. It uses a **per-request i18next factory** (not a shared singleton) because the page is mostly Server Components, and detects the language from the browser's `Accept-Language` header (no middleware, no URL prefixes). See [src/i18n/CLAUDE.md](src/i18n/CLAUDE.md) for the full guide.