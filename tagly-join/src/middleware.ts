import { NextRequest, NextResponse } from "next/server";

// Canonical-host redirect (see docs/LINKING_AND_REDIRECTS.md § Canonical
// domains). Dormant until the CANONICAL_HOST env var is baked into the build
// (Amplify console var → .env.production via amplify.yml). Only hosts on this
// explicit legacy list ever redirect, so staging hosts can never match even if
// the var leaks to the staging branch. The full path + query are preserved —
// printed QR stickers and shared join links carry referral codes that must
// survive the hop.
const LEGACY_HOSTS = new Set([
  "join.flaer.app",
  "join.flaer.cz",
  "join.tagly.cz",
]);

export const config = {
  // Everything except Next internals and static assets (paths with a file
  // extension) — a join link is always an extensionless page path.
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};

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
  return NextResponse.next();
}
