"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { languages, defaultLng, cookieName } from "@/lib/i18n/settings";

const labels: Record<string, string> = {
  en: "EN",
  cs: "CS",
};

// EN/CS toggle. Swaps the leading [lng] segment of the current path, persists
// the choice in the i18next cookie (so the middleware remembers it), and
// navigates to the same page in the chosen language.
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const current = (params?.lng as string) || defaultLng;

  function switchTo(lng: string) {
    if (lng === current) return;
    document.cookie = `${cookieName}=${lng};path=/;max-age=31536000`;
    const next = pathname.replace(/^\/[^/]+/, `/${lng}`);
    router.push(next);
  }

  return (
    <div className={`flex items-center ${className}`}>
      {languages.map((lng, index) => (
        <span key={lng} className="flex items-center">
          {index > 0 && (
            <span className="mx-(--spacing-tight-gap) text-text-tertiary" aria-hidden="true">
              /
            </span>
          )}
          <button
            type="button"
            onClick={() => switchTo(lng)}
            aria-current={lng === current ? "true" : undefined}
            className={`cursor-pointer text-style-small-body-bold transition-opacity ${
              lng === current
                ? "text-text"
                : "text-text-secondary hover:opacity-70"
            }`}
          >
            {labels[lng] ?? lng.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
