"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { useConsent } from "@/components/layout/ConsentProvider";
import { defaultLng, languages } from "@/lib/i18n/settings";

/** The campaign params we register as super-properties. See `readCampaign`. */
const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/**
 * The campaign attribution of the LANDING url, read once per page load.
 *
 * Read here rather than left to posthog-js because these are registered as
 * super-properties, so they ride EVERY event of the visit. posthog-js only
 * attaches them to events fired on the url that carried them, which would drop
 * the attribution the moment the visitor navigates off the landing page.
 *
 * Captured at first render, not at init: init is consent-gated, and a visitor
 * who lands on `/?utm_source=x`, browses, and only then accepts would otherwise
 * be attributed to whatever url they happened to be on when they clicked accept.
 *
 * Values are trimmed and length-bounded so a stuffed param can't mint a huge
 * high-cardinality property; empty/absent/oversized becomes null.
 *
 * UTMs only — the QR table-sticker `id` is deliberately NOT read here. Stickers
 * lead to the join page, never to this site, so the join page is the only place
 * that resolves a sticker (`sticker_id`).
 */
function readCampaign(): Record<string, string | null> {
  const params =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  return Object.fromEntries(
    UTM_PARAMS.map((p) => {
      const value = params.get(p)?.trim() ?? "";
      return [p, value.length > 0 && value.length <= 100 ? value : null];
    }),
  );
}

/**
 * PostHog analytics for the marketing site — the same shared "Tagly" project
 * as the apps, backend, and join page, separated by the `app` super-property
 * (`app: "tagly-website"`, filter/break down by it — never a second project).
 *
 * Replaced Google Tag Manager + GA4 + Microsoft Clarity on 2026-08-08, so the
 * whole product runs on one analytics stack.
 *
 * CONSENT-GATED: nothing initializes until the visitor has explicitly accepted
 * (see ConsentProvider — the site asks everyone, with no region detection).
 * That is why persistence is left at the PostHog default (localStorage+cookie)
 * rather than the join page's cookieless `persistence: "memory"`: the join page
 * has no consent surface, this one does, so cross-visit funnels are lawful here.
 *
 * DELIBERATELY OFF:
 *  - `disable_session_recording` — replay is billed per recording and is by far
 *    PostHog's priciest product; we decided we need neither it nor Clarity
 *    (2026-08-08). Turning it on is a spend increase, not a config tweak.
 *  - `person_profiles: "identified_only"` — we never call identify() on a
 *    marketing site, so this avoids minting a person profile per anonymous
 *    visitor (matches the apps, and profiles are billed separately from events).
 *
 * Autocapture IS on: it is what makes this a drop-in GA4 replacement (clicks,
 * form submits, outbound links with no per-element wiring). It is also the main
 * driver of event volume — if the shared project ever nears its event ceiling,
 * `autocapture: false` here is the first dial to turn.
 *
 * Campaign attribution (`utm_*`) is read from the landing url and registered as
 * super-properties — see `readCampaign` for why posthog-js's own handling isn't
 * enough.
 *
 * No-ops when NEXT_PUBLIC_POSTHOG_KEY is absent (local dev without env).
 */
export function PostHogTracker() {
  const { consent, ready } = useConsent();
  const pathname = usePathname();
  const [started, setStarted] = useState(false);
  // Lazy initializer: runs once, on the render that mounts this component, so
  // the params are those of the url the visitor ARRIVED on.
  const [campaign] = useState(readCampaign);

  // Initialize once, and only after an explicit accept.
  useEffect(() => {
    if (started || !ready || consent !== "accepted") return;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      disable_session_recording: true,
      // Pageviews are captured manually below: App Router client navigations do
      // not reliably produce one, and we want the locale on every pageview.
      capture_pageview: false,
      capture_pageleave: true,
    });

    // Super-properties: stamped on every event from this page load. `app` and
    // `app_env` use the same names as customer/advertiser/join/backend so one
    // breakdown covers every client in the shared project. APP_ENV is validated
    // and inlined by next.config.ts, so staging traffic is never mislabeled
    // production (the old NODE_ENV fallback did exactly that).
    // The utm_* set mirrors the join page's property names for the same reason
    // — one breakdown spans both web surfaces (see `readCampaign`).
    posthog.register({
      app: "tagly-website",
      app_env: process.env.APP_ENV,
      ...campaign,
    });

    setStarted(true);
  }, [ready, consent, started, campaign]);

  // A visitor who somehow moves off "accepted" stops being tracked. There is no
  // UI for this today (the bar disappears once answered), but the guard keeps
  // consent authoritative rather than init-time-only.
  useEffect(() => {
    if (started && consent !== "accepted") posthog.opt_out_capturing();
  }, [started, consent]);

  // One $pageview per route. Fires on mount (once started flips true) and on
  // every subsequent client-side navigation.
  useEffect(() => {
    if (!started || !pathname) return;

    // `/cs/pricing` -> locale "cs", path "/pricing". Keeping them separate means
    // a page's numbers are one row, not one per language, with locale as a
    // breakdown.
    const [, maybeLng, ...rest] = pathname.split("/");
    const isLocale = (languages as readonly string[]).includes(maybeLng);
    const locale = isLocale ? maybeLng : defaultLng;
    const path = isLocale ? `/${rest.join("/")}` : pathname;

    posthog.capture("$pageview", { locale, path });
  }, [started, pathname]);

  return null;
}
