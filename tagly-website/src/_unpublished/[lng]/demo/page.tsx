import type { Metadata } from "next";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "demo");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/demo"),
    openGraph: { title, description },
    robots: { index: false, follow: false },
  };
}

export default async function DemoPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "demo");

  return (
    <main>
      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) py-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <h1 className="text-style-h2 text-text text-center">{t("title")}</h1>
        <div
          className="card overflow-hidden"
          style={{
            width: "70%",
            maxHeight: 500,
            aspectRatio: "16/9",
            margin: "var(--spacing-block-gap) auto 0",
          }}
        >
          {/* The pre-rebrand 9:16 demo video (how-it-works-compressed.mp4) was
              deleted 2026-08-14; the landing hero's CS explainer stands in
              until the demo re-shoot decision is made. */}
          <video
            src="/videos/explainer.mp4"
            controls
            playsInline
            autoPlay
            muted
            loop
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </div>
      </section>
    </main>
  );
}
