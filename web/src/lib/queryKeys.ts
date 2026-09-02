import type { ProductFilters } from "@/types/product";

/**
 * Central query key registry.
 *
 * Keys are declared here rather than inline at each `useQuery` so that
 * invalidation after a mutation is a lookup, not a guess. Adding a product to
 * the wishlist must invalidate exactly the wishlist and that product — which
 * is only reliable if both sides read the same key factory.
 */
export const queryKeys = {
  /** The shop's own details and its live delivery threshold. */
  store: ["store"] as const,
  products: {
    all: ["products"] as const,
    list: (filters: ProductFilters, limit: number) =>
      ["products", "list", filters, limit] as const,
    detail: (slug: string) => ["products", "detail", slug] as const,
    similar: (productId: string) => ["products", "similar", productId] as const,
    recentlyViewed: ["products", "recently-viewed"] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  collection: (slug: string) => ["collection", slug] as const,
  search: {
    suggestions: (query: string) => ["search", "suggestions", query] as const,
  },
  cart: ["cart"] as const,
  wishlist: ["wishlist"] as const,
  orders: {
    all: ["orders"] as const,
    detail: (orderNumber: string) => ["orders", orderNumber] as const,
  },
  customer: {
    profile: ["customer", "profile"] as const,
    addresses: (kind: string) => ["customer", "addresses", kind] as const,
    checkoutAddresses: ["customer", "addresses", "checkout"] as const,
  },
} as const;
