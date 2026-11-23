import Link from "next/link";
import { playfair, stackSans } from "@/fonts";
import "./globals.css";

// Global fallback for the rare unmatched path that never reaches the [lng]
// segment. Because there is no root layout (the [lng] layout owns <html>), this
// page must render its own <html>/<body>. See src/lib/i18n/CLAUDE.md for why
// this 404 is deliberately unlocalized rather than a per-locale page.
//
// `lang` is hardcoded "en" and must NOT follow `defaultLng`: the copy below is
// literally English, so the attribute has to say so. Wiring it to defaultLng
// (now "cs") would announce Czech to screen readers and crawlers while serving
// English text. The "go home" link deliberately points at "/" rather than a
// fixed locale, so the middleware sends each visitor to their own language.
export default function GlobalNotFound() {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${playfair.variable} ${stackSans.variable} font-body antialiased bg-background`}
      >
        <main className="flex min-h-screen flex-col items-center justify-center px-(--spacing-page-horizontal-padding) text-center">
          <h1 className="text-style-h1 text-text">
            Sorry, we couldn&apos;t find that page
          </h1>
          <Link
            href="/"
            className="mt-(--spacing-block-gap) inline-flex items-center justify-center rounded-sm bg-ink px-(--spacing-card-padding) py-(--spacing-card-padding) text-style-body-bold text-on-ink"
          >
            Go home
          </Link>
        </main>
      </body>
    </html>
  );
}
