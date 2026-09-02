import type { Money, ProductId, StockState } from "./product";

/**
 * Cart domain model.
 *
 * The backend is authoritative for every monetary figure. The frontend never
 * recomputes a subtotal, discount or total from line items — coupon rules and
 * shipping thresholds live server-side, and a second implementation here would
 * eventually disagree with the amount actually charged.
 */

export interface CartLine {
  /** Line id, used for update and remove. Not the product id. */
  id: string;
  productId: ProductId;
  /** The variant this line actually is. Price and stock belong to it. */
  variantId: string;
  name: string;
  slug?: string;
  imageUrl: string | null;
  /** Unit price at the time the cart was priced. */
  unitPrice: Money;
  unitMrp: Money;
  quantity: number;
  lineTotal: Money;
  stockState: StockState;
  /** Units available, so the quantity stepper can cap itself. */
  maxQuantity: number;
  /** Chosen variant labels, e.g. ["Walnut"]. Empty on a single-option piece. */
  variantLabels: string[];
}

export interface Cart {
  lines: CartLine[];
  /** Sum of line totals before any discount or shipping. Server-computed. */
  subtotal: Money;
  /** Total MRP saved across the cart. Server-computed. */
  savings: Money;
  shippingFee: Money;
  /** Automatic cart-rule discount, distinct from a coupon. Server-computed. */
  ruleDiscount: Money;
  /** The amount payable. The only figure a checkout button may quote. */
  total: Money;
  /** Total units, not line count — the header badge shows this. */
  itemCount: number;
  appliedCouponCode?: string;
  /**
   * Why a coupon was dropped, e.g. it expired after it was applied. Set by the
   * server so the customer is told rather than left wondering where the
   * discount went.
   */
  couponMessage?: string;
}

export const EMPTY_CART: Cart = {
  lines: [],
  subtotal: { amount: 0, currency: "INR" },
  savings: { amount: 0, currency: "INR" },
  shippingFee: { amount: 0, currency: "INR" },
  ruleDiscount: { amount: 0, currency: "INR" },
  total: { amount: 0, currency: "INR" },
  itemCount: 0,
};
