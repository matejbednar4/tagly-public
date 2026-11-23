"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SALES_URL } from "@/lib/constants/links";
import { languages, LOCALE_COOKIE, type Language } from "@/i18n/settings";

type NavDrawerProps = {
  advertiserUrl: string;
  current: Language;
};

/**
 * The nav drawer, at EVERY width — the web twin of the apps' `SideDrawer` +
 * `TopMenu` hamburger (tagly-shared/client/components/{drawer/SideDrawer,
 * navigation/TopMenu}.tsx). Deliberately mirrored, not reinvented:
 *
 *  - the icon morphs menu -> close by rotating 90deg while cross-fading the
 *    two glyphs, over MORPH_MS (the apps' 220ms `withTiming`)
 *  - the panel slides in from the RIGHT and is CLIPPED to the region below the
 *    nav bar, so it never paints over the bar and never looks like a dropdown
 *    floating at a random offset
 *  - a warm ink scrim fades in behind it; tapping it (or Escape) closes
 *  - the panel is cream `background`, not white `surface` — same as the apps'
 *    drawer, so its white children (the CTA) still separate from it
 *
 * Rendered in a portal so the sticky nav's stacking context can't clip it.
 *
 * It is NOT phone-only. The drawer carries the business pitch and the meeting
 * CTA, which don't fit in a nav bar, so gating it behind `sm` meant desktop
 * silently lost that content. One drawer at every width = one place for the
 * secondary nav, and no copy that exists at one breakpoint but not another.
 */

const MORPH_MS = 220; // icon menu <-> close, matches the apps' withTiming
const OPEN_MS = 260;
const CLOSE_MS = 200; // matches SideDrawer's CLOSE_DURATION
const PANEL_MAX_WIDTH = 320; // DRAWER_MAX_WIDTH in SideDrawer.tsx

export function NavDrawer({ advertiserUrl, current }: NavDrawerProps) {
  const { t, i18n } = useTranslation("layout");
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // `open` is intent; `mounted` keeps the panel in the DOM through the close
  // animation; `shown` drives the transition targets (flipped a frame after
  // mount so the browser has a "from" state to animate out of).
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  // The bar is sticky at top:0, so its bottom edge is a fixed viewport offset —
  // measured rather than hardcoded, since the nav owns its own height.
  const [navBottom, setNavBottom] = useState(0);

  useEffect(() => {
    const nav = buttonRef.current?.closest("nav");
    if (!nav) return;
    const measure = () => setNavBottom(nav.getBoundingClientRect().bottom);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames: one to commit the mounted "from" state, one to flip to it.
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShown(true)),
      );
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Escape closes, and the page behind the drawer must not scroll with it.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [mounted]);

  function selectLanguage(lng: Language) {
    // Persist the choice; detectLocale() reads this cookie before Accept-Language.
    document.cookie = `${LOCALE_COOKIE}=${lng};path=/;max-age=31536000;samesite=lax`;
    i18n.changeLanguage(lng);
    router.refresh();
    setOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("menuLabel")}
        aria-expanded={open}
        className="flex items-center justify-center shrink-0 min-w-11 min-h-11 text-ink cursor-pointer"
      >
        {/* Hamburger and close stacked, rotating together while they cross-fade
            — the apps' menuRotateStyle / hamburgerStyle / closeStyle. */}
        <span
          className="relative block w-6 h-6"
          style={{
            transform: `rotate(${shown ? 90 : 0}deg)`,
            transition: `transform ${MORPH_MS}ms ease-out`,
          }}
          aria-hidden
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="absolute inset-0"
            style={{
              opacity: shown ? 0 : 1,
              transition: `opacity ${MORPH_MS}ms ease-out`,
            }}
          >
            <path
              d="M3 6h18M3 12h18M3 18h18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="absolute inset-0"
            style={{
              opacity: shown ? 1 : 0,
              transition: `opacity ${MORPH_MS}ms ease-out`,
            }}
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>

      {mounted &&
        createPortal(
          // Clipped to below the bar: the panel slides in *inside* this box, so
          // it can never overlap or shadow the nav above it.
          <div
            className="fixed left-0 right-0 bottom-0 z-40 overflow-hidden"
            style={{ top: navBottom }}
          >
            {/* Warm ink scrim — the apps' rgba(56,39,36,0.4). Tap to close. */}
            <button
              type="button"
              aria-label={t("menuLabel")}
              onClick={() => setOpen(false)}
              className="absolute inset-0 w-full h-full cursor-default"
              style={{
                backgroundColor: "rgba(56, 39, 36, 0.4)",
                opacity: shown ? 1 : 0,
                transition: `opacity ${shown ? OPEN_MS : CLOSE_MS}ms ease-out`,
              }}
            />

            {/* Flush to the RIGHT EDGE OF THE VIEWPORT at every width, like the
                apps' drawer — deliberately not aligned to the max-w-120 content
                column, which would leave it floating mid-screen on a wide
                monitor. `overflow-hidden` on the parent parks it out of sight
                while closed. */}
            <div
              className="absolute top-0 bottom-0 right-0 w-[70%] bg-background flex flex-col p-(--spacing-card-padding) gap-(--spacing-card-padding)"
              style={{
                maxWidth: PANEL_MAX_WIDTH,
                transform: shown ? "translateX(0)" : "translateX(100%)",
                transition: `transform ${shown ? OPEN_MS : CLOSE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                // Inset top = the bar casting down onto the drawer; left edge
                // separates it from the scrim. Straight from SideDrawer.
                boxShadow:
                  "inset 0px 5px 8px rgba(56, 39, 36, 0.10), -2px 0px 12px rgba(56, 39, 36, 0.08)",
              }}
            >
                {/* The eyebrow alone said nothing to an owner who has never
                    heard of Tagly — the subheading carries the pitch, so the
                    CTA below it is a decision rather than a guess. */}
                <div className="flex flex-col gap-(--spacing-tight-gap)">
                  <p className="text-style-small-body-bold text-text-secondary">
                    {t("forBusiness")}
                  </p>
                  <p className="text-style-small-body text-text-secondary">
                    {t("forBusinessSubheading")}
                  </p>
                  <Button
                    type="primary"
                    size="small"
                    label={t("getTaglyForBusiness")}
                    href={advertiserUrl}
                    fullWidth
                  />
                  {/* Secondary tier, not soft: an owner who wants to talk
                      first is the lower-traffic path, and the drawer already
                      has its one primary above. */}
                  <Button
                    type="secondary"
                    size="small"
                    label={t("talkToSales")}
                    href={SALES_URL}
                    fullWidth
                  />
                </div>

                <div className="border-t border-divider" />

                <div className="flex flex-col gap-(--spacing-tight-gap)">
                  <p className="text-style-small-body-bold text-text-secondary">
                    {t("languageSwitcherLabel")}
                  </p>
                  <div className="flex items-center gap-(--spacing-card-padding)">
                    {languages.map((lng, i) => (
                      <Fragment key={lng}>
                        {i > 0 && (
                          <span className="text-text-tertiary" aria-hidden>
                            |
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => selectLanguage(lng)}
                          aria-current={lng === current}
                          className={`text-style-body-bold min-h-11 px-1 cursor-pointer transition-opacity duration-100 hover:opacity-70 ${
                            lng === current ? "text-ink" : "text-text-tertiary"
                          }`}
                        >
                          {lng.toUpperCase()}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
          </div>,
          document.body,
        )}
    </>
  );
}
