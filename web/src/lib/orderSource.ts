import { ordersApi, type PlaceOrderInput } from "@/api/orders";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { demoOrders } from "@/lib/demo/orders";
import type { Order, OrderSummary } from "@/types/order";

/**
 * Order source.
 *
 * One branch point between the live API and the demo store, matching
 * `cartSource`. Order placement is the least forgiving operation in the
 * product — a duplicate is a real duplicate — so nothing here retries.
 */
export const orderSource = {
  place(input: PlaceOrderInput): Promise<Order> {
    if (IS_DEMO_CONTENT) {
      try {
        return Promise.resolve(demoOrders.place());
      } catch (cause) {
        return Promise.reject(cause);
      }
    }
    return ordersApi.place(input);
  },

  get(orderNumber: string): Promise<Order> {
    if (IS_DEMO_CONTENT) {
      const order = demoOrders.get(orderNumber);
      return order
        ? Promise.resolve(order)
        : Promise.reject(new Error("Order not found."));
    }
    return ordersApi.get(orderNumber);
  },

  list(): Promise<OrderSummary[]> {
    if (IS_DEMO_CONTENT) return Promise.resolve(demoOrders.list());
    return ordersApi.list();
  },

  cancel(orderNumber: string, reason: string): Promise<Order | void> {
    if (IS_DEMO_CONTENT) {
      try {
        demoOrders.cancel(orderNumber);
        return Promise.resolve();
      } catch (cause) {
        return Promise.reject(cause);
      }
    }
    return ordersApi.cancel(orderNumber, reason);
  },
};

/**
 * Hands the browser to the payment gateway.
 *
 * Two steps, deliberately. The session is created by an authenticated POST,
 * and only then is the browser navigated to the URL that call returns — so the
 * access token stays in an Authorization header and never reaches browser
 * history, the Referer sent to the gateway, or an intermediary log. The old
 * backend's `pay-redirect?token=` put it in all three.
 *
 * The navigation itself is a full page load rather than a fetch: the gateway
 * hosts its own checkout, and an XHR would follow the redirect invisibly and
 * leave the customer looking at a spinner.
 */
export async function startPayment(orderNumber: string): Promise<void> {
  if (IS_DEMO_CONTENT) {
    // The demo store has no gateway. Land on the order, already paid, which
    // is what the real flow arrives at.
    demoOrders.markPaid(orderNumber);
    // Full load on purpose, matching the real flow: the live path hands the
    // browser to the gateway and it comes back on a fresh document, and demo
    // mode that soft-navigated instead would exercise a different code path
    // than the one being demonstrated.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/order/${encodeURIComponent(orderNumber)}`;
    return;
  }

  const session = await ordersApi.startPayment(orderNumber);
  window.location.href = session.redirectUrl;
}
