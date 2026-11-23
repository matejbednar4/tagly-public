import { NextRequest, NextResponse } from "next/server";
import acceptLanguage from "accept-language";
import { defaultLng, languages, cookieName } from "@/lib/i18n/settings";

// ORDER MATTERS, and not for display: when `accept-language` finds no match it
// returns the FIRST language it was configured with, never null. So the default
// has to lead this list, or an unmatched visitor silently gets whichever
// language happens to sit at index 0. (`languages` itself stays EN-first — it
// drives the EN/CS switcher order and generateStaticParams.)
acceptLanguage.languages([
  defaultLng,
  ...languages.filter((l) => l !== defaultLng),
]);

export const config = {
  // Run on everything except API routes, Next internals, the SEO files, and
  // static assets (anything with a file extension).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.png|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};

function resolveLng(req: NextRequest): string {
  const cookieLng = req.cookies.get(cookieName)?.value;
  if (cookieLng && languages.includes(cookieLng as (typeof languages)[number])) {
    return cookieLng;
  }
  // No header at all (most crawlers): don't ask the matcher, just default.
  const header = req.headers.get("Accept-Language");
  if (!header) return defaultLng;

  const matched = acceptLanguage.get(header);
  return matched && languages.includes(matched as (typeof languages)[number])
    ? matched
    : defaultLng;
}

// Canonical-host redirect (see docs/LINKING_AND_REDIRECTS.md § Canonical
// domains). Dormant until the CANONICAL_HOST env var is baked into the build
// (Amplify console var → .env.production via amplify.yml). Only hosts on this
// explicit legacy list ever redirect, so staging hosts can never match even if
// the var leaks to the staging branch.
const LEGACY_HOSTS = new Set([
  "flaer.app",
  "www.flaer.app",
  "tagly.cz",
  "www.tagly.cz",
  "www.taglyapp.com",
]);

export function middleware(req: NextRequest) {
  const canonicalHost = process.env.CANONICAL_HOST;
  if (canonicalHost) {
    const host = req.headers.get("host")?.toLowerCase();
    if (host && host !== canonicalHost && LEGACY_HOSTS.has(host)) {
      const url = req.nextUrl.clone();
      url.protocol = "https:";
      url.host = canonicalHost;
      url.port = "";
      return NextResponse.redirect(url, 308);
    }
  }

  const { pathname } = req.nextUrl;

  // If the path already starts with a supported locale, just keep the cookie
  // in sync and continue.
  const pathLng = languages.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (pathLng) {
    const res = NextResponse.next();
    if (req.cookies.get(cookieName)?.value !== pathLng) {
      res.cookies.set(cookieName, pathLng, { path: "/" });
    }
    return res;
  }

  // Otherwise redirect the locale-less path to the resolved locale.
  const lng = resolveLng(req);
  const url = req.nextUrl.clone();
  url.pathname = `/${lng}${pathname}`;
  const res = NextResponse.redirect(url);
  res.cookies.set(cookieName, lng, { path: "/" });
  return res;
}
