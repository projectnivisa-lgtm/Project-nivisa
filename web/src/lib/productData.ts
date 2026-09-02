import { cache } from "react";
import { catalogApi } from "@/api/catalog";
import { ApiError } from "@/api/client";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { DEMO_PRODUCTS } from "@/lib/demo/catalogue";
import { withDemoDetail } from "@/lib/demo/detail";
import type { Product } from "@/types/product";

/**
 * Server-side product detail.
 *
 * Wrapped in `cache` so `generateMetadata` and the page body share one fetch
 * per request — otherwise every product view costs two identical calls.
 *
 * Returns `null` for a genuine 404 and throws nothing: the route decides
 * between `notFound()` and an error state, and a rejected promise here would
 * replace the page with an error boundary.
 */
export const loadProduct = cache(async function loadProduct(
  slug: string,
): Promise<{ product: Product | null; error: string | null }> {
  if (IS_DEMO_CONTENT) {
    const match = DEMO_PRODUCTS.find((p) => p.slug === slug);
    return { product: match ? withDemoDetail(match) : null, error: null };
  }

  try {
    return { product: await catalogApi.getProduct(slug), error: null };
  } catch (cause) {
    if (cause instanceof ApiError && cause.kind === "notFound") {
      return { product: null, error: null };
    }
    return {
      product: null,
      error:
        cause instanceof ApiError
          ? cause.message
          : "We could not load this product just now.",
    };
  }
});

/**
 * Similar products.
 *
 * Never throws and never blocks the page — a failed recommendation rail should
 * cost the customer a row of suggestions, not the product they came to see.
 */
export async function loadSimilarProducts(product: Product): Promise<Product[]> {
  if (IS_DEMO_CONTENT) {
    // Same room first, then anything else, so the rail is plausibly related
    // rather than random — which is what the real endpoint aims at too.
    const room = product.specs?.room;
    const others = DEMO_PRODUCTS.filter((p) => p.id !== product.id);
    const sameRoom = others.filter((p) => p.specs?.room === room);
    const rest = others.filter((p) => p.specs?.room !== room);
    return [...sameRoom, ...rest].slice(0, 4);
  }

  try {
    return await catalogApi.getSimilarProducts(product.id, 8);
  } catch {
    return [];
  }
}
