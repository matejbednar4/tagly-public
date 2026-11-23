import type { MetadataRoute } from "next";
import { isProduction, siteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Non-production deploys must never be crawled or indexed. Paired with the
  // X-Robots-Tag header (next.config.ts), the layout's robots meta, and the
  // empty sitemap.
  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
