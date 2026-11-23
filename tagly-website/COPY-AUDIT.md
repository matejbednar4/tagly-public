# Copy audit — every page except the landing page

> ## STATUS (2026-08-08, second pass)
>
> **Done and verified against the prerendered HTML in both locales:** all of Tier 0
> (every false money claim), the $100 sign-up bonus removed everywhere, all of
> Tier 1 except the two video/image items, all of Tier 2, and Tier 4 items #56,
> #58, #61, #62, #63, #64, #68. The `/instagram-data-deletion` rewrite (#15) is
> written but **must not ship before the backend deploy** — production still
> rejects `tagly_del_` codes with a 400.
>
> **Deliberately deferred:** all of Tier 3 (images, `alt` text, the two
> pre-rebrand videos), by decision. Every `alt` string is byte-identical to before.
>
> **Closed as not-a-finding:** #22 (share review is never mentioned, by design).
>
> **Third pass (2026-08-08, CS-first terminology + alts):** #38 and #39 (and their
> for-customers twins) FIXED — restaurant alts un-swapped, cafes alt 6 rewritten to
> the waffle-dessert photo actually rendered. #66 RESOLVED — /about now says Prague
> in both locales (per the site CLAUDE.md §4 ruling). The `/contact` "book a call"
> promise removed. Referral copy moved onto the apps' "pozvánky / invite" vocabulary,
> "proplatit/vyplatit/settle" replaced with the apps' "zaplaceno / paid", and the
> $50/$35 per-story cap numbers were removed from the four industry pages per the
> publish-no-cap-number rule in `pricing.{en,cs}.json`.
>
> **Still open, needs your ruling:** #57 (the `blockquote` renderer deletes the CS
> "English version prevails" clause), #65 (tykání vs vykání on 26 CS namespaces),
> #66 (Tampa vs Prague on `/about`), #60 (`@flaer.app` emails, with the Resend
> sharp edge), and the USD-vs-CZK convention. Plus the new disclosure questions
> raised during the rewrite, listed at the bottom of this file.


Date: 2026-08-08. Method: a ground-truth dossier was built by reading the actual
platform code (backend v2 controllers/workers/constants, `tagly-customer`,
`tagly-advertiser`, `tagly-shared`, `docs/`, `tagly-legal/`), then every page's
copy in **both locales** was checked claim by claim against it, and **every image
the site renders was opened and looked at**.

Scope: all 24 non-landing routes, all 29 i18n namespaces (en + cs), all 55 files
in `public/`, plus the two videos (frames extracted).

Originally written as a proposal. Most of it has since been applied. See the STATUS
block above for what is done, deferred, and still open.

Detail per page, with exact i18n keys, `file:line` evidence and shippable EN+CS
rewrites for every item, is in the session findings set:
`how-it-works.md`, `for-customers.md`, `pricing-referrals.md`, `faq.md`,
`restaurants-cafes.md`, `gyms-salons-local.md`, `comparisons.md`,
`company-pages.md`, `legal-pages.md`, `consistency.md`.

---

## Tier 0 — factually false about money. Fix before anything else.

| # | Claim | Where | Reality |
| - | ----- | ----- | ------- |
| 1 | "The maximum reward set by Tagly is **$350**" | `/faq`, `/pricing`, both locales | Per-share cap is **$50 gross (US) / $35 (CZ)**, customer gets **$30 / $21**. `PRICING.ts:15`. $350 is `PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS`, the admin gift ceiling. Wrong constant was read. **7x overstatement.** |
| 2 | "Can my credits go negative? **No.**" | `/faq`, `/pricing` | They can, by design. `settleSharePayoutAndUnlockRemainder.ts:100` draws "past zero" so the customer is always paid in full. **The ToS the business signs says so in bold** (`terms-of-service/en.md:192`). The site promises a financial guarantee the binding contract denies. |
| 3 | "**$20** in credits to appear on the map" | `/pricing` x3, `/faq` x2, `/instagram-ads-vs-tagly`, `/how-it-works` | `$20` is a `@deprecated v1 only` constant. v2: **$50 minimum top-up** (`DEPOSITS_WITHDRAWALS.ts:5`), **$15 available balance** to stay visible (`VISIBILITY.ts:14`). |
| 4 | "No minimum spend / no upfront fees / top up any amount" | `/restaurants`, `/cafes`, `/gyms`, `/salons`, `/local-businesses`, `/faq`, `/pricing` | $50 floor on **every** top-up; $10 gets a 400. Prepaid credits *are* upfront. Only "no contracts / no subscription" is true. |
| 5 | "**$100 sign-up bonus** for new businesses" | `common:signupBonus` (shared namespace) → rendered on `/partners`; also **burned into `explainer.mp4` at 0:48** | No signup bonus, welcome credit or free trial exists anywhere. The only free credit is admin-granted, capped at $350, unreachable by a business. Reality is the opposite: a $50 minimum. Fixing the JSON does not fix the video. |
| 6 | Earnings figures roughly **2x reality** | `/for-customers/faq` ("$7 to $8 per story" for 500 followers) | The estimate pricer gives ~$7.7 **gross**, customer gets 60% → **~$4.60**. The page next door proves it: its own screenshot shows the app offering "est. $4.6". |
| 7 | Three pages state **three different prices for the same thing** | `/pricing` "$20–24 per 1,000 followers" · `/influencer-marketing-vs-tagly` "typically $10 to $15" · `/for-customers/*` "$14–18 earned" | Mutually impossible at the 60/40 split the landing page itself states. |
| 8 | Pay-as-you-go **does not appear on `/pricing` at all** | `/pricing` | PAYG is half the funding model, and its **$0.30 per-charge surcharge is the only fee Tagly discloses in-app**. Omitting it on a page titled "no surprises" is the worst place to omit it. **See "The PAYG fix" below** — this is what lets the no-barrier-to-entry claim survive the $50 correction. |
| 9 | Every cost example uses **US economics** | `/pricing`, `/faq`, all industry + comparison pages, in **both** locales | CZ carries a **0.7x** country multiplier. The CS pages quote identical dollar figures, overstating Czech cost by ~43% and violating the CZK rule in `CLAUDE.md` §4. |

### The PAYG fix — how "no barrier to entry" survives the $50 correction

Agreed direction (Matej, 2026-08-08). The site currently claims no minimum and no
barrier, which is false for credits. Rather than delete the claim, move it onto
pay-as-you-go, where it is **literally true**.

Verified in code: `businessAccessibleSql` (`businessAccessibility.ts:160-168`) gates
visibility on **any one** of three OR-branches, and an open PAYG period is its own
branch. **A business with a linked card and zero credits is visible and shareable.**
The $15 floor applies only to the credits branch.

So `/pricing` should present two funding routes, PAYG first:

- **Pay as you go.** Link a card and you are live. Nothing is charged until a story
  has actually been paid out, and then only for what your credits do not cover.
  **No deposit, no minimum, no subscription.** $0.30 per charge.
- **Credits.** Prepay instead: **1 credit = $1, $50 minimum, and they never expire**.
  Slightly cheaper per story because there is no per-charge fee, and you cannot be
  billed more than you put in.

This keeps the strongest line on the page ("you can start without putting any money
in") while stating the $50 minimum honestly, in the one place it applies.

**Two caveats that must be stated, not buried:**
- PAYG has **no monthly spend cap** in v2. Unlinking the card is the only stop. A
  page that says "no minimum" while implying "no maximum risk" would be the same
  mistake in the other direction.
- A **negative balance hides the business outright** (`businessAccessibility.ts:157`),
  including on PAYG, until credits cover the debt. That is the honest answer to
  Tier 0 #2 and it belongs in the same section.

---

## Tier 1 — mechanics that no longer exist

10. **"Posts and reels", "7 days for posts and reels".** v2 is **Instagram Stories only**, hardcoded (`createShare.ts:121`), and the story must still be live when submitted. A permanent feed post earns nothing. Site-wide: **248 EN uses of "post" against 37 of "story"**. Affects `/faq`, `/how-it-works`, both `/for-customers` pages, all five industry pages, all three comparison pages, both locales. This is the single highest-frequency inaccuracy on the site.

11. **Leaflets, QR codes, table cards.** "Print a Tagly leaflet", "scanned your Tagly leaflet", "heard about Tagly through your leaflet", "leaflet or table card". Deleted in the v2 cull (`tagly-advertiser/CLAUDE.md:326`); `react-native-qrcode-styled` is an orphaned dep with zero call sites. "Table card" never existed. Appears on `/restaurants` (x2), `/cafes` (x3), `/gyms`, `/salons`, `/local-businesses`, `/faq` (x2), `/referrals` (x3).

12. **ROI calculator** (`/faq` `results.q3`) — deleted, with an explicit "don't resurrect this" note at `tagly-advertiser/CLAUDE.md:303`.

13. **"Add or pause budget anytime"** (`/marketing-agencies-vs-tagly`) — there is no pause control anywhere in the advertiser app. Unlinking the card is the only stop.

14. **"See the key factors that drove the price" per share** (`/faq`) — the share detail DTO carries insights, price and void reason. No factor breakdown exists.

15. **`/instagram-data-deletion` tells users to tap two buttons that do not exist.** "Settings → Instagram → Tap *Delete Instagram Data*" and "→ Tap *Deauthorize Instagram*". The v2 screen has exactly one action: **Disconnect account** (`settings/instagram/index.tsx:112`). A repo-wide grep for those labels hits only this website. Worse: **the app's "Manage or delete your Instagram data" link opens this page**, so the two surfaces point at each other and neither performs the action. This is the mechanism Meta's app review checks. Compliance-critical.

    **Resolved direction (Matej, 2026-08-08):** rewrite the page to state the reality, which is three real routes, in this order:
    1. **In the Tagly app** — Settings → Instagram → **Disconnect account**. This is the only in-app action and it is what the app actually offers.
    2. **From Instagram itself** — remove Tagly under Instagram's own apps-and-websites settings, which triggers Meta's deauthorize callback to us. **Link to Instagram's own help article** rather than describing their UI, so the page cannot go stale when Meta moves a menu.
    3. **A deletion request**, which returns a confirmation code and a status URL.

    Two prerequisites before this page ships: the Instagram help URL must be fetched and confirmed live (do not paste a remembered URL), and **the backend must be deployed first** — see #59, production currently rejects `tagly_del_` codes.

16. **Referral payout form is inverted** (`/referrals`). The page says business referrals pay in credits and customer referrals pay in money. Payout form follows the **referrer's** account type, not the referred party's (`findReferrer.ts:96`). A customer who refers a business gets money.

17. **"You earn every time a share is created"** (`/referrals`) — the trigger is **settlement**, ≥24h later, and only if admin-approved, insights captured, no upheld report. Rejected shares pay the referrer nothing. There is no signup bounty.

18. **"Unique referral link and QR code"** (`/referrals`, 3 places) — the QR was removed in v2; both referral screens carry a docblock saying "no leaflet, no QR". The page never mentions the **referral code**, which does exist.

19. **"Sign up with your email and password"** (`/how-it-works`, `/faq`) and **"Log in with your Instagram account"** (`/for-customers/*`). There are no passwords in either app: email OTP / Apple / Google only. Instagram is a separate, skippable connect step.

20. **"Stripe may charge a small fee on instant withdrawals"** (`/for-customers/faq`) — instant payouts were dropped in v2. Payouts are always standard and free, $1.00 minimum, "usually 1 to 2 business days".

---

## Tier 2 — mechanics described wrongly

21. **Three incompatible verification stories on one site.** `/faq` says "Instagram's official API verifies the post exists, is public, and mentions your business"; the customer pages say "location tag"; the industry pages say "tag your gym".

    **Resolved framing (Matej, 2026-08-08):** the implementation is Rekognition OCR, but what it means in practice is that **the customer has to make the business visible on the story, either by tagging/mentioning it or by adding the location sticker**. Both produce rendered text that the check reads, so both work, and so does simply typing the name. Say that, not the implementation.

    Two things still to correct: `/faq`'s "Instagram's official API… verifies the post is public" is wrong (no API metadata is read, and "public" is never checked), and the industry pages' bare "tag your gym" should widen to cover the location sticker, since **that is what 13 of 13 example images on the site actually show**. One phrasing everywhere: *"Tag your business or add the location sticker, so your name is visible on the story."*

22. ~~**The human review gate is invisible on every single page.**~~ **Not a finding. Closed by design decision (Matej, 2026-08-08):** shares we reject never reach the business, so the business does not need to know review exists. Do not add it to any page.

    One knock-on correction still stands: `/for-customers/how-it-works` explains the 24h wait as time that "lets the business take a look at it", which is wrong about who reviews and invites the customer to expect business approval. Reframe on the true reason instead: *"Instagram needs about a day to report how many people saw your story. Once it does, your reward is final."*

23. **"Only pay when a verified post goes live"** — wrong on timing. Settlement is ~24h after creation, once Instagram has been measured. Nothing is charged when the story goes live.

24. **"If the report is valid, you don't pay"** (`/how-it-works`, `/faq` x2) — true only before settlement. After payment there is no clawback; the customer's rating drops instead. **The advertiser app is honest about this where the site is not.**

25. **"Every post comes from someone who lives nearby" / "real customers who visited your business"** (all three comparison pages, `/local-businesses`). `createShare` **takes no location parameter at all**. There is no check-in, receipt, purchase proof or proximity gate.

    **Resolved framing (Matej, 2026-08-08):** the claim is about *who you pay for*, not about who is allowed to share. Anyone can share you, but if they and their followers are far away, the geo multiplier collapses the price to near zero, so **you effectively only pay for local reach**. That is both true and a stronger claim than the current one, because it is the mechanism rather than an assertion. Replace "comes from someone who lives nearby" with *"Anyone can share you. You only pay for the people who could actually walk in."*

    Do not phrase it as a guarantee that sharers are verified local customers, and drop "who visited your business" wherever it implies a checked fact.

26. **"The audience is local by default"** implies a targeting filter. Per #25 it is a **price multiplier**, not a filter: the audience's city vs the business's city, 2.25x at 0 km down to 0.01x at 500 km, and with no audience data a 0.35x penalty. Same rewrite direction as #25.

27. **"Set up once, runs on autopilot" / "nothing to manage"** (all three comparison pages, `/local-businesses`) denies the **forced, non-dismissable rating gate** on every share before its details unlock (once only, no edit window), plus top-up management and the $15 visibility cliff. "No content to approve" is genuinely true; "nothing to manage" is not.

28. **The cafes page's core economic argument is not true.** "Cost per post stays proportional, works even when your average ticket is a $5 coffee" (x2). Price is fully independent of ticket size and margin. The real supporting fact is better and unused: **cafes carry a 0.80x business-type multiplier**, commented "low margins, high volume" (`advertiserTypesCatalog.ts:29`).

29. **"A cafe regular visits 3 to 5 times a week, every latte art photo"** — same business twice within 24h is hard-blocked (error 1514), and the frequency dampener drops the 4th weekly share to 0.55x and the 6th+ to 0.20x. The cafe pitch rests on a cadence the product caps.

30. **"Do I have to buy something? Yes"** (`/for-customers/faq`) states a requirement nothing enforces and the Terms do not impose.

31. **"You never need to mention Tagly, your followers will not know"** directly contradicts the ToM clause making the user responsible for legally required paid-promotion disclosures.

32. **Disconnecting Instagram cancels every unpaid share.** The app warns about this; the site says only "you cannot submit new posts".

33. **Reporting claims outrun the product.** The advertiser app has account-level **lifetime** totals only (reach, shares, spend, avg price, credits) plus per-share stats. There is **no local-reach metric, no CPM, no cost-per-view, no per-location breakdown, no charts, no date ranges**. Several pages imply otherwise.

34. **"First posts within days of signing up"** (`/marketing-agencies-vs-tagly`) — an unsupported results guarantee, and the ToM explicitly binds illustrative figures.

35. **Five unsourced statistics presented as fact** on `/restaurants` and `/cafes` alone ("500 people within a 10-minute drive", "200 within walking distance", "3 to 5 times a week", "food is one of the most shared content on Instagram", "ad CAC exceeds first-visit spend"), plus every competitor figure on the comparison pages ($100–$10,000 influencer rates, $1,000–$5,000 retainers, 3–12 month contracts, the 50,000/200 follower split). All invented. Either cite or cut.

---

## Tier 3 — images vs the copy beside them

Every image on the site was opened and inspected.

### Wrong image, or alt describing a different image

36. **`/how-it-works`: 3 of 5 alt strings describe a different screenshot than the one rendered.** `s2` ("Purchase credits") renders the **Instagram Story composer** while its alt describes the wallet screen; `s5` ("Rate posts") is the exact inverse, rendering the wallet screen. `s3` ("users discover you") renders a **payment receipt**, and its alt describes a **Prague map screenshot that does not exist in `advertisers/` at all**. Both locales. The landing page's alts for the same files are correct, which localises the bug to `how-it-works/page.tsx:33-37`.

37. **`/for-customers/how-it-works`: both step-4 alts quote numbers that are not in the image.** EN alt says "$4.6" where the screen reads **$4.2**; CS alt says "97 Kč / 193 dosahů" where the screen reads **114 Kč / 241**. Page step order also does not match file numbering (step 1 → `step-2.webp`), and `step-4.webp` ships in both locales but is **never rendered**.

38. **`/restaurants`: `alts[1]` and `alts[3]` are swapped**, both locales. Tile 2 is pizzas at "Italian Corner"; tile 4 is steak at "Joe's Steak House".

39. **`/cafes`: `alts[5]` describes an image that is not on the page.** It describes `cafes/10.png` (acai bowls, tropical) while the tile renders `cafes/6.png` (waffle dessert). **`cafes/10.png` is a 4.8 MB orphan referenced nowhere.**

### Old brand still user-visible

40. **`explainer-preview.png`** (the landing hero video poster) reads **"How flaer works for businesses"** in the pre-rebrand wordmark, with a **v1 web dashboard** on the monitor behind the subject. This is the only surviving user-visible "Flaer" brand string on the site, and it is above the fold on the homepage.

41. **`/demo` plays a pre-rebrand video that names the retired brand.** Frames extracted from `how-it-works-compressed.mp4`: at **0:05** the old orange lowercase "flaer" splash with the caption **"then open the Flaer app"**; at **0:08–0:13** the **v1 orange customer app** showing "Create Share", "Cash out" and **"Posts & Reels"**. It is also a customer-side walkthrough sitting on a business page, English-captioned on `/cs`, with no CTA, and nothing on the site links to it. **Recommend unpublishing `/demo` until re-shot.**

### Czech users are served English or contradictory screens

42. **`step-2.webp` is byte-identical across all four locale folders** (sha256 `07b1e85a…`). The Czech pages serve **English Instagram chrome** ("Add a caption…", "Your story"). The code comment claiming both locale folders are complete is wrong.

43. **The Czech screenshots contradict each other.** `customers/cs/step-3` shows a **114 Kč reward against an 82 Kč estimate** (reward larger than the estimate) with 241 reach, while its EN twin shows $4.2 / 193 / est. $4.6 — unrelated data. The same $4.6 renders as **104 Kč** on the map and **97 Kč** on the share screen. `advertisers/cs/step-5` shows "$300 ≈ 6 296 Kč" (USD-primary) while `cs/step-3` is CZK-primary. One set, three currencies conventions.

### Imagery that undercuts the copy

44. **Tagly staff are presented as customers.** `restaurants/1.png` and `/4.png` carry mention stickers for **@eduard_koran** and **@stepan_mruzek**; `gyms/3.png` carries @eduard_koran again. Marketing lead and sales lead, shown as diners and gym members.

45. **`/gyms`: 3 of 4 images are empty rooms** with no member and no workout, under a heading promising "gym selfies, progress photos, before-and-afters".

46. **`/salons`: both images are nails**, on a page whose use cases are barbershops, colourists *and* nail salons. Two of three use cases have zero visual support, and the two hands look like the same person. The grid CSS is sized for 6 tiles, so the section renders two-thirds empty.

47. **`/local-businesses` renders zero images** — the only industry page with none.

48. **All 13 restaurant/cafe story images tag via location sticker**, while the copy says "tag/mention". Compatible with the OCR check, but the vocabulary should be unified on "make your name visible" (see #21).

49. **Market mismatch throughout.** Invented US names ("Joe's Steak House", "Daily Grind Cafe", "Jane's Salon", "Mania Gym"), two cafe images are tropical resorts (infinity pool, palm trees), and only `cafes/1.png` contains any Czech. The site's market is Prague.

50. **5 of the 12 industry tiles are reused on `/` and `/for-customers/how-it-works`**, against the "industry pages must not be clones" rule.

### Asset hygiene

51. **~72 MB of photographic PNGs.** `/cafes` and `/restaurants` ship ~25 MB each. The same repo already uses WebP and JPEG correctly elsewhere.
52. **Orphans:** `cafes/10.png` (4.8 MB), `tagly-mark.png`, both `customers/*/step-4.webp`, and `public/videos/animations/*.mp4` (3 files, pre-rebrand).
53. **Team photos are four unrelated genres** — a Rome holiday snap, a **USF athletics roster headshot carrying another organisation's crest and adidas branding**, an outdoor portrait, and a school photo on a pink backdrop. Sizes span 380px to 2000px; `eduard-koran.jpg` is **3.4 MB for a 96 px avatar**.
54. **Partner logos span four aspect ratios and a 65x weight range**, and **all four partners are Tampa-area businesses** ("Alimento 813" is the Tampa area code) on a site whose market is now Prague. The entire social proof section points at the old market.
55. **Good news:** `og-image.png` is clean. Decoded to raw RGB it is 92.37% butter, 5.36% ink, **zero pixels above (245,245,245)**. The white-rectangle artifact recorded in `tracking.md` is gone; that entry is stale.

---

## Tier 4 — structural and technical

56. ~~**The Privacy Policy's tables do not render.**~~ **FIXED 2026-08-08.** `remark-gfm@4.0.1` added and wired into `LegalDocPage`, with `table`/`tr`/`th`/`td` renderers styled from the design tokens (`border-border-strong` header rule, `border-divider` row separators, per the table rules in `CLAUDE.md`) and an `overflow-x-auto` wrapper so a wide table scrolls itself rather than the page. Verified against the prerendered HTML in both locales: **3 `<table>`, 10 `<th>`, 67 `<td>` each, zero literal `|---|` leaks**, with real cell content asserted (`Stripe`, `30 days`/`30 dní`, `Retention`/`Uchovávání`, `Legal basis`/`Právní základ`) and a negative control confirming the two table-free documents still render 0 tables.
57. **`blockquote: () => null`** (`LegalDocPage.tsx:24`) silently deletes the Czech **"English version prevails"** notice from all three CS legal pages. That is the clause establishing which language governs, and `tagly-legal/CLAUDE.md` requires it. Verified absent: `grep -c "výkladových rozporů"` → 0, 0, 0.
58. **`FaqSection` emits a separate `FAQPage` JSON-LD block per section**, so `/faq` ships **five competing FAQPage entities on one URL**. Should be one entity with all 23 questions. This matters more than usual here because the false answers in Tier 0 are the ones search engines and AI assistants quote verbatim.
59. **Live check (read-only):** `api.taglyapp.com/webhooks/instagram/deletion-status` accepts `flaer_del_…` (200) but **rejects `tagly_del_…` (400)**, and still renders "Flaer" + `legal@flaer.app`. The deployed backend predates the rebrand; the repo code is correct. Deploy the backend **before** publishing rewritten data-deletion copy.
60. **Every published email is still `@flaer.app`** (`hello@`, `legal@`, `support@`, `sales@`). All still receive, so this is brand consistency rather than an outage — but `/contact` shows `legal@flaer.app` while `/terms-of-service`, rendered by the same site, says `legal@taglyapp.com`. **Sharp edge:** do not swap the API `from:` in the same pass. `flaer.app` apex is a verified Resend domain and `taglyapp.com` apex is not, so a naive swap 500s both forms. Use `noreply@mail.taglyapp.com`. **API `from:` FIXED 2026-08-09** (the apex swap had already landed in `5bf5779d` and would have 500'd both forms on the next deploy): both routes now import `WEBSITE_FROM_EMAIL` from `src/lib/contact-inboxes.ts`, pinned to `noreply@mail.taglyapp.com` with the reasoning in a comment there. Confirmed against DNS: the `taglyapp.com` apex has no Resend DKIM and no `send.taglyapp.com` return-path, only Zoho's records. The published-copy half of this item (still-`@flaer.app` addresses) is unchanged and still open.
61. **Dead navbar link:** `#odmena-za-story` no longer exists (the landing rewrite renamed the section to `cena-sdileni`). The fourth nav item is broken in both locales.
62. **`/partners` is missing from `sitemap.ts`** despite being indexable and footer-linked.
63. **`pricing.q1Inline` is dead code** — `faq/page.tsx:82` only wires index 3, so that inline link never renders in either locale.
64. **`footer/cs:48` says "Podmínky služby"** — a forbidden synonym; canonical is **"Obchodní podmínky"**, and it contradicts the page it links to. Cookie bar also uses lowercase "privacy policy" / "zásadách…".
65. **CS register split.** `tagly-website/CLAUDE.md` §3 mandates **tykání**. Measured: the landing page is 0 vykání / 25 tykání markers; **all 26 other CS namespaces vykají.** The SEO pages are the deviation, not the landing page.
66. **`/about` still says Tampa** in `meta.description`, `story.p2` and `team.intro`, against `CLAUDE.md` §4 (home market is Prague). CS `/about` also declines Tagly as masculine ("Tagly vznikl / je jiný / byl spuštěn") against the house rule of indeclinable neuter ("Tagly vzniklo").
67. **`/contact` promises "book a call"** and no scheduler exists. `/contact-sales` says "send us a message" while `message` is optional and **phone is mandatory**. "Most messages get a response the same day" is a statistic about data that is never collected.
68. **`/careers` `meta.description` still says "looking for people"** while the body correctly shows the no-open-positions empty state.
69. **No Play Store link anywhere** despite both apps shipping on Android. The business-app OneLink is a legacy `flaer*` host (browser-only for v2), and the App Store listing is still branded "Flaer for Business".

---

## Legal documents vs shipped behaviour (for the legal owner, not a website fix)

About 25 document claims were spot-checked and found accurate, including the
reservation multiple, negative-balance policy, credit forfeiture on deletion, the
$1 minimum and the P2B ranking disclosure. Three mismatches:

- **ToM "up to five attempts"** for Instagram insights vs `IG_INSIGHTS.maxAttemptsPerJob: 4`
  (`IG_INSIGHTS.ts:48`). The *snapshot* worker is 5, likely the source of the error.
- **PP §15.9 "We make reasonable efforts to verify age"** — there is **zero** age or
  date-of-birth code anywhere in the product.
- **ToM §12.2 "withdrawals are made in USD"** — a CZ Connect account receives
  Stripe-converted **EUR**, with the customer absorbing the FX fee
  (`createStandardWithdrawalPayoutOrThrow.ts:113`).

And the constraint that governs every number in Tier 0: ToM `en.md:170` — *"Illustrative
figures in the app or on our websites are informational only. Rewards vary
significantly and some Shares earn nothing."*

---

## What holds up

Worth recording so it does not get re-litigated:

- **The web-dashboard purge held.** No page in either locale mentions a dashboard,
  campaigns, targeting, scheduling, spend caps, pausing, content briefs,
  verification badges or pre-approval. `/local-businesses`' "no campaigns to
  manage, no targeting to optimize" is exactly right.
- **The referral rates are all numerically correct**: 16% / 8% / 8% / 4%, 6-month
  boost, 24% stacked. Only the mechanics around them are wrong (#16, #17, #18).
  Tagly's own take is correctly never disclosed, though "24% stacked" does let a
  reader derive that Tagly keeps at least 24%. Your call, not a bug.
- **The `worksWell` sections on all three comparison pages are genuinely balanced**
  and satisfy the honesty rule in `CLAUDE.md`.
- **Both forms exactly match their APIs**, field for field.
- **`/careers`** empty state is correct in both locales with no dead form or API
  references, and makes no compensation, equity or benefits claims.
- **The canonical Privacy Policy §9.3 is correct** — all three of its Instagram
  data mechanisms were verified against code. It is the *website* page (#15) that
  is wrong, not the document.
- **`og-image.png` is clean** (#55).
- **All external links resolve.** The business-app OneLink reaches the correct App
  Store ID 6752899377.

---

## Suggested order of work

Revised 2026-08-08 after Matej's review. **Images move to last, by decision.**

0. ~~#56 Privacy Policy tables.~~ **Done.**
1. **Tier 0, including the PAYG restructure of `/pricing`.** False money claims are
   exposure, not polish. One pass over `pricing.{en,cs}.json`, `faq.{en,cs}.json`
   and `common.{en,cs}.json`, both locales. Delete `common:signupBonus` and
   `signupBonusShort` outright (see the note below: `/partners` is gone, so they are
   now dead strings carrying a false claim).
2. **#15 `/instagram-data-deletion`.** Compliance surface, and the app links to it.
   Blocked on the backend deploy (#59) and on confirming the Instagram help URL live.
3. **#10 "post" → "story", site-wide.** The largest single edit and the one that makes
   everything else coherent. Do it as one mechanical sweep across all namespaces.
4. **Tier 1 remainder** — delete leaflets/QR, the ROI calculator, "pause budget",
   password signup, Instagram login, instant withdrawals; fix the referral mechanics
   (#16, #17, #18).
5. **Tier 2** — the mechanic rewrites, with the framings resolved in #21, #25 and #26.
   Highest-value is #25, repeated across all three comparison pages.
6. **Tier 4 technical** — #57 and #58 (the CS governing-language clause and the five
   competing FAQPage entities), then links and metadata (#61–#64, #66–#69).
7. **Tier 3 images, last.** #36–#39 and #42 are cheap alt/asset corrections; #40 and
   #41 are the last two places the retired brand is visible; the rest is re-shooting
   Prague imagery, the salon/gym coverage gaps, and compressing ~72 MB of PNGs.

## Repo changes since this audit was written

The site was restructured by a parallel session on 2026-08-08. Findings are
unaffected — every false claim above survived the move and was re-confirmed in place
— but **the file paths in the per-page findings files are stale**:

- **i18n is now colocated.** `src/lib/i18n/locales/<ns>/<lng>/<ns>.json` became
  `<ns>.{en,cs}.json` next to the page or component, registered in
  `src/lib/i18n/resources.ts`. `common` and `comparison` stayed central under
  `src/lib/i18n/`. So e.g. `/pricing`'s copy is now
  `src/app/[lng]/pricing/pricing.{en,cs}.json`.
- **`/contact-sales` and `/partners` were removed** (301s in `next.config.ts`; the
  contact form moved to the landing page at `/#contact`). This retires findings #67
  (contact-sales form/phone mismatch) and the `/partners`-specific parts of #5 and
  #54 — but **`common:signupBonus` still exists** and still says "$100 sign-up bonus",
  so #5 is now a dead-string cleanup rather than a live falsehood. The Tampa partner
  logos went with the page.
- Confirmed still present after the move: `$350` and `$20` in
  `pricing.{en,cs}.json`, `faq.{en,cs}.json`, `how-it-works.en.json` and
  `instagram-ads-vs-tagly.en.json`.

## Decisions only you can make

- **Prague vs Tampa.** `tagly-website/CLAUDE.md` §4 says the home market is now
  Prague; the global `FLAER.md` still says Tampa. `/about` and all four partner
  logos are Tampa. Rewrites are drafted in the Prague direction but not applied.
- **CZK vs USD in examples.** The site CLAUDE.md says CZK; the product is USD end
  to end (USD ledger, "1 kredit = $1" even in Czech, CZK is a live-rate display
  conversion). The drafted CS rewrites keep the dollar figure plus "shown in
  koruna at the current rate", which is accurate and cannot go stale. Needs a ruling.
- **Tykání vs vykání on the SEO pages** (#65). 26 namespaces would have to change.
- **Whether to disclose the 40% take rate at all.** It is currently never shown,
  in the apps or on the site.

---

## New disclosure questions raised during the rewrite (2026-08-08)

Each of these is a business call, not a factual error. Copy currently ships in the
state described; each is a one-line reversal.

1. **The per-1,000 base rate is now published nowhere.** `/faq` briefly stated
   "$25 per 1,000 reached, or $17.50 in Czechia". It was removed for consistency:
   `/pricing` and the customer pages had independently declined to publish it, and
   applying $25/1,000 to `/pricing`'s own real example (152 reach, about $7) gives
   $3.80, so the two pages would have visibly disagreed. `/faq` now explains the
   drivers instead. Reversible if you want the rate public.
2. **The $50 / $35 per-story ceiling is now published** on `/pricing`, `/faq`,
   `/how-it-works`, the industry pages and the influencer comparison. The site
   never stated a cap before. It replaced the false $350 and the invented
   "$10 to $15", so something had to fill the gap.
3. **The cafes page now rests on the 0.80x cafe business-type multiplier**
   ("priced about 20 percent below the rest of food and drink"). True today
   (`advertiserTypesCatalog.ts:29-33`), but it publishes an internal pricing lever
   that customers will hold you to. It replaced the false "works even when your
   ticket is a $5 coffee" argument, so if you pull it that section needs a new one.
4. **`/gyms` and `/salons` describe their business-type multipliers qualitatively**
   (sport and fitness slightly above baseline, beauty and wellness at the top). No
   numbers published. Same question as 3, in a milder form.
5. **The referral base noun was corrected from "of the reward" to "of the story
   price"**, which is what the code actually computes (`platformFee x referrerBps`,
   where the fee is 40% of gross). This is more accurate but it sharpens the
   inference from the "24% stacked" figure: a reader can now derive that Tagly
   keeps at least 24% of the story price. The 24% was left in place as instructed.
   **Knock-on:** both apps' referral cards still say "of what they make", which is
   now inconsistent with the site and imprecise. Worth a matching app fix.
6. **The frequency dampener is now disclosed to customers** ("rewards get smaller
   for each extra story in a short window"). True, and it prevents a bad surprise,
   but the site had never said it.
7. **Customer earnings ranges were cut, not halved.** "$7 to $8" and "$14 to $18"
   are gone; the page lists the real drivers, the 60% share and the caps instead.
   If you want a concrete anchor back, the defensible one is about $4 to $5 for
   500 mostly-local followers, labelled as an estimate.
