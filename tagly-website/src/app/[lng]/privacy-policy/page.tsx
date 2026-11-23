import type { Metadata } from "next";
import LegalDocPage from "@/components/sections/LegalDocPage";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "legal");
  const title = t("privacyPolicy.meta.title");
  const description = t("privacyPolicy.meta.description");
  return {
    title,
    description,
    alternates: buildAlternates(lng, "/privacy-policy"),
    openGraph: { title, description, images: ["/og-image.png"] },
  };
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  return <LegalDocPage lng={lng} doc="privacy-policy" />;
}
