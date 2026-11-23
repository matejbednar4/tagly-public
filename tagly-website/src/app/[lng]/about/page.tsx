import type { Metadata } from "next";
import Image from "next/image";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "about");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/about"),
    openGraph: { title, description, images: ["/og-image.png"] },
  };
}

const team = [
  { name: "Matej Bednar", photo: "/images/team/matej-bednar.jpg", linkedin: "https://www.linkedin.com/in/matej-bednar-b89478333" },
  { name: "Stepan Mruzek", photo: "/images/team/stepan-mruzek.png", linkedin: "https://www.linkedin.com/in/stepan-mruzek/" },
  { name: "Vit Stanek", photo: "/images/team/vit-stanek.png", linkedin: "https://www.linkedin.com/in/v%C3%ADt-stan%C4%9Bk-10412b294/" },
  { name: "Eduard Koran", photo: "/images/team/eduard-koran.jpg", linkedin: "https://www.linkedin.com/in/eduardkoran/" },
];

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "about");

  const roles = t("team.roles", { returnObjects: true }) as string[];

  return (
    <main>
      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pt-(--spacing-section-gap) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="mx-auto max-w-160">
          <h1 className="text-style-h1 text-text">{t("hero.title")}</h1>
          <p className="mt-(--spacing-element-gap) text-style-lead text-text-secondary">
            {t("hero.p1")}
          </p>
          <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
            {t("hero.p2")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="mx-auto max-w-160">
          <h2 className="text-style-h2 text-text">{t("team.title")}</h2>
          <div className="mt-(--spacing-block-gap) grid grid-cols-2 sm:grid-cols-4">
            {team.map((member, index) => (
              <article
                key={member.name}
                className={`flex flex-col items-center ${
                  index >= 2 ? "mt-(--spacing-element-gap) sm:mt-0" : ""
                }`}
              >
                <div className="relative h-24 w-24 overflow-hidden rounded-full bg-surface shadow-card">
                  <Image src={member.photo} alt={member.name} fill className="object-cover" />
                </div>
                <h3 className="mt-(--spacing-card-padding) text-style-body-bold text-center text-text">
                  {member.name}
                </h3>
                {/* whitespace-pre-line: CS roles use \n for controlled two-line breaks. */}
                <p className="mt-(--spacing-tight-gap) text-style-small-body text-center whitespace-pre-line text-text-secondary">
                  {roles[index]}
                </p>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("team.linkedinAria", { name: member.name })}
                  className="mt-(--spacing-tight-gap) text-text-secondary hover:text-ink"
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect width="4" height="12" x="2" y="9" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Company registration info moved here from /contact (2026-08-09) —
          legal inquiries contact lives in the legal documents themselves. */}
      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="mx-auto max-w-160">
          <h2 className="text-style-h2 text-text">{t("company.title")}</h2>
          <div className="mt-(--spacing-element-gap)">
            <p className="text-style-body text-text-secondary">
              <span className="text-style-body-bold text-text">{t("company.name")}</span>{" "}
              {t("company.incorporated")}
            </p>
            <p className="mt-(--spacing-tight-gap) text-style-body text-text-secondary">
              {t("company.address")}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
