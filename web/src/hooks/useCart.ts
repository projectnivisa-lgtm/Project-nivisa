"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cartSource } from "@/lib/cartSource";
import { queryKeys } from "@/lib/queryKeys";
import { EMPTY_CART, type Cart } from "@/types/cart";

/**
 * Cart state.
 *
 * Every mutation writes the server's returned cart straight into the cache, so
 * the header badge, cart drawer and cart page all update from one response
 * without a follow-up GET. Quantity changes are applied optimistically —
 * a stepper that lags behind the tap feels broken — but the money is not:
 * totals only ever change when the server says so.
 */
export function useCart(postalCode?: string) {
  const queryClient = useQueryClient();

  // The pincode is part of the key, not just the request. Shipping depends on
  // where the parcel is going, so a cart priced for one destination is a
  // different answer from a cart priced for another - sharing a cache entry
  // between them is how a customer gets quoted one total and charged another.
  const query = useQuery({
    queryKey: postalCode ? [...queryKeys.cart, postalCode] : queryKeys.cart,
    queryFn: () => cartSource.get(postalCode),
    staleTime: 0,
  });

  const setCart = (cart: Cart) => queryClient.setQueryData(queryKeys.cart, cart);

  // Adds a VARIANT, not a product: a variant is what carries price and stock,
  // and a sofa "in walnut" is a different thing to pick and ship than the
  // same sofa in ink.
  const addItem = useMutation({
    mutationFn: ({ variantId, quantity = 1 }: { variantId: string; quantity?: number }) =>
      cartSource.addItem(variantId, quantity),
    onSuccess: setCart,
  });

  const updateQuantity = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      cartSource.updateItem(lineId, quantity),

    onMutate: async ({ lineId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cart });
      const previous = queryClient.getQueryData<Cart>(queryKeys.cart);
      if (previous) {
        // Line quantity and the item count move immediately. Subtotal and
        // total are left untouched: guessing at them here would flash a
        // number that the server may then contradict.
        queryClient.setQueryData<Cart>(queryKeys.cart, {
          ...previous,
          lines: previous.lines.map((line) =>
            line.id === lineId ? { ...line, quantity } : line,
          ),
          itemCount: previous.lines.reduce(
            (sum, line) => sum + (line.id === lineId ? quantity : line.quantity),
            0,
          ),
        });
      }
      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) setCart(context.previous);
    },
    onSuccess: setCart,
  });

  const removeItem = useMutation({
    mutationFn: (lineId: string) => cartSource.removeItem(lineId),
    onSuccess: setCart,
  });

  const applyCoupon = useMutation({
    mutationFn: (code: string) => cartSource.applyCoupon(code),
    onSuccess: setCart,
  });

  const clear = useMutation({
    mutationFn: () => cartSource.clear(),
    onSuccess: setCart,
  });

  const cart = query.data ?? EMPTY_CART;

  return {
    cart,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isEmpty: query.isSuccess && cart.lines.length === 0,
    addItem,
    updateQuantity,
    removeItem,
    applyCoupon,
    clear,
  };
}
