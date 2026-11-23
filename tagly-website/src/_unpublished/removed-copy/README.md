# Removed copy (parked, not restorable from git)

This folder preserves copy that was deliberately removed from live pages while
`tagly-website/` was still untracked in git (deleting it would have been
unrecoverable). Nothing here is rendered.

- `about-longform.{en,cs}.json` — the pre-2026-08-09 `/about` page (story,
  mission, beliefs sections + long hero). Replaced by the short app-drawer-style
  about copy per Matej's call; not planned to return.
- `support-page.{en,cs}.json` — the standalone `/support` page, merged into
  `/contact` 2026-08-09 (`/support` now 301s there). The `form.*` keys moved
  into `contact.{en,cs}.json`; the `resources.*` keys (the "before you reach
  out" grid pointing at the FAQ / how-it-works pages) are parked here — if
  those pages are ever restored from `src/_unpublished/[lng]/`, the grid would
  now belong on `/contact`.
