"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

type Props = {
  appEnv: string;
  stickerId: string | null;
  utmSource: string | null;
  referralCodePresent: boolean;
  businessResolved: boolean;
  businessUid: string | null;
};

/**
 * PostHog analytics for the join page — the same shared "Tagly" project as
 * the apps/backend, separated by the `app` super-property (`app: "tagly-join"`,
 * filter/break down by it — never a second project).
 *
 * Events:
 *  - `join_page_viewed` — one per page render, carrying the sticker id /
 *    utm_source / resolved business, so per-sticker opens are a direct
 *    breakdown in PostHog.
 *  - `join_cta_clicked` — delegated document click listener on any anchor
 *    whose href targets an app handoff (OneLink). No per-button wiring: the
 *    CTA kind is derived from the destination, so server components stay
 *    untouched. Sent via sendBeacon so navigation can't swallow it.
 *
 * Deliberately cookieless (`persistence: "memory"`): no consent surface on a
 * CZ landing page, and per-sticker funnels don't need cross-visit identity.
 * Autocapture/session recording off — only the two clean events above.
 * No-ops when NEXT_PUBLIC_POSTHOG_KEY is absent (local dev without env).
 */
export function PostHogTracker({
  appEnv,
  stickerId,
  utmSource,
  referralCodePresent,
  businessResolved,
  businessUid,
}: Props) {
  const started = useRef(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
    if (!key || started.current) return;
    started.current = true;

    posthog.init(key, {
      api_host: host,
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
    });

    // Super-properties: stamped on every event from this page load.
    posthog.register({
      app: "tagly-join",
      // Same property name as customer/advertiser/backend (`app_env`) so one
      // breakdown covers every client in the shared PostHog project.
      app_env: appEnv,
      sticker_id: stickerId,
      utm_source: utmSource,
    });

    posthog.capture("join_page_viewed", {
      referral_code_present: referralCodePresent,
      business_resolved: businessResolved,
      business_uid: businessUid,
    });

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      const href = anchor?.getAttribute("href") ?? "";
      if (!href.includes("onelink.me")) return;
      // Advertiser OneLink hosts: tagly-business (new) / flaerads (legacy).
      // Customer hosts (*tagly.onelink.me / *flaer.onelink.me) match neither.
      const cta = /tagly-business\.onelink\.me|flaerads/.test(href)
        ? "for_business"
        : "get_app";
      posthog.capture(
        "join_cta_clicked",
        {
          cta,
          target_url: href,
          referral_code_present: referralCodePresent,
          business_resolved: businessResolved,
          business_uid: businessUid,
        },
        { transport: "sendBeacon" },
      );
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
