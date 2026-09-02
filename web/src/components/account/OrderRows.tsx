import Link from "next/link";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { OrderStatus, OrderSummary, PaymentStatus } from "@/types/order";

/**
 * Order list rows.
 *
 * Shared by `/orders` and `/account/orders` so the two cannot drift.
 *
 * Each row leads with status, not date. Someone opening an order list is
 * asking "where is my sofa", and the answer should be readable without
 * clicking through. Payment state appears only when it needs attention —
 * a "Paid" badge on every row is noise that hides the one unpaid order.
 */

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-surface-sunken text-ink-muted",
  processing: "bg-warning-soft text-warning",
  packed: "bg-warning-soft text-warning",
  dispatched: "bg-accent-soft text-clay-700",
  delivered: "bg-success-soft text-success",
  cancelled: "bg-surface-sunken text-ink-muted",
  returned: "bg-surface-sunken text-ink-muted",
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid",
  unpaid: "Payment pending",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
  failed: "Payment failed",
};

export function OrderRows({ orders }: { orders: OrderSummary[] }) {
  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/order/${order.orderNumber}`}
            className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-sm border border-border bg-surface p-5 transition-colors duration-fast hover:border-ink"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-xs px-2.5 py-1 text-xs",
                    STATUS_TONE[order.status],
                  )}
                >
                  {order.statusLabel}
                </span>
                {order.paymentStatus !== "paid" ? (
                  <span className="rounded-xs bg-warning-soft px-2.5 py-1 text-xs text-warning">
                    {PAYMENT_LABEL[order.paymentStatus]}
                  </span>
                ) : null}
              </div>

              <p className="mt-2.5 text-sm font-medium tabular">
                {order.orderNumber}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted tabular">
                {formatDate(order.placedAt)} · {order.itemCount}{" "}
                {order.itemCount === 1 ? "item" : "items"}
              </p>
            </div>

            <p data-price className="text-lg font-semibold">
              {formatMoney(order.total)}
            </p>

            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0 text-ink-subtle"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}
