"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LocalizedLink } from "@/components/ui/LocalizedLink";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useTranslation } from "@/lib/i18n/client";
import { defaultLng } from "@/lib/i18n/settings";

export function Navbar() {
  const params = useParams();
  const lng = (params?.lng as string) || defaultLng;
  const { t } = useTranslation(lng, ["navbar", "common"]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Anchors must match the section ids in src/app/[lng]/page.tsx (English in
  // both locales — they're part of the URL). The contact section is covered by
  // the CTA button below rather than a fifth text link.
  const sectionLinks = [
    { label: t("sections.howItWorks"), href: "/#how-it-works" },
    { label: t("sections.whyTagly"), href: "/#why-tagly" },
    { label: t("sections.examples"), href: "/#examples" },
    { label: t("sections.pricing"), href: "/#pricing" },
  ];

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-background shadow-bar">
      <nav
        className="relative mx-auto flex max-w-page-max-width items-center justify-between px-(--spacing-page-horizontal-padding) py-(--spacing-card-padding) desktop:px-(--spacing-page-horizontal-padding-lg)"
        aria-label="Main navigation"
      >
        <Link href={`/${lng}`} aria-label={t("aria.taglyHome")}>
          <Image src="/tagly-logo.png" alt="Tagly" width={94} height={28} priority />
        </Link>

        {/* Desktop navigation — absolutely centered on the page column (the
            nav spans it), not merely in the leftover space between the logo
            and the CTA, so the links sit on the page's true axis. */}
        <div className="hidden desktop:flex absolute left-1/2 -translate-x-1/2 items-center gap-(--spacing-element-gap)">
          {sectionLinks.map((link) => (
            <LocalizedLink
              key={link.href}
              href={link.href}
              className="text-style-small-body text-text transition-opacity hover:opacity-70"
            >
              {link.label}
            </LocalizedLink>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center desktop:flex">
          <Button
            type="primary"
            size="small"
            label={t("common:getInTouch")}
            href="/#contact"
            className="text-style-small-body-bold"
          />
          {/* element-gap (24px at desktop) — was card-padding (12), which
              glued the picker to the CTA. */}
          <div className="ml-(--spacing-element-gap)">
            <LanguageSwitcher />
          </div>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="cursor-pointer desktop:hidden"
          aria-label={t("aria.openMenu")}
        >
          <Menu size={24} />
        </button>
      </nav>

      {/* Mobile drawer overlay */}
      <div
        className={`fixed inset-0 z-50 desktop:hidden ${mobileMenuOpen ? "visible" : "invisible pointer-events-none"}`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${mobileMenuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={closeMobileMenu}
        />

        {/* Drawer */}
        <nav
          className={`absolute top-0 right-0 bottom-0 w-[70%] max-w-[320px] bg-background flex flex-col transition-transform duration-300 ease-out ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}
          aria-label="Mobile navigation"
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between border-b border-divider px-(--spacing-page-horizontal-padding) py-(--spacing-card-padding)">
            <Link
              href={`/${lng}`}
              aria-label={t("aria.taglyHome")}
              onClick={closeMobileMenu}
            >
              <Image src="/tagly-logo.png" alt="Tagly" width={94} height={28} />
            </Link>
            <button
              onClick={closeMobileMenu}
              className="cursor-pointer"
              aria-label={t("aria.closeMenu")}
            >
              <X size={24} />
            </button>
          </div>

          {/* Drawer content */}
          <div className="flex-1 overflow-y-auto px-(--spacing-element-gap) py-(--spacing-element-gap)">
            {sectionLinks.map((link) => (
              <LocalizedLink
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className="block py-(--spacing-tight-gap) text-style-body-bold text-text"
              >
                {link.label}
              </LocalizedLink>
            ))}

            <div className="mt-(--spacing-element-gap) border-t border-divider pt-(--spacing-element-gap)">
              <LanguageSwitcher />
            </div>
          </div>

          {/* Drawer footer CTA */}
          <div className="border-t border-divider px-(--spacing-element-gap) py-(--spacing-element-gap)">
            <Button
              type="primary"
              size="small"
              label={t("common:getInTouch")}
              href="/#contact"
              fullWidth
            />
          </div>
        </nav>
      </div>
    </header>
  );
}
