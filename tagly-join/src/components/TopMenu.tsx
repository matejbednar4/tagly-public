import { TaglyLogo } from "@/components/TaglyLogo";
import { Button } from "@/components/ui/Button";
import { NavDrawer } from "@/components/NavDrawer";
import { getTranslation } from "@/i18n";
import type { Language } from "@/i18n/settings";

type TopMenuProps = {
  lng: Language;
  customerUrl: string;
  /** Advertiser OneLink — the business CTA hands off to the business app
   *  (store or app), carrying the same referral/sticker params. */
  advertiserUrl: string;
};

export async function TopMenu({ lng, customerUrl, advertiserUrl }: TopMenuProps) {
  const { t } = await getTranslation(lng, "layout");

  return (
    // Bar separation is the apps' soft downward shadow, not a border line
    // (tagly-shared/client/components/navigation/TopMenu.tsx — "No border").
    <nav
      className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm"
      style={{ boxShadow: "0px 2px 12px rgba(56, 39, 36, 0.08)" }}
    >
      {/* Same max width as the page content column in page.tsx, so the bar's
          items line up with the sections under them instead of running wider. */}
      <div className="w-full max-w-120 mx-auto flex items-center justify-between px-(--spacing-page-horizontal-padding) py-(--spacing-tight-gap)">
        <span className="min-w-0">
          <TaglyLogo />
        </span>

        <div className="flex flex-nowrap items-center gap-(--spacing-tight-gap)">
          {/* Primary CTA: the one action the bar carries at any width. */}
          <Button
            type="primary"
            size="small"
            label={t("getTagly")}
            href={customerUrl}
          />

          {/* Everything secondary — the business pitch + CTAs and the language
              picker — lives in the drawer at EVERY width. Previously those were
              inline from `sm` up and collapsed below it, which meant the pitch
              and the meeting CTA only existed on phones. One home, no drift. */}
          <NavDrawer advertiserUrl={advertiserUrl} current={lng} />
        </div>
      </div>
    </nav>
  );
}
