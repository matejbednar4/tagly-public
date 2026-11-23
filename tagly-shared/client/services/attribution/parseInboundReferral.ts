import { ReferralCodeSchema } from "@tagly/models/shared";
import { resolveQrSticker } from "@tagly/sdk/v2/crossApp";

/**
 * Host-aware extraction of a referral code from an inbound deep link.
 *
 * WHY THIS IS HOST-AWARE (it used to not be, and that was two bugs):
 *
 * 1. The join hosts are claimed as iOS Universal Links with `paths: ["*"]`, so on a
 *    device with the app installed iOS opens the app DIRECTLY and the join page never
 *    loads in a browser. That matters because `join.taglyapp.com/<code>` relies on a
 *    Next.js **server-side** rewrite (`/:code` → `/?code=:code`) which therefore never
 *    runs — the app receives the raw path and must parse it itself. Same for the QR
 *    sticker form (`?id=…`), whose sticker→business→referralCode lookup also happened
 *    server-side. Both silently lost the referral before this existed.
 *
 * 2. Reading a bare `?code=` off ANY url is unsafe: the Instagram OAuth return is
 *    `redirect.<host>/customer/instagram/oauth?code=<IG_AUTH_CODE>`, and an IG auth code
 *    is `[A-Za-z0-9_-]+`, so it passes `ReferralCodeSchema` after lowercasing and would
 *    be stashed as the user's referrer. Redirect hosts and custom schemes therefore
 *    never contribute a bare `code`.
 *
 * The rule per host class:
 *   join hosts    → `?code=`  ·  first path segment  ·  `?id=` (sticker, needs the API)
 *   onelink hosts → `?code=`  ·  `deep_link_value`
 *   everything else (redirect hosts, `tagly://` schemes, unknown) → `deep_link_value` only
 */

/** Hosts that serve the join/referral landing page (prod + staging). */
const JOIN_HOSTS = new Set([
  "join.taglyapp.com",
  "join.tagly.cz",
  "staging.join.tagly.dev",
  // Legacy — old printed/shared links must keep attributing.
  "join.flaer.cz",
  "join.flaer.app",
]);

/** Path segments on a join host that are never referral codes. */
const JOIN_RESERVED_SEGMENTS = new Set([
  ".well-known",
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export type InboundReferral = {
  /** A referral code ready to stash. */
  code?: string;
  /** A QR sticker id that still needs resolving against the API. */
  stickerId?: string;
};

function isOneLinkHost(host: string): boolean {
  return host.endsWith(".onelink.me");
}

/** Validate a candidate against the canonical referral-code shape. */
function asReferralCode(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const parsed = ReferralCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Parse an inbound URL into whatever attribution signal it carries. Pure + sync:
 * a sticker id is returned as-is for the caller to resolve (see
 * `resolveInboundReferral`).
 */
export function parseInboundReferral(url?: string | null): InboundReferral {
  if (!url) return {};
  try {
    // Custom schemes (`tagly://…`) aren't parseable by `URL` on all engines; swap in a
    // placeholder scheme so the rest of the parse works, and remember it wasn't https.
    const isHttp = /^https?:\/\//i.test(url);
    const safe = url.replace(/^([a-z][a-z0-9+.-]*):\/\//i, "https://");
    const u = new URL(safe);
    const host = u.hostname.toLowerCase();

    const deepLinkValue = asReferralCode(u.searchParams.get("deep_link_value"));

    // Non-https (custom scheme) or a host we don't recognise → only ever trust the
    // explicit AppsFlyer field. Never a bare `?code=` (that's the IG OAuth footgun).
    if (!isHttp) return deepLinkValue ? { code: deepLinkValue } : {};

    if (JOIN_HOSTS.has(host)) {
      // 1) explicit ?code= wins (the query form, and what the rewrite would produce)
      const queryCode = asReferralCode(u.searchParams.get("code"));
      if (queryCode) return { code: queryCode };

      // 2) first path segment — the pretty form, join.taglyapp.com/<code>
      const firstSegment = u.pathname.split("/").filter(Boolean)[0];
      if (firstSegment && !JOIN_RESERVED_SEGMENTS.has(firstSegment.toLowerCase())) {
        const pathCode = asReferralCode(decodeURIComponent(firstSegment));
        if (pathCode) return { code: pathCode };
      }

      // 3) QR sticker — the code lives on the business, so this needs the API
      const stickerId = u.searchParams.get("id")?.trim();
      if (stickerId) return { stickerId };

      return {};
    }

    if (isOneLinkHost(host)) {
      return {
        code: asReferralCode(u.searchParams.get("code")) ?? deepLinkValue,
      };
    }

    // Redirect hosts and anything else: deep_link_value only.
    return deepLinkValue ? { code: deepLinkValue } : {};
  } catch {
    return {};
  }
}

/**
 * Full resolution, including the one case that needs the network: a QR sticker id is
 * exchanged for its business's referral code via `GET /v2/public/stickers/:id`.
 *
 * Fail-soft by contract — an unknown sticker, a timeout, or an offline device must
 * yield `undefined` (no attribution) and never throw, because this runs on the
 * deep-link path where a rejection would surface as a stuck launch.
 */
export async function resolveInboundReferral(
  url?: string | null,
): Promise<string | undefined> {
  const parsed = parseInboundReferral(url);
  if (parsed.code) return parsed.code;
  if (!parsed.stickerId) return undefined;

  try {
    const res = await resolveQrSticker({ id: parsed.stickerId });
    if (res.status < 200 || res.status >= 300) return undefined;
    const referralCode = (res.json as any)?.business?.referralCode;
    return asReferralCode(referralCode);
  } catch {
    return undefined;
  }
}
