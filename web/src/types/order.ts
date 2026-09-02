import type { Money, ProductId } from "./product";

/**
 * Order domain model.
 *
 * Fulfilment status and payment status are separate axes and are never merged
 * into one label: "Delivered" and "Unpaid" can both be true (cash on delivery
 * lineage), and collapsing them would misinform the customer.
 */

/**
 * Fulfilment state, using the API's own vocabulary rather than a parallel one.
 *
 * Two words instead of a mapping: any translation layer between the API's
 * ladder and a private set of names is a place for the two to disagree about
 * what "ready" means, and the customer-facing wording lives in `statusLabel`
 * anyway.
 */
export type OrderStatus =
  | "pending"
  | "processing"
  | "packed"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "returned";

export type PaymentStatus =
  | "paid"
  | "unpaid"
  | "refunded"
  | "partially_refunded"
  | "failed";

export interface OrderItem {
  id: string;
  productId: ProductId | null;
  name: string;
  imageUrl?: string | null;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
  variantLabels: string[];
}

export interface OrderAddress {
  recipientName: string;
  phone: string;
  line1: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
}

/** One rung of the customer-facing tracking ladder. */
export interface OrderTimelineEntry {
  statusId: number;
  title: string;
  occurredAt: string | null;
  note?: string;
  /** False for future rungs, which render as upcoming rather than done. */
  isCompleted: boolean;
}

/** The list-view projection. Enough for a card, not the whole order. */
export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  /** Backend-supplied customer-facing label; prefer it over mapping `status`. */
  statusLabel: string;
  paymentStatus: PaymentStatus;
  total: Money;
  itemCount: number;
  placedAt: string | null;
  couponCode?: string;
  discount: Money;
}

export interface Order extends OrderSummary {
  items: OrderItem[];
  subtotal: Money;
  shippingFee: Money;
  deliveryAddress: OrderAddress | null;
  timeline: OrderTimelineEntry[];
  trackingNumber?: string | null;
  trackingLink?: string | null;
  courierName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
}

/**
 * Whether the customer can cancel this order themselves.
 *
 * Mirrors the server's own rule exactly (`Order.is_cancellable_by_customer`):
 * unpaid, and not yet picked. Once paid, cancellation is staff-only so the
 * refund is handled deliberately rather than as a side effect of a button.
 *
 * Kept in step with the server on purpose. A button that 409s the moment it
 * is pressed is worse than no button, which is what this function exists to
 * prevent.
 */
export function isCancellable(order: OrderSummary): boolean {
  return (
    order.paymentStatus === "unpaid" &&
    (order.status === "pending" || order.status === "processing")
  );
}

/**
 * A paid order that has not shipped can still be cancelled — but only by
 * staff. The UI offers a phone number rather than a button that cannot work.
 */
export function needsSupportToCancel(order: OrderSummary): boolean {
  return (
    order.paymentStatus === "paid" &&
    order.status !== "cancelled" &&
    order.status !== "delivered" &&
    order.status !== "returned"
  );
}

/** An unpaid order can still be paid for without rebuilding the cart. */
export function canRetryPayment(order: OrderSummary): boolean {
  return order.status !== "cancelled" && order.paymentStatus !== "paid";
}
