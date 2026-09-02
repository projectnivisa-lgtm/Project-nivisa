import { api } from "./client";
import {
  toOrder,
  toOrderSummary,
  type ApiOrderDetail,
  type ApiOrderSummary,
} from "./adapters/orderAdapter";
import type { Order, OrderSummary } from "@/types/order";

/**
 * Orders API.
 *
 * An order is placed from the server-side cart against a saved address. There
 * is no "post a whole new address at checkout" path any more: an address the
 * order references has to exist first, which is what lets the customer see it
 * on their account afterwards instead of it vanishing into one order's JSON.
 */

export interface PlaceOrderInput {
  shippingAddressId: string;
  billingAddressId?: string;
  note?: string;
}

export interface PaymentSession {
  orderNumber: string;
  reference: string;
  /** Where to send the browser. Never contains a session token. */
  redirectUrl: string;
  provider: string;
}

interface ApiPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export const ordersApi = {
  async list(limit = 20, offset = 0): Promise<OrderSummary[]> {
    const raw = await api.get<ApiPage<ApiOrderSummary>>("/orders", {
      params: { limit, offset },
    });
    return (raw?.items ?? []).map(toOrderSummary);
  },

  async get(orderNumber: string): Promise<Order> {
    const raw = await api.get<ApiOrderDetail>(
      `/orders/${encodeURIComponent(orderNumber)}`,
    );
    return toOrder(raw);
  },

  async place(input: PlaceOrderInput): Promise<Order> {
    const raw = await api.post<ApiOrderDetail>("/orders", {
      shipping_address_id: Number(input.shippingAddressId),
      billing_address_id: input.billingAddressId
        ? Number(input.billingAddressId)
        : undefined,
      customer_note: input.note,
    });
    return toOrder(raw);
  },

  /**
   * Creates a payment session and returns where to send the browser.
   *
   * An authenticated POST that returns a URL, rather than a GET the browser
   * follows with a token in the query string. The old backend authenticated
   * its redirect by decoding `?token=`, which put a live full-scope access
   * token into browser history, the Referer sent to the gateway, and every
   * intermediary log. The token now stays in the Authorization header of this
   * call and never enters a URL.
   */
  async startPayment(orderNumber: string): Promise<PaymentSession> {
    const raw = await api.post<{
      order_number: string;
      reference: string;
      redirect_url: string;
      provider: string;
    }>(`/orders/${encodeURIComponent(orderNumber)}/pay`);

    return {
      orderNumber: raw.order_number,
      reference: raw.reference,
      redirectUrl: raw.redirect_url,
      provider: raw.provider,
    };
  },

  async cancel(orderNumber: string, reason: string): Promise<Order> {
    const raw = await api.post<ApiOrderDetail>(
      `/orders/${encodeURIComponent(orderNumber)}/cancel`,
      { reason, restock: true },
    );
    return toOrder(raw);
  },
};
