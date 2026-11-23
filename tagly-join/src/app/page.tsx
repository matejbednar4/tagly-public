import { headers } from "next/headers";
import { HOW_IT_WORKS_STEPS } from "@/lib/constants/copy";
import { buildJoinUrls } from "@/lib/buildJoinUrls";
import { parseStickerId, resolveSticker } from "@/lib/resolveSticker";
import { fetchCustomerCount } from "@/lib/fetchPublicStats";
import { TopMenu } from "@/components/TopMenu";
import { EarningsShowcase } from "@/components/EarningsShowcase";
import { WhyWePay } from "@/components/WhyWePay";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { StepCard } from "@/components/StepCard";
// import { HowItWorksVideo } from "@/components/HowItWorksVideo";
import { detectLocale } from "@/i18n/detectLocale";
import { PostHogTracker } from "@/lib/analytics/PostHogTracker";
import { getTranslation } from "@/i18n";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: Props) {
  const query = await searchParams;

  const lng = await detectLocale();
  // Load both namespaces, then bind a precisely-typed t to each.
  const { i18n } = await getTranslation(lng, ["copy", "layout"]);
  const t = i18n.getFixedT(lng, "copy");
  const tLayout = i18n.getFixedT(lng, "layout");

  const ua = (await headers()).get("user-agent") ?? "";
  const isAndroid = /android/i.test(ua);
  const storeLabel = isAndroid ? t("storeLabelAndroid") : t("storeLabelIos");

  // url/code -> url?code=code in next.config.ts, so we can support referral codes without needing a separate landing page for each code
  const referralCode = typeof query.code === "string" ? query.code : null;
  const utmSource =
    typeof query.utm_source === "string" ? query.utm_source : null;
  // Next has ALREADY percent-decoded searchParams — decoding again threw
  // URIError (500, no CTA, referral lost) on any name containing a literal
  // "%" (E065). Use the value as-is.
  const businessName =
    typeof query.business_name === "string" ? query.business_name : null;

  // QR-sticker flow (?utm_source=table-sticker&id=000001): resolve the
  // sticker to its business to personalize the hero and default the referral
  // code. Resolution failures (unknown sticker, timeout, network) fall back
  // to the generic landing; the sticker id still rides the OneLink URLs for
  // attribution.
  const stickerId = parseStickerId(query.id);
  const [stickerBusiness, customerCount] = await Promise.all([
    stickerId ? resolveSticker(stickerId) : Promise.resolve(null),
    fetchCustomerCount(),
  ]);

  // The hero subheading IS the live count, locale-formatted. When there is no
  // real count — the fetch failed (null) or an empty/seed database returned 0
  // — the chip still renders, with a pulsing skeleton pill in the number's
  // slot instead of a "0" (same treatment as the marketing site's hero,
  // 2026-08-08). The page is server-rendered, so the pill resolves on the
  // next successful fetch (Next's 5-min data cache), not client-side. The
  // sentinel marks where the pill goes in the rendered line; it never
  // reaches the reader as text.
  const COUNT_SENTINEL = "•••";
  const countLoading = customerCount === null || customerCount === 0;
  const socialProof = countLoading
    ? COUNT_SENTINEL
    : customerCount.toLocaleString(lng === "cs" ? "cs-CZ" : "en-US");

  // Explicit ?code= wins; otherwise fall back to the sticker business's code.
  const effectiveReferralCode =
    referralCode ?? stickerBusiness?.referralCode ?? null;

  const urls = buildJoinUrls(effectiveReferralCode, stickerId);

  // Two hero variants only. Personalised whenever we know which business sent
  // the visitor: a resolved QR sticker, or ANY `?business_name=` regardless of
  // utm_source (leaflet, IG bio, a partner's own link, whatever comes next) —
  // deliberately not gated on the campaign, so a new print run personalises
  // without a code change. Sticker wins when both are present.
  const heroBusinessName = stickerBusiness?.name ?? businessName ?? null;
  const heading = heroBusinessName
    ? t("heroBusinessHeading", { businessName: heroBusinessName })
    : t("heroDefaultHeading");

  // Split the social-proof line around the count (or the loading sentinel) so
  // the number's slot can be rendered on its own. Done by splitting the
  // RENDERED string rather than putting markup in the translation, which
  // keeps copy.json free of HTML and works whichever side of the number each
  // language puts its words. Falls back to the plain line if the count
  // somehow isn't in it.
  const proofSplit = (() => {
    const line = t("heroSocialProof", { count: socialProof });
    const at = line.indexOf(socialProof);
    if (at === -1) return { before: line, after: "" };
    return {
      before: line.slice(0, at),
      after: line.slice(at + socialProof.length),
    };
  })();

  return (
    <>
      <PostHogTracker
        appEnv={process.env.APP_ENV ?? "development"}
        stickerId={stickerId}
        utmSource={utmSource}
        referralCodePresent={effectiveReferralCode !== null}
        businessResolved={stickerBusiness !== null}
        businessUid={stickerBusiness?.uid ?? null}
      />
      <TopMenu
        lng={lng}
        customerUrl={urls.customer}
        advertiserUrl={urls.advertiser}
      />
      {/* Gutter lives INSIDE the max-w-120 column, exactly as in TopMenu, so
          the bar's items and the page content share one left/right edge at
          every width. With the padding on <main> instead, the column stayed
          480px wide on desktop while the nav's padding ate into its own 480,
          leaving the two misaligned by the gutter. */}
      <main className="min-h-screen flex flex-col items-center">
        <div className="w-full max-w-120 px-(--spacing-page-horizontal-padding) py-(--spacing-section-gap)">
          {/* Hero: heading -> live-count subheading -> store CTA. The heading
              and its subheading are one unit (tight 8px gap), with the 24px
              step below the pair. The chip always renders now (a skeleton
              pill stands in while there's no real count), so the heading's
              gap is always the tight one. */}
          <section className="mb-(--spacing-section-gap) text-center">
            <h1 className="text-style-h1 text-ink mb-(--spacing-tight-gap)">
              {heading}
            </h1>
            {/* Social proof as a chip rather than a line of grey text: same
                words, but a white pill on the cream page reads as a badge you
                notice instead of a caption you skim. White + shadow.chip is
                the design system's "unselected pill" — never a border. The
                count itself is the only ink-coloured part, since Stack Sans
                tops out at 500 so emphasis has to come from colour. */}
            <div className="mb-(--spacing-element-gap) flex justify-center">
                {/* lineHeight 1 is load-bearing: `small-body-bold` carries 1.5,
                    which wraps a 14px glyph in a 21px line box. The extra 3.5px
                    of half-leading sits inside the pill on top of the padding,
                    so the text rides low and the chip looks off-centre even
                    though the padding is symmetric. Collapsing the line box to
                    the glyph makes py-2 mean the same above and below. */}
                <p
                  className="inline-flex items-center gap-(--spacing-tight-gap) rounded-max bg-surface px-(--spacing-card-padding) py-2 text-style-small-body-bold text-text-secondary"
                  style={{ boxShadow: "var(--shadow-chip)", lineHeight: 1 }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-text-tertiary"
                    aria-hidden
                  >
                    <circle cx="9" cy="8" r="3.25" />
                    <path d="M3.25 19.5a5.75 5.75 0 0 1 11.5 0" />
                    <path d="M15.5 5.15a3.25 3.25 0 0 1 0 5.7" />
                    <path d="M17 14.4a5.75 5.75 0 0 1 3.75 5.1" />
                  </svg>
                  <span>
                    {proofSplit.before}
                    {countLoading ? (
                      /* Skeleton pill in the number's slot while the count is
                         unavailable — resolves on the next successful
                         server-side fetch, not client-side. */
                      <span
                        aria-hidden
                        className="inline-block rounded-max bg-divider animate-pulse"
                        style={{
                          width: "2.5em",
                          height: "0.85em",
                          verticalAlign: "-0.05em",
                        }}
                      />
                    ) : (
                      <strong className="text-ink">{socialProof}</strong>
                    )}
                    {proofSplit.after}
                  </span>
                </p>
              </div>
            <div className="flex justify-center">
              <AppStoreBadge href={urls.customer} label={storeLabel} />
            </div>
          </section>

          {/* Owns its own full-bleed track and bottom margin, so no wrapper. */}
          <EarningsShowcase lng={lng} />

          {/* Two CTAs bracket the "why do you get paid" section, deliberately:
              one catches the reader convinced by the earnings alone, the other
              catches the reader who needed the explanation first. Neither sits
              after the steps, which are instructional rather than persuasive. */}
          <div className="mb-(--spacing-section-gap) flex justify-center">
            <AppStoreBadge href={urls.customer} label={storeLabel} />
          </div>

          <WhyWePay lng={lng} />

          <div className="mb-(--spacing-section-gap) flex justify-center">
            <AppStoreBadge href={urls.customer} label={storeLabel} />
          </div>

          {/* How it works — the same four slides the customer app opens with
              (its onboarding carousel), same artwork and same copy, so the page
              and the first screen of the app tell one story. The artwork is app
              screenshots, so it is localized like the copy: Czech frames, with
              English ones taking over per step as they are shot (see
              HOW_IT_WORKS_STEPS). */}
          <section className="mb-(--spacing-section-gap)">
            <h2 className="text-style-h2 text-ink mb-(--spacing-element-gap) text-center">
              {t("stepsHeading")}
            </h2>

            {/* One step per row, stacked — not the 2-column grid this was.
                Half a page column left the artwork too small to read the app
                UI it is showing off; a full-width row gives it 56% of a much
                wider box (see StepCard). */}
            <div className="flex flex-col gap-(--spacing-tight-gap)">
              {HOW_IT_WORKS_STEPS.map((step) => (
                <StepCard
                  key={step.file}
                  kicker={t(step.kickerKey)}
                  title={t(step.titleKey)}
                  description={t(step.descriptionKey)}
                  image={`/images/step-by-step/${
                    lng === "en" && step.hasEnglishArtwork ? "en" : "cs"
                  }/${step.file}`}
                />
              ))}
            </div>

            {/* The 15s explainer used to sit here as an opt-in disclosure. The
                demo video has been removed from the page (asset, player and
                copy keys all deleted — restore from git if it comes back);
                this is where it would go.

            <div className="mt-(--spacing-block-gap)">
              <HowItWorksVideo />
            </div>
            */}
          </section>

          {/* Final CTA */}
          <section className="mb-(--spacing-block-gap) text-center">
            <h2 className="text-style-h2 text-text mb-(--spacing-tight-gap)">
              {t("ctaHeading")}
            </h2>
            <p className="text-style-small-body text-placeholder mb-(--spacing-element-gap)">
              {t("ctaSubheading")}
            </p>
            <div className="flex justify-center">
              <AppStoreBadge href={urls.customer} label={storeLabel} />
            </div>
          </section>
        </div>
      </main>

      {/* Footer — the bookend to TopMenu, and built the same way: a full-bleed
          bar whose CONTENT is capped at the page column (max-w-120), with the
          gutter inside that column so its edges line up with the nav and every
          section between them. It was max-w-325 (1300px), the only element on
          the page wider than the page itself.
          White surface on the cream page, separated by an upward shadow that
          mirrors the bar's downward one — no border line (design system). */}
      <footer
        className="bg-surface"
        style={{ boxShadow: "0px -2px 12px rgba(56, 39, 36, 0.08)" }}
      >
        <div className="w-full max-w-120 mx-auto px-(--spacing-page-horizontal-padding) py-(--spacing-block-gap)">
          {/* Socials + Contact */}
          <div className="flex items-center gap-(--spacing-card-padding) mb-(--spacing-element-gap)">
            <a
              href="https://www.instagram.com/tagly_cz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-placeholder transition-colors duration-150 hover:text-contrast"
              aria-label="Instagram"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
            <a
              href="https://www.tiktok.com/@tagly.cz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-placeholder transition-colors duration-150 hover:text-contrast"
              aria-label="TikTok"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.3z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/taglyapp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-placeholder transition-colors duration-150 hover:text-contrast"
              aria-label="LinkedIn"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect width="4" height="12" x="2" y="9" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
          </div>

          {/* Socials + copyright only. The "For users" / "For businesses"
              columns were four links that read as two — "How it works" and
              "FAQ" appeared under both headings — and all of them (plus the
              Contact link that sat with the socials) pointed at taglyapp.com
              paths that do not resolve. */}
          <p className="text-style-micro text-text-tertiary">
            {tLayout("footerCopyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </>
  );
}
