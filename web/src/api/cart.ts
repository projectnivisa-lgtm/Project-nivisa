import { api } from "./client";
import type { Cart, CartLine } from "@/types/cart";
import type { Money, StockState } from "@/types/product";

/**
 * Cart API.
 *
 * The backend prices the cart and returns the whole repriced result from every
 * mutation, so the UI writes one response into its cache and the header badge,
 * the drawer and the cart page can never disagree. Nothing here recomputes a
 * total: coupon caps and shipping thresholds live server-side, and a second
 * implementation would eventually charge a different number than it showed.
 *
 * Every mutation sends the guest cart token (`withSession`), so an anonymous
 * visitor has a cart before they ever meet a login screen.
 */

interface ApiCartItem {
  id: number;
  variant_id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  variant_label: string | null;
  sku: string;
  image_url: string | null;
  unit_price: string;
  quantity: number;
  line_total: string;
  in_stock: boolean;
  available_quantity: number;
  lead_time_days: number | null;
}

interface ApiCart {
  id: number;
  items: ApiCartItem[];
  totals: {
    subtotal: string;
    discount_total: string;
    shipping_total: string;
    tax_total: string;
    grand_total: string;
    item_count: number;
  };
  coupon_code: string | null;
  /** Set when a coupon was dropped, e.g. it expired since it was applied. */
  coupon_message: string | null;
  currency: string;
}

function money(value: string | number): Money {
  const amount = typeof value === "number" ? value : Number(value);
  return { amount: Number.isFinite(amount) ? amount : 0, currency: "INR" };
}

function line(item: ApiCartItem): CartLine {
  // A cart line knows whether its variant is buyable and how many are left,
  // but not the low-stock threshold — that is a catalogue concern. So the
  // state here is the honest three-way one, and the urgency nudge stays on
  // the product page where the threshold is known.
  const stockState: StockState = item.in_stock
    ? item.available_quantity > 0 && item.available_quantity <= 3
      ? "low-stock"
      : "in-stock"
    : "out-of-stock";

  return {
    id: String(item.id),
    productId: String(item.product_id),
    // The variant is what the line actually is; the cart updates and removes
    // by line id, but a caller that wants to re-add needs this.
    variantId: String(item.variant_id),
    name: item.product_name,
    slug: item.product_slug,
    imageUrl: item.image_url,
    unitPrice: money(item.unit_price),
    // The API sends what is charged. There is no per-line compare-at in a
    // cart, so MRP equals the unit price rather than being invented.
    unitMrp: money(item.unit_price),
    quantity: item.quantity,
    lineTotal: money(item.line_total),
    stockState,
    maxQuantity: item.available_quantity,
    variantLabels: item.variant_label ? [item.variant_label] : [],
  };
}

function toCart(raw: ApiCart): Cart {
  return {
    lines: (raw.items ?? []).map(line),
    subtotal: money(raw.totals.subtotal),
    // There is exactly ONE discount figure, and it belongs on exactly one
    // line. The old backend reported an MRP-versus-price "savings" separately
    // from a coupon; this one prices the cart and tells you what came off.
    // Mapping that single number to both fields printed it twice, which reads
    // as double the reduction actually being given.
    savings: money(0),
    shippingFee: money(raw.totals.shipping_total),
    ruleDiscount: money(raw.totals.discount_total),
    total: money(raw.totals.grand_total),
    itemCount: raw.totals.item_count,
    appliedCouponCode: raw.coupon_code ?? undefined,
    couponMessage: raw.coupon_message ?? undefined,
  };
}

export const cartApi = {
  /**
   * `postalCode` is optional and only affects the shipping estimate. Passing
   * the customer's PIN before checkout means the total they see in the cart is
   * the total they will be charged, rather than one that grows at the last
   * step.
   */
  async get(postalCode?: string): Promise<Cart> {
    const raw = await api.get<ApiCart>("/cart", {
      withSession: true,
      params: { postal_code: postalCode },
    });
    return toCart(raw);
  },

  async addItem(variantId: string, quantity: number): Promise<Cart> {
    const raw = await api.post<ApiCart>(
      "/cart/items",
      { variant_id: Number(variantId), quantity },
      { withSession: true },
    );
    return toCart(raw);
  },

  async updateItem(lineId: string, quantity: number): Promise<Cart> {
    // Quantity only: the line already knows which variant it is, and
    // resending it would invite a mismatch nobody notices until the wrong
    // thing ships.
    const raw = await api.put<ApiCart>(
      `/cart/items/${encodeURIComponent(lineId)}`,
      { quantity },
      { withSession: true },
    );
    return toCart(raw);
  },

  async removeItem(lineId: string): Promise<Cart> {
    const raw = await api.del<ApiCart>(`/cart/items/${encodeURIComponent(lineId)}`, {
      withSession: true,
    });
    return toCart(raw);
  },

  async clear(): Promise<Cart> {
    await api.del("/cart", { withSession: true });
    return this.get();
  },

  /**
   * Applying a coupon returns the repriced cart, so the discount is never
   * computed client-side and the customer never sees a stale total between
   * applying the code and a follow-up fetch.
   */
  async applyCoupon(code: string): Promise<Cart> {
    const raw = await api.post<ApiCart>("/cart/coupon", { code }, { withSession: true });
    return toCart(raw);
  },

  async removeCoupon(): Promise<Cart> {
    const raw = await api.del<ApiCart>("/cart/coupon", { withSession: true });
    return toCart(raw);
  },
};
