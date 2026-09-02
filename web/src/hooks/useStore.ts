"use client";

import { useQuery } from "@tanstack/react-query";
import { contentApi } from "@/api/content";
import { queryKeys } from "@/lib/queryKeys";
import type { StoreProfile } from "@/types/content";

/**
 * The shop's own details, and the free-delivery threshold.
 *
 * The threshold is derived by the API from the live shipping zones, so a
 * banner or a cart line that quotes it is quoting the rule that will actually
 * price the order. It used to be a hardcoded ₹15,000 in two components while
 * the real rule was ₹25,000 — a promise the shop would not have kept.
 *
 * Cached for the session: none of this changes between page views, and a
 * request per component would be three for one banner.
 */
export function useStore() {
  const query = useQuery({
    queryKey: queryKeys.store,
    queryFn: () => contentApi.getStore(),
    staleTime: 10 * 60_000,
  });
  return { ...query, store: query.data as StoreProfile | undefined };
}
