# Tracking

Status: X (not done), ✓ (done), ↻ (redesigned in the Tagly rebrand, awaiting re-verification).

---

## Rebrand status (Flaer → Tagly, 2026-08-07)

The site was rebranded from Flaer to Tagly: new name, logo, colors, fonts, and
visual style. Page content and copy meaning were not changed.

Done:

- Token layer, self-hosted fonts, and typography scale (`src/app/globals.css`, `src/fonts/`)
- Visual redesign of every page under `src/app/`
- Name swap across code, routes, metadata, and both locale sets; the three
  comparison routes moved to `-vs-tagly` with 301s from the old slugs
- Shared components in `src/components/` restyled to the Tagly token set; the
  navbar and footer now render the Tagly wordmark. With the last references
  gone, the old brand assets (`text-logo.svg`, both `durves-bg` textures) were
  deleted.

- Verified: clean build, all 26 routes load in both languages, old slugs 308 to
  the new ones, sitemap and Organization/WebSite/FAQPage schema carry the new
  brand, and no page renders a pre-rebrand class or the old brand name.

Still open:

- Legal pages now render the monorepo's canonical `../tagly-legal/` markdown
  directly at build time (2026-08-08; `new-legal-docs/` deleted) — content is
  the current Tagly-branded Aug 2026 documents, maintained under
  `tagly-legal/CLAUDE.md` rules.
- The Czech copy treats "Tagly" as indeclinable and needs a native-speaker review.
- Every page's Design column is ↻: the new design is applied but has not been
  re-reviewed against the criteria below. That review is visual and has to be
  done by a person; the automated checks above cannot stand in for it.
- Three colors fall short of WCAG AA (4.5:1) where they are used as text:
  `danger` on an error message is 4.03:1, `success` on the careers compensation
  lines is 3.43:1, and `text-tertiary` on an input placeholder is 2.66:1. All
  three values come straight from the app's design system, so darkening them is
  a design-system decision, not a site-level one.
- The domain, emails, and OneLink URLs stay on flaer.app. Each is marked with a
  `TODO(domain-migration)` comment in the code. Social handles are now
  centralized in `src/lib/social.ts` (locale-aware since 2026-08-08), which
  carries the remaining `TODO(domain-migration)` for them.
- `Button` has no `inverted` variant. The rebrand plan called for one, but no
  button currently sits on an ink band, so it would be dead code. Add it when
  the first one does.
- ~~Colocate the i18n JSON next to its pages/components.~~ **Done 2026-08-08.**
  Every namespace moved out of the central `src/lib/i18n/locales/` catalog (now
  deleted) to sit beside its page or component, matching the apps' convention;
  `common` and `comparison` stay in `src/lib/i18n/` because they have no single
  owner. Namespace ids are unchanged, so no page code changed. The
  dynamic-context import in `index.ts`/`client.ts` was replaced by
  `resources.ts`, a registry of lazy thunks — **keep them thunks**, or the client
  bundle eats every JSON file at once.
  Verified from the prerendered HTML rather than the build exit code: every
  namespace renders real copy in both locales (source strings matched verbatim
  against the rendered output), no raw keys leaked, and en/cs outputs differ.
  `cookie-bar` is the one namespace absent from SSG output — by design, since
  the bar only renders once the stored consent choice has been read on the
  client — so it was verified in the client chunks instead, where EN and CS land
  in separate chunks (proof the code-splitting works).
- **Image alt text audited against the actual images (2026-08-08).** Every image
  was opened and compared with its alt. Corrections: the how-it-works `s1` alt
  called the business-page photo "a photo of the cafe" (it is brunch dishes) and
  described an empty "Add phone" slot as a contact button; the for-customers
  `s4` alt had been copied from the ADVERTISER screenshot, so it claimed $4.6 /
  97 Kč and 193 reach when the customer screen shows **$4.2 (EN) and 114 Kč with
  241 reach (CS)**; the homepage's three step alts were true but vague; and the
  three real customer stories shared one templated alt ("Instagram story shared
  at {{business}}") which described none of them — now `examples.alts`, one per
  image, matching the industry pages' pattern.
  **Each locale's alt must describe THAT locale's screenshot** — the EN and CS
  app captures carry different demo data (reward, reach, currency), so they are
  not translations of each other. The industry pages' share-example alts were
  spot-checked and are accurate; left alone.
- **Lightboxed images were missing from the server-rendered HTML (2026-08-08).**
  `ImageLightbox` loaded `react-medium-image-zoom` with `dynamic(..., { ssr:
  false })`, and the `<Image>` is that component's CHILD — so every lightboxed
  image existed only after hydration. The homepage, `/how-it-works` and every
  industry gallery served just the 3 logo images; ~35 images and all their alt
  text were absent from the HTML, against this project's own rule that content
  must not depend on client rendering. Dropping `ssr: false` (zoom is only
  click-to-enlarge) fixed it: homepage 3 → 9 `<img>`, `/how-it-works` 3 → 8,
  `/cafes` 3 → 9, all with alts. **Worth a browser check for hydration warnings
  and that click-to-zoom still works** — verified in the build output, not in a
  real browser.
- **Default language is now Czech (2026-08-08).** Detection order is unchanged
  (cookie → `Accept-Language` → default); only the final fallback moved from EN
  to CS, so a visitor whose browser says nothing useful gets the Prague-market
  language. `settings.ts` now splits the two meanings that were conflated in one
  `fallbackLng`: `defaultLng` (`cs`, who gets shown what) and
  `translationFallbackLng` (`en`, what patches a missing key). `x-default`
  hreflang was added pointing at `defaultLng` so crawlers agree with the
  middleware. Consequence to know: a German or Polish browser now lands on Czech
  rather than English. Slovak speakers are better served by it.
  Two traps found by testing this live, both worth remembering: `accept-language`
  `.get()` returns the FIRST configured language on no match (never null), so the
  default has to lead the array it is given; and the global 404 hardcodes
  `lang="en"` because its copy is literally English.
- **EN homepage hero is text-only and centred (2026-08-08).** Title, subtitle,
  CTA, plus the Czech-explainer opt-in — now labelled in English ("Watch our
  explainer video in Czech") instead of a Czech sentence that meant nothing to
  English readers. The 3-image story collage was dropped from the hero (the
  photos still appear further down the page); `hero.collageIntro`/`collageAlts`
  and the CS copy of `czechVideoCta` were removed as dead keys. CS keeps its
  side-by-side video hero. The two heroes differ by CONTENT, not styling — the
  EN page has no video to show, since the explainer is Czech-only.
- **Analytics moved to PostHog (2026-08-08).** GTM, GA4, and Microsoft Clarity
  are gone; `src/lib/analytics/PostHogTracker.tsx` is the only tracker, on the
  same shared project as the apps/backend/join page (`app: "tagly-website"`).
  Consent-gated, autocapture on, **session replay off** (billed per recording;
  enabling it is a spend decision). Verified in the build output: none of the
  three old ids appear in the prerendered HTML *or* the client bundle, PostHog
  is absent from prerendered HTML (client-only by design), and the `phc_*` key,
  the `app` super-property, and `disable_session_recording` are all present in
  the client chunks.
  **Two open items:** (1) **`NEXT_PUBLIC_POSTHOG_KEY` must be added to the
  Amplify app `d3p9jakxhc1wfc` before the next deploy, or the build will fail.**
  As of 2026-08-08 that app has only `RESEND_API_KEY` set. `next.config.ts` now
  throws when the var is missing or is not a publishable `phc_*` key, precisely
  so a missing var can't silently ship a site that tracks nothing (the value is
  inlined at build time, so there is no runtime signal). The same guard was added
  to `tagly-join`, whose Amplify app already has the var. Nothing was added to
  `amplify.yml`: `NEXT_PUBLIC_*` is read straight from `process.env` at build
  time, same as the join page. (2) The GTM container `GTM-MFCFW86H` is
  now orphaned — whatever was configured inside it via the GTM UI (Google Ads
  conversion, Meta pixel, LinkedIn insight) stopped firing and is invisible in
  this repo. Audit the container before assuming nothing was lost.
- **Cookie consent is now asked of every visitor (2026-08-08).** Analytics (GTM,
  GA4, Microsoft Clarity) load only after an explicit accept, with no region
  detection. Previously the banner was gated on a browser-timezone guess
  (`src/lib/geo/is-eu-timezone.ts`, now deleted) and analytics loaded unprompted
  for anyone guessed non-EU. Two reasons it went: the timezone is a
  user-controlled setting that privacy browsers (Tor, Firefox RFP, Brave) report
  as `UTC`, which was not on the list, so those EU visitors were classed non-EU
  and got GA + Clarity **session recording** with no prompt; and the list was
  missing EU territory anyway (Åland, and the French outermost regions, while the
  Portuguese/Spanish equivalents were present). With the home market now Prague
  the gate had no upside left. If geo-gating is ever wanted again it belongs
  server-side (a viewer-country header read in middleware), never in the browser.
  Verified both directions: no analytics id appears in any of the 50 prerendered
  HTML files, and all three ids are still in the client bundle so they do load
  after an accept.
- Two hardcoded English `aria-label`s remain in the navbar (landmark labels).
  They are the last unlocalized strings in `src/`; the global 404 at
  `src/app/not-found.tsx` is also English, but deliberately so (see
  `src/lib/i18n/CLAUDE.md`). Carried over from the 2026-05-26 localization audit
  when `src/lib/i18n/unfinishedStrings.md` was retired 2026-08-08 (its headline
  finding, the three fully-hardcoded legal pages, was resolved when they moved to
  `../tagly-legal/`).

---

## Explainer video removed from the landing page (2026-08-09, Matej's call)

The CS hero's explainer video was pre-rebrand and a new one is being made, so
the video is gone from both locales: the CS side-by-side hero and the EN
"Watch our explainer video in Czech" toggle were replaced by one shared
text-only centred hero (title, live-count subtitle, CTA). Deleted outright:
`public/videos/explainer.mp4`, `public/images/explainer-preview.png`,
`src/components/ui/CzechVideoToggle.tsx`, and the `hero.videoIntro` /
`videoFallback` / `czechVideoCta` keys in `home.{en,cs}.json`. This closes the
"homepage plays the old brand" blocker from the rebrand review; when the new
video lands, the hero comment in `page.tsx` marks where it goes back.

Still on disk: `public/videos/how-it-works-compressed.mp4` (the pre-rebrand
/demo video). The demo page is unpublished, but everything in `public/` is
served, so the file is still fetchable at its direct URL. Delete it whenever
the demo re-shoot decision is made.

Verified from the rebuilt HTML: zero `<video>` tags and zero "explainer"
references in `/cs` and `/en`, both heroes render title + subtitle + CTA.

---

## New explainer video back on the landing page (2026-08-14)

The new post-rebrand explainer (Czech voiceover, burned-in CS subtitles, 53 s)
is back in the hero, compressed for web from the 82 MB HEVC export to an
~8 MB H.264 1080p30 `public/videos/explainer.mp4` (+ `explainer-poster.jpg`).
Placement: below the shared hero text block, capped at 800px and centred on
desktop, full-width within page padding on phones. Locale split per the
original design: `/cs` autoplays it muted+looping (subtitles carry it), `/en`
renders the re-created `src/components/ui/CzechVideoToggle.tsx` — a "Speak
Czech? See how Tagly works in this short video" text button that reveals the
same video, starting with sound. Strings live under `video.*` in
`home.{en,cs}.json`.

The pre-rebrand `public/videos/how-it-works-compressed.mp4` was deleted in the
same pass (it was fetchable at its direct URL); the unpublished demo page now
points at the new explainer until the demo re-shoot decision is made.

Same-day follow-ups (Matej's feedback, iterated live): the stacked hero read
as a wall of type on EN and gave no scroll hint. Desktop (1200px+) is now a
two-column row — copy + CTA left, video right — filling the first viewport
(`--spacing-hero-min-height` token), with a bouncing `ScrollCue` chevron
(`src/components/ui/ScrollCue.tsx`) pinned at the fold that scrolls to
#how-it-works. The trusted-by strip moved INSIDE the hero (section-gap above
it, section-gap of bottom padding keeping it clear of the chevron) so the
social proof is part of the first viewport. The EN "Speak Czech?" reveal
toggle lived for about an hour: Matej then decided the video simply
autoplays muted on both locales (Czech audio/subtitles accepted on /en), so
`CzechVideoToggle.tsx` is gone and the shared player is
`src/components/ui/ExplainerVideo.tsx`. The hero title now breaks after the
comma in BOTH locales and always renders as exactly two lines
(`.text-style-h1-fit`: `white-space: pre` + cqw-fluid font size, divisor
derived from the measured widest line — CS at 11.43em). Verified via
headless-Chromium screenshots of the production build at 1440/1220/500px,
both locales.

Bug fixed in the same pass: `src/lib/i18n/client.ts` initialized the browser
i18next instance via bare `getOptions()`, pinning the initial client
language to `defaultLng` ("cs") — every /en page hydrated its client
components (navbar, contact form) in Czech, logging a React hydration
mismatch and regenerating the tree. The instance now seeds its initial
language from the URL's [lng] segment, so the first client render always
matches the SSR markup; the language detector remains only to cache the
language into the locale cookie for the middleware.

---

## Trusted-by strip added under the hero (2026-08-09, Matej's call)

Five hand-curated venues (Dim Sum Spot, Loft N8, Berry Good, Karawba,
Felicity Nail Salon) render as an uppercase micro overline ("Spolupracují s
námi" / "Businesses we work with") + Playfair wordmarks in secondary brown,
between the hero and how-it-works. Deliberately hardcoded
(`TRUSTED_BUSINESSES` in `page.tsx`), NOT backend-fetched — who appears is
an editorial/permission decision. Wordmarks are the treatment BY DESIGN, not
a stopgap: several venues have no logo (Felicity), and uniform type beats a
mixed logo wall — don't collect logo files for this.

---

## Landing contact form reworked (2026-08-09, Matej's call)

"Your name" moved first and became required; phone is optional (labelled
"(nepovinné)"/"(optional)"); the preferred-contact radios only render once a
phone number is typed (unmounting on clear also drops a stale choice from
the FormData); the message field is labelled optional the same way. The
`/api/contact` route's validation moved in lockstep — it now requires
name + businessName + email and treats phone/preferredContact as optional
(it used to 400 without a phone). NOT verified with a live submit — that
would send a real email through Resend.

---

## Examples section: mobile row cards, disclaimer cut (2026-08-09, Matej's call)

The share-example cards on `/` are now, on phones, stacked ROW cards
mirroring the how-it-works steps: the full 9:16 story on the left (40% of
the row), the stats beside it on the right — sitting on the frosted-blur
treatment rather than a plain surface (the story image repeats underneath
the stats column, cover-cropped and decorative, so the backdrop blur has
something real to frost). The stat lines scale with the card width (cqw
clamp, 11px floor = desktop unchanged, ~14px on phones). Tablet and up
(`md:`) keeps the previous three-column grid — full-card photo, frosted
panel overlaid on its head — capped at the content column. (Two mobile
layouts were tried and replaced the same day: a join-style 144px horizontal
snap scroller — panel text too cramped — then full-width stacked 9:16 cards
— photos ate the screen.) The disclaimer line below the cards ("V ceně je
všechno…" + the "Podívejte se, co ovlivňuje cenu" scroll link) was removed
in both locales — the pricing section sits directly below and answers the
question itself; the section's "get in touch" CTA stays.

Same day, second pass: the section was retitled from "Skutečné příspěvky od
skutečných zákazníků" to "Podívejte se, jak to funguje u jiných podniků"
(EN "See how it works for other businesses") with a matching intro — the old
heading leaned on "people are real" when the pitch is "this works for
businesses like yours". Each card also gained a third stat line, "Zákazník
utratil X Kč" / "Customer spent X Kč" (what the posting customer spent at
the venue, showing the business profits either way). **The three `spent`
values in `EXAMPLE_SHARES` (`page.tsx`) are PLACEHOLDERS (300 Kč each) —
Matej must replace them with the real figures before this ships** (marked
with a TODO in the code).

---

## About shortened + contact/support merged (2026-08-09, Matej's call)

- **/about rewritten to be short.** The story, mission, and beliefs sections
  are gone; the page is now the apps' AboutSheet copy
  (`tagly-shared/client/components/feedback/AboutSheet`, converted to vykání
  in CS: "co nám pošlete"), plus the team photo grid and the closing CTA. The
  removed long-form copy is parked in
  `src/_unpublished/removed-copy/about-longform.{en,cs}.json` (the site folder
  is untracked in git, so deletion would have been unrecoverable).
  Same-day follow-up (Matej's calls): the cross-links paragraph and the CTA
  section were removed too, so the page is just hero + team; the team grid is
  now Matej → Stepan → Vit Stanek (new, `vit-stanek.png`, transparent photo
  over the wrapper's `bg-surface`) → Eduard, with Ondrej Bednar removed
  (photo deleted too); roles were hand-edited by Matej (CS uses `\n` for
  controlled two-line breaks — the role `<p>` carries `whitespace-pre-line`
  to render them); names/roles are `text-center`; photo circles were bumped
  from `shadow-chip` to `shadow-card`.
- **/support merged into /contact.** `/contact` is now the single contact AND
  support page: hero → general/business cards → the request form (moved from
  /support; `SupportForm` now lives in `src/components/contact/` and reads the
  `contact` namespace, still posting to `/api/support`) → socials → company
  info. `/support` 301s to `/contact` (bare + locale-prefixed) so the App
  Store / Meta support links keep resolving; it left `sitemap.ts`, the
  `support` i18n namespace was removed, and the old page copy (incl. the
  parked `resources.*` "before you reach out" grid) is in
  `src/_unpublished/removed-copy/support-page.{en,cs}.json`.
- **Footer Company section trimmed** to About + Contact: the Support link and
  the "Leave your contact" (/#contact) row were dropped (Matej's call —
  Contact covers both). `company.support` was removed from both footer JSONs;
  `forBusiness.getInTouch` stays for the unpublished For Business restore.
- **User-facing emails moved to taglyapp.com** (Matej's edit in the same
  pass): `hello@`, `support@` on /contact now taglyapp.com, matching the
  existing `legal@taglyapp.com`. NOTE: the `/api/support` and `/api/contact`
  Resend routes still DELIVER to the flaer.app inboxes (`to:` fields, own
  `TODO(domain-migration)`) — repoint them once the taglyapp.com mailboxes
  are confirmed receiving.
- **Contact slimmed further, company info moved to /about (2026-08-09,
  Matej's call).** /contact is now hero → cards → form only: the
  "Looking for something else?" cross-links paragraph, the company-information
  section, the legal-inquiries line, AND the "Follow us" socials section were
  removed (socials stay in the footer, which renders on the page anyway).
- **Contact form made dynamic, cards removed (2026-08-09, Matej's call).**
  /contact is now just hero + one form (`ContactRequestForm`, replacing
  `SupportForm`): a category pill picker (support / feedback / something else)
  adjusts the fields — the reason select is support-only, the message
  label/placeholder follows the category — and shows the matching direct
  email. `/api/support` picks the delivery inbox SERVER-SIDE from the
  category via the shared `src/lib/contact-inboxes.ts` map: support@ /
  feedback@ / hello@taglyapp.com (from: noreply@taglyapp.com, Matej's
  migration). The two intro cards (general email, business sales) went away
  with it; businesses still convert via the landing `#contact` form. The
  "I am a business owner" checkbox was dropped too (form + API). NOTE:
  `feedback@taglyapp.com` must exist as a mailbox/alias in Zoho before
  deploy, or feedback submissions bounce. The company block
  (Flaer, Inc. + registered address) now lives on /about below the team, with
  CS "zapsaná" corrected to "registrovaná". The `legal@taglyapp.com` line was
  dropped from the site entirely — the legal documents themselves carry it
  (the privacy policy alone names it ~10 times incl. the full company block).

Verified from the rebuilt output: 7 kept pages ×2 locales, sitemap has no
/support, `routes-manifest.json` carries both /support redirect rules, both
locales' /contact render the form (labels + reason options) and company info,
/about renders the AboutSheet copy with mission/story gone, and no live page
links to /support.

---

## Pages unpublished pending copy rewrite (2026-08-08, Matej's call)

Everything except the landing page, /about, /contact, /support, the three
legal pages, and /instagram-data-deletion was UNPUBLISHED — Matej wants the
copy redone before those pages ship again. Nothing was deleted (the folder is
untracked in git, so deletion would be unrecoverable):

- Page folders moved to `src/_unpublished/[lng]/`: how-it-works, pricing, faq,
  referrals, restaurants, cafes, gyms, salons, local-businesses, the three
  `*-vs-tagly` comparisons, for-customers (both subpages), demo, careers.
- Their namespaces are commented out in `src/lib/i18n/resources.ts` (which
  also carries the full restore checklist), their routes removed from
  `sitemap.ts`, and their URLs get TEMPORARY (not 301) redirects to the
  homepage in `next.config.ts` — temporary on purpose so search engines keep
  the URLs for the relaunch.
- Footer trimmed to Apps / Company (about, contact, support, "Zanechat
  kontakt") / Legal; the unused footer JSON keys stay for the restore.
- Kept-page links repointed: /about's how-it-works + pricing links go to the
  landing anchors (/#how-it-works, /#pricing), /contact's FAQ mention was
  dropped from links.text (both locales), /support lost its whole
  "before you contact us" resources grid (all four targets unpublished; the
  `resources.*` JSON keys remain for the restore).
- The page-status tables below still list the unpublished pages; treat every
  row not in the kept set as parked in `src/_unpublished/`.

Verified from the build output, not assumptions: the route list contains
exactly the 8 kept pages ×2 locales, sitemap.xml carries only kept URLs, the
prerendered HTML of the landing + kept pages contains zero links to
unpublished routes, and `routes-manifest.json` carries all four temporary
redirect rules.

---

## Copy + alt pass, all non-landing/non-legal namespaces (2026-08-08, CS-first)

CS rewritten first, EN re-matched to the CS meaning. What changed, sitewide:

- **App terminology enforced.** Referral vocabulary switched to the apps'
  "pozvánky" family (pozvat, odkaz a kód na pozvání, "Pozvěte a vydělávejte"
  in the footer; EN: invite link/code, "Invite & Earn"); `/referrals` rewritten
  around it in both locales. "Proplatit/vyplatit/vypořádat" eliminated in favour
  of the apps' "story je zaplacené / získáte odměnu / výběr peněz" (EN: paid,
  never "settles"). "Samolepka s polohou" unified to "polohová nálepka".
- **Per-story cap numbers removed** ($50/$35) from restaurants, gyms, salons
  and local-businesses (both locales) per the standing rule in
  `pricing.{en,cs}.json`'s `//` comment: say a cap exists, never the number.
- **No negative framing**: the $15-visibility rule and the rating step are now
  stated positively (what keeps you visible / what unlocks details); no page
  discloses "no monthly cap on PAYG" or the negative-balance hiding rule.
- **/about moved to Prague** (meta, story.p2, team.intro, both locales) per §4;
  `/contact` no longer promises "book a call"; `/demo` heading says Instagram
  Stories instead of "social media".
- **Alt text verified against every rendered image** on /how-it-works,
  /for-customers/how-it-works (incl. all app screenshots per locale — each
  locale's alt matches THAT locale's capture) and all industry example photos.
  Fixed: restaurants `alts[1]`↔`alts[3]` were swapped (pizzas at Italian Corner
  vs steak at Joe's Steak House); cafes `alts[5]` described the orphaned
  acai-bowl photo instead of the rendered waffle dessert at Brunch House;
  the same two errors inherited by the for-customers example alts; salons
  `alts[0]` "marble" → white-and-pink. Both locales.

Landing page (`home.*`), legal pages, and `/instagram-data-deletion` (blocked
on the backend deploy, see COPY-AUDIT #59) deliberately untouched.

---

## Rebrand review findings (post-execution audit, 2026-08-07)

An independent review of the executed rebrand. What was checked: the full diff
(`cb0b8f0..HEAD`), a clean production build, the dead-token and brand-name
greps, the redirect and sitemap wiring, spot reads of every restyled component,
both locale sets, the shipped image assets, and the pages that consume them.

### What holds up

- Build is clean and all routes compile. The token layer, `.card` utility,
  typography scale, and self-hosted fonts in `src/app/globals.css` and
  `src/fonts/` faithfully implement the design system, including the h4-as-sans
  decision and the Playfair weight floor.
- Zero leftovers of the old classes (`bg-contrast`, `border-outline`,
  `text-placeholder`, `bg-secondary-background`, `text-red-600`), old hex
  values, black overlays, or the durves textures anywhere in `src/`.
- The three comparison routes, their i18n namespaces, internal links, sitemap
  entries, and 301s in `next.config.ts` (bare + locale-prefixed) are all
  consistent. Renamed locale keys (`whyTagly`, `aria.taglyHome`, `columnTagly`)
  match between code and both languages.
- Butter and blue are used only as small accents; green appears only on money
  (referrals progress, careers compensation); ink bands correctly replaced the
  yellow bands with no buttons stranded on them.
- Czech copy reads naturally with "Tagly" treated as indeclinable
  (spot-checked `cafes`, `demo`, `navbar`); still needs the native review
  already flagged above.
- The homepage step illustrations (`landing-page-components/*.webp`) were
  re-captured from the new Tagly app UI. `not-found.tsx` now gets the font
  variables. "Flaer, Inc." entity references were correctly preserved.

### Blocking — old brand still user-visible

1. ~~**Legal pages contradict their own metadata.**~~ Resolved 2026-08-08 by
   the monorepo move: the site now reads the canonical `../tagly-legal/`
   documents (Tagly-branded, last updated Aug 6-7 2026) directly at build
   time, and the stale June 1 Flaer-branded `new-legal-docs/` copies were
   deleted. Rendered headings ("# Tagly Privacy Policy") now match the
   `legal.json` metadata.
2. ~~**The how-it-works pages show the old app.**~~ Resolved 2026-08-08. Both
   `/how-it-works` and `/for-customers/how-it-works` now use new Tagly app
   captures as locale-aware webps; all nine old Flaer PNGs were deleted,
   including the 3.8 MB `customers/step-1.png`. See the changelog below.
3. **Videos are pre-rebrand.** `public/videos/explainer.mp4` (homepage hero)
   and `how-it-works-compressed.mp4` (`/demo`) date from May and almost
   certainly show the Flaer app and logo; neither was replaced or verified.
   Until re-shot, the very first thing a homepage visitor plays is the old
   brand.
4. **The OG share image has a rendering artifact.** `public/og-image.png`
   (1200×630) composites the wordmark from a non-transparent source: a white
   rectangle is visible behind "Tagly" against the butter background. Every
   social share renders this. Recomposite from
   `public/tagly-logo.png`/`tagly-mark.png` (both transparent). The third
   source this used to suggest, `design/brand/Tagly og logo.png`, is gone —
   `design/` was deleted 2026-08-08 as dead scratch.

### Should fix

5. **Font payload is ~836 KB.** `next/font/local` serves the TTFs as-is:
   Playfair SemiBold + Bold are ~340 KB each, Stack Sans ~78 KB each. A woff2
   conversion cuts this by roughly two thirds and needs only the `src` paths
   updated. Biggest easy performance win left on the table.
6. **`text-success` on careers compensation lines fails AA** (3.43:1 at
   16px/500, and it is real content text, not decoration). The danger (4.03:1)
   and tertiary-placeholder (2.66:1) shortfalls are lower risk, but the
   careers one should get a darkened site-side value rather than wait on the
   app design system.
7. **The "Verified" claim in the rebrand status above overstates.** "No page
   renders … the old brand name" is not true of the three legal pages, and the
   old brand is rendered as imagery in the homepage video and `/demo`.

### Minor / observations

- `public/videos/animations/*.mp4` (3 files, ~715 KB) are referenced nowhere —
  dead weight in the deploy, and old-brand besides. Delete or re-shoot.
- On mobile, `.text-style-h4` (16px/500 sans) is visually identical to
  `.text-style-body-bold`; h4 headings only differentiate at ≥1200px (18px).
  Acceptable, but worth knowing when reviewing pages.
- The blue `accent`/`on-accent` tokens are defined but unused on the site —
  the palette's secondary accent currently exists only inside app screenshots.
  Not a defect; an option for future section variety.
- ~~The landing step webps are 170–374 KB each at 1179px intrinsic width.~~
  Superseded 2026-08-08: replaced by new 1097px locale-aware captures at
  90–155 KB each (see the rebrand cleanup pass below).
- `src/middleware.ts` still lists `favicon.png` in its matcher exclusion. The
  file exists (now the Tagly mark), so this is harmless.
- JSON-LD `logo` points at `https://flaer.app/favicon.png`, which now serves
  the Tagly mark, so it is consistent; it changes anyway with the domain
  migration.

---

## Quality review plan

Every page will be reviewed against these criteria before being marked as reviewed:

### Design review

1. **Modern look** — Does the page feel current and professional? No dated patterns or clunky layouts.
2. **Visual section contrast** — Are adjacent sections visually distinct (alternating backgrounds, spacing, or layout shifts)? No two sections next to each other should look the same.
3. **Consistent spacing and rhythm** — Does the page breathe? Proper use of whitespace between sections and elements.

### Copy review

4. **No em dash spam** — Em dashes should be rare. Prefer periods, commas, parentheses, or restructured sentences. A few are fine, repeated use is not.
5. **Friendly but informative tone** — Copy should feel approachable and human, not stiff or corporate. At the same time it should be clear and useful, not fluffy.
6. **Does not sound AI-generated** — No generic filler, no overuse of "leverage", "elevate", "empower", "seamlessly", "unlock", or similar. Sentences should feel like a real person wrote them.

### SEO review

7. **One clear H1** — Page has exactly one meaningful H1.
8. **Logical heading hierarchy** — H2s and H3s follow a clear structure.
9. **Unique metadata** — Title, description, and OG tags are present and distinct from other pages.
10. **Content quality** — Real, useful content that serves the page's search intent. No thin or duplicate content.
11. **AI/search engine friendly** — Content is direct, quotable, and easy for Google, ChatGPT, and similar systems to understand and cite. Clear answers to likely questions, explicit explanations, no vague marketing fluff.
12. **Internal linking opportunities** — Are there natural places to link to other pages on the site (industry pages, pricing, FAQ, how it works, comparison pages, etc.)? Every page should link to at least a few related pages where it makes sense.

---

## Pages

| Page                          | Route                            | SEO | Design | Mobile | Reviewed |
| ----------------------------- | -------------------------------- | --- | ------ | ------ | -------- |
| Homepage                      | `/`                              | ✓   | ↻      | ↻      |          |

> Homepage full-flow rework (2026-08-08, third pass): the page funnels every
> section into the contact form embedded at the bottom (`#contact`; the
> standalone `/contact-sales` page was REMOVED — 301 to `/#contact`, form
> namespace moved to the colocated `contact-form`) with a "Zanechat kontakt"
> CTA after each section. Section anchors are English (`#how-it-works`,
> `#why-tagly`, `#examples`, `#pricing`, `#contact`) and the navbar's section
> links scroll to them. How-it-works is the sales one-pager's three steps
> (advertiser slide 2 → customer slide 1 → advertiser slide 3 artwork; step
> 3's body scroll-links to the pricing section). "Why Tagly works" and "What
> decides the price" are join-page-style icon-row cards (the pricing one
> mirrors the apps' `RewardInfoSheet` advertiser voice verbatim). Share
> examples are three of the join page's real stories (the first was dropped)
> leading with REACH, price paid (reward / 0.6, CZK) as a secondary line. The
> partners marquee + `/partners` page + partners content were removed (301 to
> `/`). The hero shows live social-proof chips from `GET /v2/public/stats`
> (optional `API_BASE_URL` env; chips hidden until the v2 backend deploys)
> and, on EN only, a story collage instead of the Czech video plus a "Mluvíš
> česky?" toggle; the hero's bottom gap was tightened so the next section
> peeks above the fold. Needs a visual re-review (Design/Mobile ↻).
> Register: the CS page is VYKÁNÍ (Matej's call 2026-08-08, matching the sales
> one-pager and the rest of the site; the brief tykání phase was reverted) —
> Matej to review the CS copy.
| How It Works                  | `/how-it-works`                  | ✓   | ↻      | ✓      |          |
| Pricing                       | `/pricing`                       | ✓   | ↻      | ✓      |          |
| FAQ                           | `/faq`                           | ✓   | ↻      | ✓      |          |
| Referrals                     | `/referrals`                     | ✓   | ↻      | ✓      |          |
| Restaurants                   | `/restaurants`                   | ✓   | ↻      | ✓      | ✓        |
| Cafes                         | `/cafes`                         | ✓   | ↻      | ✓      | ✓        |
| Gyms                          | `/gyms`                          | ✓   | ↻      | ✓      | ✓        |
| Salons                        | `/salons`                        | ✓   | ↻      | ✓      | ✓        |
| Local Businesses              | `/local-businesses`              | ✓   | ↻      | ✓      | ✓        |
| Instagram Ads vs Tagly        | `/instagram-ads-vs-tagly`        | ✓   | ↻      | ✓      |          |
| Influencer Marketing vs Tagly | `/influencer-marketing-vs-tagly` | ✓   | ↻      | ✓      |          |
| Marketing Agencies vs Tagly   | `/marketing-agencies-vs-tagly`   | ✓   | ↻      | ✓      |          |
| For Customers — How It Works  | `/for-customers/how-it-works`    | ✓   | ↻      | ✓      | ✓        |
| For Customers — FAQ           | `/for-customers/faq`             | ✓   | ↻      | ✓      |          |
| About                         | `/about`                         | ✓   | ↻      | ✓      | ✓        |
| Contact (incl. support)       | `/contact`                       | ✓   | ↻      | ✓      |          |
| ~~Support~~ (301 → /contact)  | `/support`                       | —   | —      | —      |          |
| Careers                       | `/careers`                       | ✓   | ↻      | ✓      |          |
| Privacy Policy                | `/privacy-policy`                | ✓   | ↻      | ✓      |          |
| Terms of Service              | `/terms-of-service`              | ✓   | ↻      | ✓      |          |
| Terms of Monetization         | `/terms-of-monetization`         | ✓   | ↻      | ✓      |          |
| Instagram Data Deletion       | `/instagram-data-deletion`       | ✓   | ↻      | ✓      |          |

---

## i18n localization (en / cs)

The site is localized with i18next under locale-prefixed routes (`/en`, `/cs`).
See `src/lib/i18n/CLAUDE.md` for the setup and the per-page process. All pages
are moved under `src/app/[lng]/` and route correctly in both languages.
"Localized" means the page's copy is actually translated (not just routed).

| Page / item                    | Localized (en+cs) | Namespace                        |
| ------------------------------ | ----------------- | -------------------------------- |
| Navbar                         | ✓                 | `navbar`                         |
| Footer                         | ✓                 | `footer`                         |
| Shared CTAs                    | ✓                 | `common`                         |
| Comparison shared headings     | ✓                 | `comparison`                     |
| Homepage                       | ✓                 | `home`                           |
| How It Works                   | ✓                 | `how-it-works`                   |
| Pricing                        | ✓                 | `pricing`                        |
| FAQ                            | ✓                 | `faq`                            |
| ContactForm (landing `#contact`) | ✓               | `contact-form`                   |
| Restaurants                    | ✓                 | `restaurants`                    |
| Cafes                          | ✓                 | `cafes`                          |
| Gyms                           | ✓                 | `gyms`                           |
| Salons                         | ✓                 | `salons`                         |
| Local Businesses               | ✓                 | `local-businesses`               |
| Instagram Ads vs Tagly         | ✓                 | `instagram-ads-vs-tagly`         |
| Influencer Marketing vs Tagly  | ✓                 | `influencer-marketing-vs-tagly`  |
| Marketing Agencies vs Tagly    | ✓                 | `marketing-agencies-vs-tagly`    |
| About                          | ✓                 | `about`                          |
| Contact (+ SupportForm)        | ✓                 | `contact`                        |
| Careers                        | ✓                 | `careers`                        |
| Referrals                      | ✓                 | `referrals`                      |
| Demo                           | ✓                 | `demo`                           |
| For Customers — How It Works   | ✓                 | `for-customers-how-it-works`     |
| For Customers — FAQ            | ✓                 | `for-customers-faq`              |
| Instagram Data Deletion        | ✓                 | `instagram-data-deletion`        |
| Privacy Policy                 | X (English only)  | (deferred — needs legal review)  |
| Terms of Service               | X (English only)  | (deferred — needs legal review)  |
| Terms of Monetization          | X (English only)  | (deferred — needs legal review)  |

The three long legal documents are intentionally left English for now (served
on both `/en` and `/cs`, canonical `/en/...`) pending a proper Czech legal
review. Everything else is fully translated in EN + CS.

---

## Homepage numbered-point pass (2026-08-08)

Three homepage sections adopted the numbered-point treatment from the Czech
one-pager: a soft-blue circle holding the number, with the copy beside it.

- "How it works" (`#jak-to-funguje`) — the `1. ` prefix that was baked into the
  heading text is now a badge sitting inline to the left of the H3.
- "Why businesses use Tagly" (`#proc-tagly`) — the single dense paragraph was
  replaced by the three points from the one-pager. `whyChoose.description` in
  both locale files became `whyChoose.points`. The old paragraph survives
  verbatim as point 2, generalized from the one-pager's "z Prahy" to
  "z vašeho města" / "in your city" since the site serves the US and Czechia.
- "What affects the reward for a story" (`#odmena-za-story`) — the oversized
  bare `text-style-h1` numeral was replaced by the same badge. Copy unchanged.
  This clears the `TODO` that sat on the section.

Two new components carry it: `src/components/ui/NumberBadge.tsx` (the circle)
and `src/components/ui/NumberedPoints.tsx` (the stacked list used by the latter
two sections).

The badge is `bg-accent` / `text-on-accent`, homepage only. The `FlowStep`
badges on the industry pages stay butter (`bg-brand`), so the site currently has
two number-circle colors. Deliberate for now; worth settling during the design
re-review.

---

## Rebrand cleanup pass (2026-08-08)

Executed in phases (plan: web dashboard removal, locale-aware assets and
socials, careers and referrals rework). Verified with a clean production
build, grep sweeps, and rendered-HTML checks of both locales.

- **Homepage step images** are locale-aware: `stepImagesByLng` in
  `src/app/[lng]/page.tsx` picks `.en`/`.cs` variants of steps 2–3; step 1
  (Instagram Story composer) is shared since its UI is English in both. New
  order is Instagram Story → app map → reward, which now matches the step
  titles. New webps are 1097x1839 at 90–155 KB; the old webps and the orphaned
  `public/images/how-it-works/landing/` folder were deleted.
- **Web dashboard removed sitewide.** The product no longer has one; businesses
  use the Tagly for business app. Footer dashboard link deleted, FAQ inline
  links repointed to the business-app OneLink, dead `dashboardHref`/`iosHref`
  code removed from `/how-it-works`, orphan `businessDashboard` key deleted.
  All copy rebranded to "Tagly for business app" (EN) / "aplikace Tagly pro
  podniky" (CS). Zero "dashboard" matches remain in `src/`. (Legal markdown
  was handled separately — see item 1: now sourced from `../tagly-legal/`.)
- **Social links** come from `src/lib/social.ts` — one official set for both
  locales since 2026-08-13 (instagram.com/tagly_cz, tiktok.com/@tagly.cz,
  linkedin.com/company/taglyapp; the old flaer.app/flaer.cz per-locale split is
  gone). Organization JSON-LD `sameAs` lists the three profiles on every page.
- **Careers: open position removed.** The page shows a no-open-positions empty
  state in both locales. `CareersForm`, `/api/careers`, and the `job`/`form`
  i18n keys were deleted (restorable from git history if a position opens).
- **Referrals: rates re-expressed as % of the reward.** Tagly's revenue share
  is no longer disclosed. Business 16% boosted / 8% standard, customer 8% / 4%,
  stacked maximum 24% of the reward. Qualitative "paid from Tagly's revenue"
  reassurances kept; no revenue percentages remain anywhere on the page or in
  its metadata.

- **`/how-it-works` restructured to 5 steps with new app screenshots.** The
  leaflet / referral-code step (old step 4) was removed and steps 5–6 renumbered
  to 4–5; `/referrals` is still linked from the footer and the FAQ. All six old
  Flaer web-dashboard PNGs were deleted and replaced with locale-aware webps
  (`step-{1..4}.{en,cs}.webp` plus a shared `step-5.webp`, since the Instagram
  Story composer is English UI in both locales), driven by a `stepImagesByLng`
  map that mirrors the homepage. The step images are now portrait 1097x1839
  phone mockups rendered `object-contain` in a width-capped box instead of
  16:9 `object-cover` cards, and `StepSection` takes a global index so the
  left/right alternation survives the 3/2 split around the ink band. Every
  `alt` was rewritten in both locales against the new captures. New webps are
  57–171 KB.

- **`/for-customers/how-it-works` screenshots replaced too.** Steps 1, 2, and 4
  now use the Instagram Story composer, the customer-app Prague map, and the
  share detail, as `customers/step-1.webp` (shared) plus
  `customers/step-{2,4}.{en,cs}.webp`, driven by the same `stepImagesByLng`
  pattern. Same portrait `object-contain` treatment; the step 3 "24h" card was
  moved to the matching aspect ratio. Alts rewritten in both locales. The three
  old PNGs, including the 3.8 MB `customers/step-1.png`, were deleted.
- **Footer "Tagly for Business (iOS App)"** now points at the App Store listing
  (`apps.apple.com/cz/app/flaer-for-business/id6752899377`) instead of the
  `flaerads.onelink.me` template. The FAQ still uses that OneLink for its
  inline business-app links.

Open items from this pass: the explainer videos remain pre-rebrand (blocking
item 3).

---

## Components

| Component  | SEO | Design |
| ---------- | --- | ------ |
| Navbar     | ✓   | ↻      |
| Footer     | ✓   | ↻      |
| FaqSection | ✓   | ↻      |
| CtaSection | ✓   | ↻      |
| Button     | ✓   | ↻      |

Every component in `src/components/` is on the Tagly token set: shadows instead
of card borders, ink primaries, warm text tiers, ink focus rings on inputs.
Design is ↻ rather than ✓ because the restyle has not been re-reviewed against
the criteria above.

---

## Known issues

**Images inside `ImageLightbox` are invisible to crawlers.** The component loads
`react-medium-image-zoom` with `next/dynamic` and `ssr: false`, so everything it
wraps is client-rendered. The `<img>` tags never appear in the server HTML, only
the paths in the RSC payload. Users see the images normally; search engines and
AI crawlers do not, so none of this imagery can be indexed and its alt text does
not count toward on-page content.

Affects every page that uses it: `/`, `/how-it-works`, `/restaurants`, `/cafes`,
`/gyms`, `/salons`, `/for-customers/how-it-works`.

Worth revisiting if the imagery should be indexed. The fix is to render the
`next/image` server-side and let only the zoom behaviour be client-side, rather
than wrapping the image in the dynamic component.

---

## Infrastructure

| Item           | Status |
| -------------- | ------ |
| sitemap.ts     | ✓      |
| robots.ts      | ✓      |
| Layout meta    | ✓      |
| Title template | ✓      |
| metadataBase   | ✓      |

ALL DONE 2
