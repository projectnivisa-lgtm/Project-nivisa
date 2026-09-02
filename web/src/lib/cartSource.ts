import { cartApi } from "@/api/cart";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { demoCart } from "@/lib/demo/cart";
import type { Cart } from "@/types/cart";

/**
 * Cart source.
 *
 * One branch point between the live API and the demo cart, so no component or
 * hook carries a demo conditional. Every method returns the full repriced cart,
 * matching the API's own contract — which is what lets the UI write one
 * response into the cache and have the header, drawer and cart page agree.
 */
export const cartSource = {
  get: (postalCode?: string): Promise<Cart> =>
    IS_DEMO_CONTENT ? Promise.resolve(demoCart.get()) : cartApi.get(postalCode),

  addItem: (variantId: string, quantity: number): Promise<Cart> =>
    IS_DEMO_CONTENT
      ? promise(() => demoCart.addItem(variantId, quantity))
      : cartApi.addItem(variantId, quantity),

  updateItem: (lineId: string, quantity: number): Promise<Cart> =>
    IS_DEMO_CONTENT
      ? promise(() => demoCart.updateItem(lineId, quantity))
      : cartApi.updateItem(lineId, quantity),

  removeItem: (lineId: string): Promise<Cart> =>
    IS_DEMO_CONTENT
      ? promise(() => demoCart.removeItem(lineId))
      : cartApi.removeItem(lineId),

  clear: (): Promise<Cart> =>
    IS_DEMO_CONTENT ? promise(() => demoCart.clear()) : cartApi.clear(),

  applyCoupon: (code: string): Promise<Cart> =>
    IS_DEMO_CONTENT
      ? promise(() => demoCart.applyCoupon(code))
      : cartApi.applyCoupon(code),
};

/**
 * Runs a synchronous demo operation as a promise, so a thrown validation error
 * ("only 3 left in stock") reaches the caller as a rejection — the same shape
 * an ApiError arrives in, so error handling has one path rather than two.
 */
function promise<T>(run: () => T): Promise<T> {
  try {
    return Promise.resolve(run());
  } catch (cause) {
    return Promise.reject(cause);
  }
}
