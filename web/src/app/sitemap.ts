import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/env";
import { fetchFilterCategories, fetchListing } from "@/lib/listingData";
import { PAGE_SLUGS } from "@/api/content";
import { loadNavigation } from "@/lib/navigationSource";

/**
 * sitemap.xml
 *
 * Lists only what a crawler should index: nothing behind sign-in, nothing that
 * carries `noindex`, and no filtered listing URLs (those canonicalise to the
 * unfiltered page, so listing them would advertise duplicates).
 *
 * **Never throws.** A sitemap that fails takes the whole route down with it,
 * and a build or request that dies because the catalogue API hiccuped is a far
 * worse outcome than a sitemap temporarily missing its product URLs. Every
 * dynamic section degrades to nothing on failure; the static routes always
 * ship.
 *
 * Revalidated hourly rather than built once — a catalogue changes, and a
 * sitemap pinned at deploy time goes stale the first time someone adds a
 * product.
 */
export const revalidate = 3600;

/** Cap per section. Beyond ~50k URLs a sitemap index is required, not one file. */
const MAX_PRODUCTS = 5_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/shop"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/about"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: absoluteUrl("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];

  // Policy pages. Slugs are the live ones confirmed against the backend seeds;
  // a page that has not been created yet simply 404s, and listing a 404 is a
  // (minor) waste of crawl budget — so this stays a fixed, checked list rather
  // than a guess at what might exist.
  const policyRoutes: MetadataRoute.Sitemap = Object.values(PAGE_SLUGS).map(
    (slug) => ({
      url: absoluteUrl(`/pages/${slug}`),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    }),
  );

  // Rooms come from the catalogue. If it is unreachable, loadNavigation falls
  // back to a static list whose URLs all resolve, so the sitemap is never
  // empty of them.
  const { rooms } = await loadNavigation();
  const roomRoutes: MetadataRoute.Sitemap = rooms.map((room) => ({
    url: absoluteUrl(room.href),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const [categories, products] = await Promise.all([
    safe(async () => {
      const rows = await fetchFilterCategories();
      return rows.map((category) => ({
        url: absoluteUrl(`/category/${category.slug}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
    }),

    safe(async () => {
      // One page of the catalogue, then follow `hasMore`. Capped so a large
      // catalogue cannot turn this route into a hundred sequential requests.
      const urls: MetadataRoute.Sitemap = [];
      let offset = 0;
      const pageSize = 100;

      while (urls.length < MAX_PRODUCTS) {
        const page = await fetchListing({}, pageSize, offset);
        if (!page.page || page.page.items.length === 0) break;

        for (const product of page.page.items) {
          urls.push({
            url: absoluteUrl(`/product/${product.slug}`),
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.7,
          });
        }

        if (!page.page.hasMore) break;
        offset += pageSize;
      }
      return urls;
    }),
  ]);

  // Rooms and live categories can name the same URL — de-duplicate, because a
  // sitemap listing one URL twice is a validation error.
  return dedupe([
    ...staticRoutes,
    ...roomRoutes,
    ...categories,
    ...products,
    ...policyRoutes,
  ]);
}

async function safe(
  run: () => Promise<MetadataRoute.Sitemap>,
): Promise<MetadataRoute.Sitemap> {
  try {
    return await run();
  } catch {
    return [];
  }
}

function dedupe(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}
