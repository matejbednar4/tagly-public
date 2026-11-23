import type { Metadata } from "next";
import localFont from "next/font/local";
import { detectLocale } from "@/i18n/detectLocale";
import { initI18next } from "@/i18n";
import { namespaces } from "@/i18n/settings";
import { TranslationsProvider } from "@/i18n/TranslationsProvider";
import { JOIN_ORIGIN } from "@/lib/constants/links";
import "./globals.css";

// The app's real brand fonts (copied from tagly-shared/client/assets/fonts):
// Playfair for headings (semiBold floor, bold for display/title), Stack Sans
// Text for everything functional (400/500 only) — the same ladder as the apps.
const playfair = localFont({
  src: [
    { path: "./fonts/Playfair-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Playfair-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-heading",
});

const stackSans = localFont({
  src: [
    {
      path: "./fonts/StackSansText-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/StackSansText-Medium.ttf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-body",
});

export async function generateMetadata(): Promise<Metadata> {
  const lng = await detectLocale();
  const { t } = await initI18next(lng, "layout").then((i18n) => ({
    t: i18n.getFixedT(lng, "layout"),
  }));

  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    metadataBase: new URL(
      process.env.APP_ENV === "production"
        ? JOIN_ORIGIN.production
        : JOIN_ORIGIN.staging,
    ),
    title,
    description,
    robots: "noindex",
    icons: {
      icon: "/favicon.png",
    },
    openGraph: {
      title,
      description,
      images: ["/images/og-image.png"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lng = await detectLocale();
  const i18n = await initI18next(lng, [...namespaces]);
  const resources = i18n.services.resourceStore.data;

  return (
    <html lang={lng}>
      <body
        className={`${playfair.variable} ${stackSans.variable} font-body antialiased`}
      >
        <TranslationsProvider locale={lng} resources={resources}>
          {children}
        </TranslationsProvider>
      </body>
    </html>
  );
}
