import { DEMO_PRODUCTS } from "./catalogue";
import type { Paginated, Product, ProductFilters } from "@/types/product";

/**
 * DEMO CONTENT — NOT API DATA. See `lib/demo/catalogue.ts`.
 *
 * Applies the same filter and sort semantics the backend applies, so the
 * listing page can be built and reviewed against a working grid while the
 * catalogue is still books. Deliberately implements ONLY what the backend
 * supports — query, category, price, availability, three sorts — so demo mode
 * cannot make a filter look functional that would do nothing in production.
 */
export function getDemoListing(
  filters: ProductFilters,
  limit: number,
  offset: number,
): Paginated<Product> {
  let items = [...DEMO_PRODUCTS];

  if (filters.query) {
    const needle = filters.query.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.summary?.toLowerCase().includes(needle) ||
        p.specs?.material?.toLowerCase().includes(needle),
    );
  }

  // Demo products carry a room in `specs`, and the demo category ids are the
  // room slugs the navigation uses — enough to make category pages real.
  if (filters.categoryId) {
    const needle = filters.categoryId.replace(/-/g, " ").toLowerCase();
    items = items.filter((p) => p.specs?.room?.toLowerCase() === needle);
  }

  if (filters.minPrice !== undefined) {
    items = items.filter((p) => p.price.selling.amount >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined) {
    items = items.filter((p) => p.price.selling.amount <= filters.maxPrice!);
  }
  if (filters.inStockOnly) {
    items = items.filter((p) => p.stockState !== "out-of-stock");
  }

  if (filters.sort === "price_asc") {
    items.sort((a, b) => a.price.selling.amount - b.price.selling.amount);
  } else if (filters.sort === "price_desc") {
    items.sort((a, b) => b.price.selling.amount - a.price.selling.amount);
  }
  // "newest" keeps the seeded order, which is how the backend behaves too.

  const total = items.length;
  const page = items.slice(offset, offset + limit);

  return {
    items: page,
    total,
    limit,
    offset,
    hasMore: offset + page.length < total,
  };
}

/**
 * DEMO CONTENT — NOT API DATA.
 *
 * Mirrors the eight fixed collection rails the backend actually has
 * (API-GAPS §3): merchandisers cannot create new ones, so an unknown slug is
 * a 404 here exactly as it would be against the real endpoint.
 */
const DEMO_COLLECTIONS: Record<string, { name: string; pick: (all: Product[]) => Product[] }> = {
  "best-sellers": {
    name: "Best sellers",
    pick: (all) => all.slice(0, 6),
  },
  "new-arrivals": {
    name: "New arrivals",
    pick: (all) => all.slice(6),
  },
  trending: {
    name: "Trending now",
    pick: (all) => [all[3], all[0], all[5], all[8]].filter(Boolean),
  },
  featured: {
    name: "Featured",
    pick: (all) => all.filter((p) => p.badges.includes("bestseller")),
  },
  offers: {
    name: "Current offers",
    pick: (all) => all.filter((p) => p.price.discountPercent >= 20),
  },
};

export function getDemoCollection(
  slug: string,
  query: string | undefined,
  limit: number,
  offset: number,
): { notFound: boolean; name: string; page: Paginated<Product> } {
  const collection = DEMO_COLLECTIONS[slug];
  if (!collection) {
    return {
      notFound: true,
      name: "",
      page: { items: [], total: 0, limit, offset, hasMore: false },
    };
  }

  let items = collection.pick(DEMO_PRODUCTS);
  if (query) {
    const needle = query.toLowerCase();
    items = items.filter((p) => p.name.toLowerCase().includes(needle));
  }

  const total = items.length;
  const slice = items.slice(offset, offset + limit);

  return {
    notFound: false,
    name: collection.name,
    page: { items: slice, total, limit, offset, hasMore: offset + slice.length < total },
  };
}
