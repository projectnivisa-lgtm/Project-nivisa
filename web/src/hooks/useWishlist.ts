"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerSource } from "@/lib/customerSource";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/types/product";

/**
 * Wishlist.
 *
 * The endpoint requires authentication, so the query is disabled while signed
 * out rather than firing a request that is guaranteed to 401. The heart button
 * stays visible for guests and prompts sign-in on tap — hiding it would make
 * the feature invisible to exactly the people who have not signed up yet.
 */
export function useWishlist() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.wishlist,
    queryFn: () => customerSource.getWishlist(),
    enabled: isAuthenticated,
  });

  const products = query.data ?? [];
  const wishlistedIds = new Set(products.map((p) => p.id));

  const toggle = useMutation({
    mutationFn: async ({
      productId,
      isWishlisted,
    }: {
      productId: string;
      isWishlisted: boolean;
    }) => {
      if (isWishlisted) await customerSource.removeFromWishlist(productId);
      else await customerSource.addToWishlist(productId);
    },

    onMutate: async ({ productId, isWishlisted }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.wishlist });
      const previous = queryClient.getQueryData<Product[]>(queryKeys.wishlist);
      if (previous && isWishlisted) {
        // Removal can be reflected immediately; an addition cannot, because
        // the full product for the new entry is not in this cache yet.
        queryClient.setQueryData<Product[]>(
          queryKeys.wishlist,
          previous.filter((p) => p.id !== productId),
        );
      }
      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.wishlist, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist });
    },
  });

  return {
    products,
    isLoading: query.isLoading,
    isError: query.isError,
    isEmpty: query.isSuccess && products.length === 0,
    isAuthenticated,
    isWishlisted: (productId: string) => wishlistedIds.has(productId),
    toggle,
  };
}
