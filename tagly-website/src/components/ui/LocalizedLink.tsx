"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentProps } from "react";
import { defaultLng } from "@/lib/i18n/settings";

type LocalizedLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

// A drop-in next/link wrapper that prefixes internal routes with the active
// [lng] segment, so callers can keep writing href="/pricing" and it resolves to
// "/en/pricing" or "/cs/pricing" automatically. External links (http) and
// in-page anchors (#) are left untouched. Landing-section links ("/#contact")
// become "/en#contact" — the slash must NOT survive before the hash, or the
// trailing-slash redirect would drop the fragment.
export function LocalizedLink({ href, ...props }: LocalizedLinkProps) {
  const params = useParams();
  const lng = (params?.lng as string) || defaultLng;

  const isInternal = href.startsWith("/");
  const finalHref = !isInternal
    ? href
    : href === "/"
      ? `/${lng}`
      : href.startsWith("/#")
        ? `/${lng}${href.slice(1)}`
        : `/${lng}${href}`;

  return <Link href={finalHref} {...props} />;
}
