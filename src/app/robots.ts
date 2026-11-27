import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The private half of the app is closed to crawlers. Shop pages at /b/<slug>
 * stay crawlable: they are meant to be found.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api", "/onboarding", "/reset", "/suspended"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
