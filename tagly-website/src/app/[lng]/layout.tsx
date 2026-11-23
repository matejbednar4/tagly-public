import type { Metadata } from "next";
import { playfair, stackSans } from "@/fonts";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollAnimator } from "@/components/ui/ScrollAnimator";
import { ConsentProvider } from "@/components/layout/ConsentProvider";
import { PostHogTracker } from "@/lib/analytics/PostHogTracker";
import { CookieBar } from "@/components/layout/CookieBar";
import { languages } from "@/lib/i18n/settings";
import { ogLocale } from "@/lib/i18n/metadata";
import { allSocialProfiles } from "@/lib/social";
import { isProduction, siteOrigin } from "@/lib/site";
import "../globals.css";

// Statically generate a layout for every supported language.
export function generateStaticParams() {
  return languages.map((lng) => ({ lng }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;

  return {
    metadataBase: new URL(siteOrigin),
    // Non-production deploys are noindexed at every layer (this meta, the
    // X-Robots-Tag header in next.config.ts, robots.txt, empty sitemap).
    robots: isProduction ? undefined : { index: false, follow: false },
    title: {
      default: "Tagly: Real customers promoting your business on Instagram",
      template: "%s | Tagly",
    },
    description:
      "Tagly helps restaurants, cafes, gyms, and local businesses get promoted by real customers posting on Instagram. Not influencers, your actual customers.",
    openGraph: {
      type: "website",
      siteName: "Tagly",
      locale: ogLocale(lng),
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "Tagly",
        },
      ],
    },
    // X/Twitter needs its own card meta; declared here so every page inherits
    // it (Next merges metadata per-field, so page-level openGraph overrides
    // don't touch it — unlike openGraph.images, which pages must re-declare).
    twitter: {
      card: "summary_large_image",
      images: ["/og-image.png"],
    },
    // Icons come from src/app/{favicon.ico,icon.png,apple-icon.png} via the
    // app-router file convention, which fingerprints the URLs so a changed
    // icon actually replaces the one a browser has cached.
  };
}

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tagly",
  url: "https://taglyapp.com",
  logo: "https://taglyapp.com/favicon.png",
  sameAs: allSocialProfiles,
  description:
    "Tagly helps restaurants, cafes, gyms, and local businesses get promoted by real customers posting on Instagram.",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tagly",
  url: "https://taglyapp.com",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lng: string }>;
}>) {
  const { lng } = await params;

  return (
    // `data-scroll-behavior="smooth"` tells Next.js that `html` uses CSS smooth
    // scrolling, so it can temporarily disable it during route transitions.
    // Without it, navigating to a new page animates instead of jumping and the
    // user is left at their previous scroll offset.
    <html lang={lng} data-scroll-behavior="smooth">
      <body
        className={`${playfair.variable} ${stackSans.variable} font-body antialiased bg-background`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        />
        <ConsentProvider>
          <PostHogTracker />
          <ScrollAnimator />
          <div className="bg-background">
            <Navbar />
            {children}
          </div>
          <Footer lng={lng} />
          <CookieBar />
        </ConsentProvider>
      </body>
    </html>
  );
}
