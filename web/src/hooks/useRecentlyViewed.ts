"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "@/api/catalog";
import { useAuth } from "@/hooks/useAuth";
import { useIsMounted } from "@/hooks/useIsMounted";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { entryToProduct, recentlyViewedStore } from "@/lib/recentlyViewed";
import type { Product } from "@/types/product";

/**
 * Recently viewed products.
 *
 * Signed in → the API, which keeps the canonical 20-per-customer list.
 * Signed out → the local snapshot, because the endpoint cannot serve guests
 * (see `lib/recentlyViewed.ts` for why).
 *
 * Demo mode uses the local list in both cases: there is no server to hold a
 * customer's history, and reading from localStorage is what actually makes the
 * feature demonstrable.
 */
export function useRecentlyViewed(): {
  products: Product[];
  isLoading: boolean;
} {
  const { isAuthenticated } = useAuth();
  // Guarded so the server and the first client render agree — localStorage is
  // not readable during SSR, and rendering the rail before mount would
  // hydrate a different list than the server sent.
  const isMounted = useIsMounted();

  const useApi = isAuthenticated && !IS_DEMO_CONTENT;

  const query = useQuery({
    queryKey: ["recently-viewed"],
    queryFn: () => catalogApi.getRecentlyViewed(),
    enabled: useApi,
    staleTime: 60_000,
  });

  if (useApi) {
    return { products: query.data ?? [], isLoading: query.isPending };
  }

  if (!isMounted) return { products: [], isLoading: true };

  return {
    products: recentlyViewedStore.list().map(entryToProduct),
    isLoading: false,
  };
}
