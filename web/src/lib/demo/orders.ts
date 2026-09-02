import { demoCart } from "./cart";
import { demoAddresses } from "./account";
import type { Order, OrderSummary } from "@/types/order";
import type { Money } from "@/types/product";

/**
 * DEMO CONTENT — NOT API DATA. See `lib/demo/catalogue.ts`.
 *
 * Orders placed in demo mode, held in localStorage so the confirmation and
 * order pages have something real to render. Nothing here reaches a server and
 * no payment is taken; the payment step says so explicitly.
 */

const STORAGE_KEY = "nivisa.demoOrders";

function readAll(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

function writeAll(orders: Order[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    /* Storage unavailable — the demo order lasts for this page only. */
  }
}

const money = (amount: number): Money => ({ amount, currency: "INR" });

/** Mirrors the backend's order-number shape closely enough to look real. */
function nextOrderNumber(): string {
  const year = new Date().getFullYear();
  const serial = String(1000 + readAll().length + 1);
  return `NV${year}${serial}`;
}

export const demoOrders = {
  /**
   * Returns the whole order, not a summary.
   *
   * The real flow returns the placed order so the confirmation page can render
   * without a second fetch; the demo store matches that so no caller needs a
   * demo-shaped branch.
   */
  place(): Order {
    const cart = demoCart.get();
    if (cart.lines.length === 0) {
      throw new Error("Your cart is empty.");
    }

    const now = new Date().toISOString();
    const order: Order = {
      id: `demo-order-${Date.now()}`,
      orderNumber: nextOrderNumber(),
      status: "pending",
      statusLabel: "Order placed",
      // Demo orders are marked paid immediately: there is no gateway, and an
      // order stuck "unpaid" would make the confirmation page permanently
      // display a payment retry for a payment that can never happen.
      paymentStatus: "paid",
      total: cart.total,
      itemCount: cart.itemCount,
      placedAt: now,
      couponCode: cart.appliedCouponCode,
      discount: cart.ruleDiscount,
      subtotal: cart.subtotal,
      shippingFee: cart.shippingFee,
      deliveryAddress: demoAddresses.list("shipping")[0] ?? null,
      items: cart.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        name: line.name,
        imageUrl: line.imageUrl,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
        variantLabels: line.variantLabels,
      })),
      timeline: [
        {
          statusId: 1,
          title: "Order placed",
          occurredAt: now,
          isCompleted: true,
        },
        {
          statusId: 2,
          title: "Payment confirmed",
          occurredAt: now,
          isCompleted: true,
        },
        { statusId: 3, title: "Preparing your order", occurredAt: null, isCompleted: false },
        { statusId: 4, title: "Out for delivery", occurredAt: null, isCompleted: false },
        { statusId: 5, title: "Delivered and assembled", occurredAt: null, isCompleted: false },
      ],
      trackingNumber: null,
      trackingLink: null,
      courierName: null,
      invoiceNumber: `INV-${nextOrderNumber()}`,
      invoiceDate: now,
    };

    writeAll([order, ...readAll()]);
    demoCart.clear();
    return order;
  },

  /** The demo gateway's "Pay" button. */
  markPaid(orderNumber: string): void {
    const all = readAll();
    const order = all.find((o) => o.orderNumber === orderNumber);
    if (!order) return;
    order.paymentStatus = "paid";
    order.status = "processing";
    writeAll(all);
  },

  get(orderNumber: string): Order | null {
    return readAll().find((o) => o.orderNumber === orderNumber) ?? null;
  },

  list(): OrderSummary[] {
    return readAll().map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      statusLabel: o.statusLabel,
      paymentStatus: o.paymentStatus,
      total: o.total,
      itemCount: o.itemCount,
      placedAt: o.placedAt,
      couponCode: o.couponCode,
      discount: o.discount,
    }));
  },

  cancel(orderNumber: string): void {
    const all = readAll();
    const order = all.find((o) => o.orderNumber === orderNumber);
    if (!order) throw new Error("Order not found.");
    order.status = "cancelled";
    order.statusLabel = "Cancelled";
    writeAll(all);
  },
};

export { money as demoMoney };
