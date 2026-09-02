/**
 * Order wire shape -> domain model.
 *
 * The API sends fulfilment and payment as two independent enums. This file
 * turns them into what the customer reads — a status label and a tracking
 * ladder — without ever merging the two axes, because "Delivered" and
 * "Refunded" can both be true and collapsing them would misinform.
 */
import type {
  Order, OrderAddress, OrderItem, OrderStatus, OrderSummary,
  OrderTimelineEntry, PaymentStatus,
} from "@/types/order";
import type { Money } from "@/types/product";

export interface ApiOrderItem {
  id: number;
  product_id: number | null;
  variant_id: number | null;
  product_name: string;
  variant_label: string | null;
  sku: string;
  image_url: string | null;
  unit_price: string;
  quantity: number;
  tax_amount: string;
  line_total: string;
}

export interface ApiOrderAddress {
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface ApiOrderSummary {
  id: number;
  order_number: string;
  fulfilment_status: string;
  payment_status: string;
  grand_total: string;
  currency: string;
  item_count: number;
  placed_at: string | null;
  created_at: string;
}

export interface ApiOrderDetail extends ApiOrderSummary {
  subtotal: string;
  discount_total: string;
  shipping_total: string;
  tax_total: string;
  refunded_total: string;
  coupon_code: string | null;
  shipping_address: ApiOrderAddress;
  billing_address: ApiOrderAddress | null;
  customer_note: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  expected_delivery_date: string | null;
  paid_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  items: ApiOrderItem[];
  is_cancellable: boolean;
}

function money(value: string | number | null | undefined): Money {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return { amount: Number.isFinite(amount) ? amount : 0, currency: "INR" };
}

/** Payment vocabulary differs by one word; everything else passes through. */
function paymentStatus(value: string): PaymentStatus {
  if (value === "pending") return "unpaid";
  if (
    value === "paid" ||
    value === "refunded" ||
    value === "partially_refunded" ||
    value === "failed"
  ) {
    return value;
  }
  return "unpaid";
}

function fulfilmentStatus(value: string): OrderStatus {
  const known: OrderStatus[] = [
    "pending", "processing", "packed", "dispatched", "delivered", "cancelled", "returned",
  ];
  return known.includes(value as OrderStatus) ? (value as OrderStatus) : "pending";
}

/**
 * What the customer is told, in their words rather than the warehouse's.
 *
 * "Packed" is a fact about a box; "Ready to ship" is what it means for the
 * person waiting. Payment is deliberately not folded in — an unpaid order says
 * so separately, beside this label rather than instead of it.
 */
function label(fulfilment: OrderStatus, payment: PaymentStatus): string {
  if (fulfilment === "cancelled") return "Cancelled";
  if (fulfilment === "returned") return "Returned";
  if (fulfilment === "delivered") return "Delivered";
  if (fulfilment === "dispatched") return "On its way";
  if (fulfilment === "packed") return "Ready to ship";
  if (fulfilment === "processing") return "Being prepared";
  return payment === "unpaid" ? "Awaiting payment" : "Order placed";
}

function address(source: ApiOrderAddress | null): OrderAddress | null {
  if (!source) return null;
  return {
    recipientName: source.full_name,
    phone: source.phone,
    // The API keeps line1 and line2 separate; the customer reads one address.
    line1: [source.line1, source.line2].filter(Boolean).join(", "),
    landmark: source.landmark ?? undefined,
    city: source.city,
    state: source.state,
    pincode: source.postal_code,
  };
}

function item(source: ApiOrderItem): OrderItem {
  return {
    id: String(source.id),
    productId: source.product_id === null ? null : String(source.product_id),
    name: source.product_name,
    imageUrl: source.image_url,
    unitPrice: money(source.unit_price),
    quantity: source.quantity,
    lineTotal: money(source.line_total),
    variantLabels: source.variant_label ? [source.variant_label] : [],
  };
}

/**
 * The tracking ladder.
 *
 * Every rung is rendered, completed or not, so the customer sees where the
 * order is *and* what is still to come. A cancelled or returned order shows
 * only what actually happened — drawing "Delivered" as an upcoming step on an
 * order that was cancelled would be a promise nobody is keeping.
 */
function timeline(source: ApiOrderDetail): OrderTimelineEntry[] {
  const status = fulfilmentStatus(source.fulfilment_status);

  const placed: OrderTimelineEntry = {
    statusId: 0,
    title: "Order placed",
    occurredAt: source.placed_at ?? source.created_at,
    isCompleted: true,
  };

  if (status === "cancelled") {
    return [
      placed,
      {
        statusId: 1,
        title: "Cancelled",
        occurredAt: source.cancelled_at,
        note: source.cancellation_reason ?? undefined,
        isCompleted: true,
      },
    ];
  }

  const reached = ["pending", "processing", "packed", "dispatched", "delivered"].indexOf(status);

  const rungs: OrderTimelineEntry[] = [
    placed,
    {
      statusId: 1,
      title: "Payment received",
      occurredAt: source.paid_at,
      isCompleted: source.paid_at !== null,
    },
    {
      statusId: 2,
      title: "Being prepared",
      occurredAt: null,
      isCompleted: reached >= 1,
    },
    {
      statusId: 3,
      title: "Ready to ship",
      occurredAt: null,
      isCompleted: reached >= 2,
    },
    {
      statusId: 4,
      title: "On its way",
      occurredAt: source.dispatched_at,
      note: source.courier_name
        ? `${source.courier_name}${source.tracking_number ? ` · ${source.tracking_number}` : ""}`
        : undefined,
      isCompleted: reached >= 3,
    },
    {
      statusId: 5,
      title: "Delivered",
      occurredAt: source.delivered_at,
      isCompleted: reached >= 4,
    },
  ];

  if (status === "returned") {
    rungs.push({
      statusId: 6,
      title: "Returned",
      occurredAt: null,
      isCompleted: true,
    });
  }

  return rungs;
}

export function toOrderSummary(source: ApiOrderSummary): OrderSummary {
  const status = fulfilmentStatus(source.fulfilment_status);
  const payment = paymentStatus(source.payment_status);
  return {
    id: String(source.id),
    orderNumber: source.order_number,
    status,
    statusLabel: label(status, payment),
    paymentStatus: payment,
    total: money(source.grand_total),
    itemCount: source.item_count,
    placedAt: source.placed_at ?? source.created_at,
    // Not sent on a summary. Zero rather than a guess; the detail carries it.
    discount: money(0),
  };
}

export function toOrder(source: ApiOrderDetail): Order {
  const status = fulfilmentStatus(source.fulfilment_status);
  const payment = paymentStatus(source.payment_status);

  return {
    id: String(source.id),
    orderNumber: source.order_number,
    status,
    statusLabel: label(status, payment),
    paymentStatus: payment,
    total: money(source.grand_total),
    itemCount: source.items.reduce((sum, line) => sum + line.quantity, 0),
    placedAt: source.placed_at ?? source.created_at,
    couponCode: source.coupon_code ?? undefined,
    discount: money(source.discount_total),
    items: source.items.map(item),
    subtotal: money(source.subtotal),
    shippingFee: money(source.shipping_total),
    deliveryAddress: address(source.shipping_address),
    timeline: timeline(source),
    trackingNumber: source.tracking_number,
    trackingLink: source.tracking_url,
    courierName: source.courier_name,
  };
}
