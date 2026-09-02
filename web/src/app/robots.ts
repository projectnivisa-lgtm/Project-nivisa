import type { MetadataRoute } from "next";
import { absoluteUrl, env } from "@/config/env";

/**
 * robots.txt
 *
 * Everything private or infinite is disallowed. Three groups:
 *
 *  - **Private to one person** (account, orders, cart, checkout, wishlist).
 *    These already carry `noindex`, but a crawler should not spend requests
 *    discovering that, and an order URL appearing in any log or referrer is
 *    worth avoiding outright.
 *  - **Near-infinite and thin** (search). Every query string is a distinct URL
 *    with no unique content; letting them be crawled is a well-known way to
 *    spend a site's crawl budget on nothing.
 *  - **Internal** (admin, the design-system reference).
 *
 * Filtered listing URLs are deliberately NOT disallowed. They canonicalise to
 * the unfiltered page (see `lib/listing.ts::listingCanonical`), which is the
 * right signal — blocking them instead would stop the crawler ever seeing the
 * canonical tag that resolves them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/checkout",
          "/cart",
          "/account",
          "/orders",
          "/order/",
          "/login",
          "/wishlist",
          "/search",
          "/design-system",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: env.siteUrl,
  };
}
