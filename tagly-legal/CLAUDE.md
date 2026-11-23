# tagly-legal — Legal Documents (Canonical Source)

This folder is the **single source of truth** for Tagly's user-facing legal
documents. The website ([tagly-website/](../tagly-website/)) reads these files
directly at build time (`tagly-website/src/lib/legal-docs.ts`) — there is no
published copy anywhere; every change starts and ends here. (History: the old
public `flaer-legal-docs` repo was deleted 2026-08-07; the standalone
`Flaer-Inc/marketing-site` repo's `new-legal-docs/` copies and the cross-repo
sync workflows were retired 2026-08-08 when the site moved into this monorepo
as `tagly-website/`.)

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../CLAUDE.md).

## Structure

```
tagly-legal/
├── privacy-policy/         en.md + cs.md
├── terms-of-service/       en.md + cs.md
└── terms-of-monetization/  en.md + cs.md
```

One folder per document, one markdown file per locale (`en.md`, `cs.md`). The
marketing site renders these files as-is (markdown → HTML), so plain GitHub-
flavored markdown only — no HTML, no front-matter.

## Canonical document names

Every user-facing surface (app copy, emails, push/notification labels, the
join page, the marketing site, and the documents themselves) uses exactly
these names — never a variant, abbreviation, or synonym:

| Document               | URL slug                | EN canonical           | CS canonical                     |
| ---------------------- | ----------------------- | ---------------------- | -------------------------------- |
| Terms of Service       | `terms-of-service`      | Terms of Service       | Obchodní podmínky                |
| Terms of Monetization  | `terms-of-monetization` | Terms of Monetization  | Podmínky monetizace              |
| Privacy Policy         | `privacy-policy`        | Privacy Policy         | Zásady ochrany osobních údajů    |

Usage rules:

- **EN:** always the full name, capitalized as a proper noun — even
  mid-sentence ("I agree to the Terms of Service"). Never bare "Terms",
  never lowercase. The design system's sentence-case rule governs UI copy,
  not document titles.
- **CS:** decline the name as the sentence requires, but keep the first word
  of the title capitalized to mark it as the official document name
  ("souhlasíš s Obchodními podmínkami", "Přečetl/a jsem si Zásady ochrany
  osobních údajů"). Declension reference:
  - Obchodní podmínky → Obchodních podmínek / Obchodním podmínkám /
    Obchodních podmínkách / Obchodními podmínkami
  - Podmínky monetizace → decline only "Podmínky" (Podmínek monetizace,
    Podmínkami monetizace, …)
  - Zásady ochrany osobních údajů → decline only "Zásady" (Zásad ochrany
    osobních údajů, Zásadami ochrany osobních údajů, …)
- **Follow-up references:** once a sentence or message has named the document
  in full, a generic unambiguous back-reference is fine ("the updated terms",
  "aktualizované podmínky", "these Terms").
- Internal identifiers (i18n keys like `termsOfService`, slugs like
  `c.legal.tos-updated`, code names `tos`/`tom`/`pp`) are not user-facing and
  are exempt.

**App names** (same lockstep rule): the customer app is **"Tagly"**; the
advertiser app is **"Tagly Partner"** — one name everywhere: full references
(also in Czech copy — "Partner" is not translated or declined), the
home-screen label, and the App Store listing
(`tagly-advertiser/app.config.ts` `displayNames`/`bundleNames`). Never
"Tagly Business", "Tagly Ads", or bare "Partner"; "Tagly for Business",
"Business" (both pre-2026-08-10), "Flaer Ads" / "Flaer for Business" are
historical only.

## Czech glossary (legal documents — decided with Matej, 2026-08-07)

Czech legal docs use **vykání** (apps tykají — deliberate register split), carry
the EN-precedence note under the date block, and use these defined terms:

Share = **Sdílení** · Advertiser = **Podnik** (party; "Podnikatel" only in the
P2B/EEA trader context) · User = **Uživatel** · Business Page = **Stránka
podniku** · Eligible Content = **Způsobilý obsah** · Estimated/Final Reward =
**Odhadovaná/Finální odměna** · Estimated/Final Price = **Odhadovaná/Finální
cena** · Credits = **Kredity** · PAYG = **Průběžné platby** · Insights =
**Statistiky** · Referral Program = **Program doporučení** · Tagly Platform Fee
= **Poplatek platformy Tagly** · Platform Rules = **Pravidla platformy** ·
Monetization Program = **Program monetizace** · Service = **Služba** · Fraud =
**Podvodné jednání** · Content = **Obsah** · Instagram Data = **Data z
Instagramu** · Account = **Účet**.

Recurring nouns follow the app glossary: story (English, indeclinable neuter;
pl. stories) · odměna · výdělky/vydělat · zůstatek · výběr/vybrat (never
„výplata") · dobít kredity · vyrovnat/záporný zůstatek · kontrola/schválit/
zamítnout · nahlásit/nahlášení · hodnocení (kvality) · dosah · sledující ·
publikum · monetizovat · dotovaný (Tagly) · připojit/odpojit Instagram ·
ověřovací kód · oznámení (concept) / push notifikace (channel) · podpora ·
Stripe indeclinable („ve Stripe") · EHP for EEA.

## Document template

All three documents share the same skeleton, in this order (CS mirrors EN
section-for-section):

1. **Title** — `# Tagly <Canonical Name>` (brand is Tagly; the contracting
   entity below stays Flaer, Inc.)
2. **Date block** — `**Effective date:** …` + `**Last updated:** …`
3. **Plain-language summary** — short bullet overview, explicitly marked
   non-binding ("This summary is for convenience only…")
4. **Who we are** — identical block in all three: Flaer, Inc., Delaware
   C-Corporation, registered address, the apps the document covers
5. **Definitions** — the **Terms of Service holds the master list**; the
   other two documents reference it and define only their doc-specific terms.
   Never redefine a term another document already defines.
6. **Body sections** — numbered continuously (no gaps)
7. **Changes to this document**
8. **Contact** — identical block in all three (legal contact email + postal
   address)
9. **EEA / Czech Republic supplement** — always the final section

## Cross-references between documents

When one document refers to another, use the canonical name and link to the
live URL (`https://www.taglyapp.com/<slug>`).

## Publishing flow

The website lives in this monorepo (`tagly-website/`) and reads the six files
here directly during its static build — publishing a legal change is simply
merging it to `main` and the site deploying. **The `main` merge is the publish
gate.** The old cross-repo sync machinery (`staging-legal-sync.yml` /
`production-legal-sync.yml`, added 2026-08-07) was removed 2026-08-08. It
never actually functioned: the `MARKETING_SITE_SYNC_TOKEN` Actions secret was
never created (verified 2026-08-08 — absent at repo + environment level, and
both staging runs failed with "Input required and not supplied: token"), and
the production workflow never existed on `main`. Nothing remains to clean up
unless a matching fine-grained PAT exists in Matej's GitHub account.

**⚠️ Interim state until Amplify is repointed at this monorepo:** the live
site (taglyapp.com / flaer.app) still deploys from the standalone
`Flaer-Inc/marketing-site` repo. Until the Amplify app is reconnected to this
repo (approval-gated devops step), a legal change merged here does NOT reach
the live site automatically — publish it by manually copying the changed
files into that repo (`new-legal-docs/english/<doc>.md` /
`new-legal-docs/czech/<doc>.cs.md`) via PR. Delete this paragraph when the
repointing is done.

**Repointing checklist item — rebuild triggering:** Amplify monorepo
build-skipping decides from the git diff under the app root
(`tagly-website/`), not from what the build reads. A commit touching only
`tagly-legal/` can be skipped even though the built pages would change.
When repointing, either configure the trigger to also watch `tagly-legal/`
or leave diff-based build-skipping off, and VERIFY with a docs-only commit
that a site build actually runs.

## Rules for editing

- **Code and terms move together.** Any PR that changes what the platform
  actually does in a legally relevant way — data collected, third parties,
  retention, reward/credit mechanics, payout rules, eligibility — must update
  the affected document in the same PR. Drift between code and legal text is a
  bug.
- **Brand vs legal entity.** The consumer brand is **Tagly**; the legal entity
  remains **Flaer, Inc.** (Delaware). Contracting party, copyright lines, and
  entity references stay "Flaer, Inc."; product/brand references use Tagly.
- **EN and CS stay in lockstep.** Every content change lands in both locales in
  the same PR, section-for-section. EN is the authoritative version in case of
  conflict (and the docs say so).
- **Bump "Last updated"** in every changed document (both locales), and keep
  the effective date rules consistent with what the document itself promises
  about notice periods (e.g. P2B 15-day notice for Advertiser-affecting
  changes in the EEA).
- **Versioned acceptance.** The backend records ToS / Privacy Policy acceptance
  per version (`agreeWithTos` / `agreeWithPrivacyPolicy`). When a change is
  material enough to require re-acceptance, coordinate the version bump with
  the backend constants in the same PR.
- **Old URLs keep working.** The docs are served at
  `taglyapp.com/{privacy-policy,terms-of-service,terms-of-monetization}` and
  the legacy `flaer.app/...` equivalents (baked into shipped v1 builds, store
  listings, and the Meta developer console). Never remove or rename a served
  path.
