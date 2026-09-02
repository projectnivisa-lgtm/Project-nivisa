"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "@/api/catalog";
import { queryKeys } from "@/lib/queryKeys";
import type { ProductFilters } from "@/types/product";

/**
 * Product listing.
 *
 * Returns the four states every API-driven surface in this product must handle
 * explicitly — loading, empty, error, success — as discrete booleans, so a
 * screen cannot accidentally render "No products found" while a request is
 * still in flight.
 */
export function useProducts(
  filters: ProductFilters = {},
  limit = 24,
  offset = 0,
) {
  const query = useQuery({
    queryKey: [...queryKeys.products.list(filters, limit), offset],
    // Forward the signal so a rapid filter change aborts the request it
    // superseded instead of racing it.
    queryFn: ({ signal }) =>
      catalogApi.listProducts(filters, limit, offset, signal),
    // Keep the previous grid visible while a filter change loads, so the page
    // does not collapse to skeletons on every checkbox.
    placeholderData: (previous) => previous,
  });

  return {
    ...query,
    products: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    hasMore: query.data?.hasMore ?? false,
    isEmpty: query.isSuccess && (query.data?.items.length ?? 0) === 0,
  };
}

export function useProduct(slug: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.products.detail(slug ?? ""),
    queryFn: () => catalogApi.getProduct(slug!),
    enabled: Boolean(slug),
  });
  return { ...query, product: query.data };
}

export function useSimilarProducts(productId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.products.similar(productId ?? ""),
    queryFn: () => catalogApi.getSimilarProducts(productId!),
    enabled: Boolean(productId),
  });
  return { ...query, products: query.data ?? [] };
}

export function useCategories() {
  const query = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => catalogApi.getCategories(),
    // Categories change on the order of weeks, not minutes.
    staleTime: 30 * 60_000,
  });
  return { ...query, categories: query.data ?? [] };
}
