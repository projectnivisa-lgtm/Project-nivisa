import { catalogApi, type Category } from "@/api/catalog";
import { ApiError } from "@/api/client";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { getDemoCollection, getDemoListing } from "@/lib/demo/listing";
import type { Paginated, Product, ProductFilters } from "@/types/product";

/**
 * Server-side data for listing pages.
 *
 * Listing pages are server-rendered so the grid is in the HTML: a category
 * page that ships an empty div and fetches on the client is invisible to
 * search engines and shows a skeleton to everyone on a slow connection.
 *
 * Neither function throws. A listing page must always render — with results,
 * with an empty state, or with an error state — and a rejected promise here
 * would replace the whole page with an error boundary because one rail of
 * category chips could not load.
 */

export interface ListingResult {
  page: Paginated<Product> | null;
  /** Set when the catalogue itself could not be read. */
  error: string | null;
}

export async function fetchListing(
  filters: ProductFilters,
  limit: number,
  offset: number,
): Promise<ListingResult> {
  if (IS_DEMO_CONTENT) {
    return { page: getDemoListing(filters, limit, offset), error: null };
  }

  try {
    return { page: await catalogApi.listProducts(filters, limit, offset), error: null };
  } catch (cause) {
    return {
      page: null,
      error:
        cause instanceof ApiError
          ? cause.message
          : "We could not load the catalogue just now.",
    };
  }
}

/**
 * A curated collection.
 *
 * Uses `/catalog/collections/{slug}`, which is a different endpoint from the
 * product list and accepts only `q`, `limit` and `offset` — no price or
 * availability narrowing (API-GAPS §3). The listing page therefore hides the
 * filter panel on collection pages rather than showing controls the endpoint
 * would ignore.
 *
 * A missing collection resolves to `notFound`, not an empty grid: a retired
 * campaign URL should 404 rather than imply the collection exists and is bare.
 */
export interface CollectionResult extends ListingResult {
  name: string | null;
  notFound: boolean;
}

export async function fetchCollection(
  slug: string,
  query: string | undefined,
  limit: number,
  offset: number,
): Promise<CollectionResult> {
  if (IS_DEMO_CONTENT) {
    const demo = getDemoCollection(slug, query, limit, offset);
    return demo.notFound
      ? { page: null, error: null, name: null, notFound: true }
      : { page: demo.page, error: null, name: demo.name, notFound: false };
  }

  try {
    const collection = await catalogApi.getCollection(slug, limit, offset, query);
    // A real total and real paging: a collection is the product list narrowed
    // by `collection`, not a separate cursor-only endpoint, so the count under
    // the heading and the page links under the grid are both honest.
    return {
      name: collection.name,
      notFound: false,
      error: null,
      page: collection.products,
    };
  } catch (cause) {
    if (cause instanceof ApiError && cause.kind === "notFound") {
      return { page: null, error: null, name: null, notFound: true };
    }
    return {
      page: null,
      name: null,
      notFound: false,
      error:
        cause instanceof ApiError
          ? cause.message
          : "We could not load this collection just now.",
    };
  }
}

/**
 * Categories for the filter panel.
 *
 * Failure returns an empty list rather than an error: the filter panel simply
 * renders without its category section, and the grid — which is the point of
 * the page — is unaffected.
 */
export async function fetchFilterCategories(): Promise<Category[]> {
  if (IS_DEMO_CONTENT) return DEMO_CATEGORIES;
  try {
    return await catalogApi.getCategories();
  } catch {
    return [];
  }
}

/**
 * DEMO CONTENT — NOT API DATA.
 * Ids match the room slugs in `config/navigation.ts` so demo category pages
 * and demo filtering agree with each other.
 */
const DEMO_CATEGORIES: Category[] = [
  { id: "living-room", slug: "living-room", name: "Living Room", imageUrl: null, productCount: 5 },
  { id: "bedroom", slug: "bedroom", name: "Bedroom", imageUrl: null, productCount: 3 },
  { id: "dining-room", slug: "dining-room", name: "Dining Room", imageUrl: null, productCount: 1 },
  { id: "study", slug: "study", name: "Study", imageUrl: null, productCount: 1 },
  { id: "entryway", slug: "entryway", name: "Entryway", imageUrl: null, productCount: 1 },
  { id: "outdoor", slug: "outdoor", name: "Outdoor", imageUrl: null, productCount: 1 },
];
