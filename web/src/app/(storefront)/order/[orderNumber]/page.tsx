"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orderSource } from "@/lib/orderSource";
import { surfaceState } from "@/lib/surfaceState";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import { ProductImage } from "@/components/commerce/ProductImage";
import { OrderActions } from "@/components/orders/OrderActions";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { Order } from "@/types/order";

/**
 * Order confirmation and detail.
 *
 * The page a customer lands on after paying, and the one they return to when
 * they want to know where their sofa is. Both audiences need the same three
 * things at the top: that it worked, what happens next, and the number to
 * quote if they call.
 *
 * Fulfilment status and payment status are shown as separate facts. They are
 * separate axes on the backend and collapsing them would misinform — an order
 * can be delivered and unpaid, or paid and not yet dispatched.
 */
export default function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);

  const query = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: () => orderSource.get(orderNumber),
  });

  const state = surfaceState(query, false);
  const order = query.data;

  if (state === "loading") {
    return (
      <div className="container-page py-12">
        <div className="skeleton h-9 w-64 rounded-xs" aria-hidden="true" />
        <div className="skeleton mt-8 h-72 rounded-sm" aria-hidden="true" />
        <span className="sr-only" role="status">
          Loading order {orderNumber}
        </span>
      </div>
    );
  }

  if (state === "error" || state === "offline" || !order) {
    return (
      <div className="container-page py-16">
        <h1 className="text-3xl">Order {orderNumber}</h1>
        <SurfaceMessage
          kind={state === "offline" ? "offline" : "error"}
          onRetry={() => query.refetch()}
          className="mt-8"
        />
      </div>
    );
  }

  const isCancelled = order.status === "cancelled";

  return (
    <div className="container-page py-10 lg:py-14">
      <header className="max-w-2xl">
        {!isCancelled ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" />
            </svg>
            Order confirmed
          </p>
        ) : null}

        <h1 className="mt-3 text-3xl lg:text-4xl">
          {isCancelled ? "This order was cancelled" : "Thank you"}
        </h1>

        <p className="mt-4 text-lg text-ink-muted">
          {isCancelled
            ? "Nothing further will be delivered. Any payment is refunded to the original method."
            : "We have your order and will be in touch to arrange delivery."}
        </p>

        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <Fact label="Order number" value={order.orderNumber} isMono />
          <Fact label="Placed" value={formatDate(order.placedAt)} />
          <Fact label="Total" value={formatMoney(order.total)} />
        </dl>
      </header>

      <div className="mt-12 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-12">
        <div>
          <StatusPanel order={order} />

          <OrderActions order={order} />

          <section className="mt-12">
            <h2 className="font-sans text-lg font-medium tracking-normal">
              Items
            </h2>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-5">
                  <div className="w-16 shrink-0">
                    <ProductImage src={item.imageUrl} alt="" aspect="aspect-4/3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-ink-muted tabular">
                      Qty {item.quantity} · {formatMoney(item.unitPrice)} each
                    </p>
                  </div>
                  <p data-price className="shrink-0 text-sm">
                    {formatMoney(item.lineTotal)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="mt-12 lg:mt-0">
          {order.deliveryAddress ? (
            <div className="rounded-sm border border-border bg-surface p-6">
              <h2 className="font-sans text-base font-medium tracking-normal">
                Delivering to
              </h2>
              <address className="mt-3 text-sm not-italic leading-relaxed text-ink-muted">
                <span className="block font-medium text-ink">
                  {order.deliveryAddress.recipientName}
                </span>
                {order.deliveryAddress.line1}
                {order.deliveryAddress.landmark ? (
                  <>
                    <br />
                    {order.deliveryAddress.landmark}
                  </>
                ) : null}
                <br />
                {order.deliveryAddress.city}, {order.deliveryAddress.state}{" "}
                <span className="tabular">{order.deliveryAddress.pincode}</span>
                <br />
                <span className="tabular">+91 {order.deliveryAddress.phone}</span>
              </address>
            </div>
          ) : null}

          <div className="mt-6 rounded-sm border border-border bg-surface p-6">
            <h2 className="font-sans text-base font-medium tracking-normal">
              Payment
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <SummaryRow label="Subtotal" value={formatMoney(order.subtotal)} />
              {order.discount.amount > 0 ? (
                <SummaryRow
                  label={order.couponCode ?? "Discount"}
                  value={`− ${formatMoney(order.discount)}`}
                />
              ) : null}
              <SummaryRow
                label="Delivery"
                value={
                  order.shippingFee.amount === 0
                    ? "Free"
                    : formatMoney(order.shippingFee)
                }
              />
              <div className="flex justify-between border-t border-border pt-3 font-medium">
                <dt>Total</dt>
                <dd data-price>{formatMoney(order.total)}</dd>
              </div>
            </dl>

            {/* Only present once an order is paid, and absent on legacy-era
                orders that never got an invoice row. */}
            {order.invoiceNumber ? (
              <p className="mt-4 border-t border-border pt-3 text-xs text-ink-muted">
                Invoice{" "}
                <span className="tabular text-ink">{order.invoiceNumber}</span>
                {order.invoiceDate ? ` · ${formatDate(order.invoiceDate)}` : null}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/orders"
              className="flex min-h-12 items-center justify-center rounded-sm border border-border-interactive px-6 text-sm font-medium transition-colors duration-fast hover:border-ink"
            >
              All orders
            </Link>
            <Link
              href="/shop"
              className="flex min-h-12 items-center justify-center text-sm text-accent underline-offset-4 hover:underline"
            >
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Fulfilment and payment, kept as separate rows.
 *
 * The timeline shows fulfilment progress; the payment line sits beside it
 * rather than inside it, because payment is not a stage of delivery.
 */
function StatusPanel({ order }: { order: Order }) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-sans text-lg font-medium tracking-normal">Status</h2>
        <span className="rounded-xs bg-surface-sunken px-2.5 py-1 text-xs">
          {order.statusLabel}
        </span>
        <span
          className={cn(
            "rounded-xs px-2.5 py-1 text-xs",
            order.paymentStatus === "paid"
              ? "bg-success-soft text-success"
              : order.paymentStatus === "refunded"
                ? "bg-surface-sunken text-ink-muted"
                : "bg-warning-soft text-warning",
          )}
        >
          {order.paymentStatus === "paid"
            ? "Paid"
            : order.paymentStatus === "refunded"
              ? "Refunded"
              : order.paymentStatus === "failed"
                ? "Payment failed"
                : "Payment pending"}
        </span>
      </div>

      {order.timeline.length > 0 ? (
        <ol className="mt-6">
          {order.timeline.map((entry, index) => {
            const isLast = index === order.timeline.length - 1;
            return (
              <li key={entry.statusId} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                      entry.isCompleted ? "bg-success" : "bg-lime-400",
                    )}
                  />
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "w-px flex-1",
                        entry.isCompleted ? "bg-success" : "bg-border",
                      )}
                    />
                  ) : null}
                </div>

                <div className={cn("pb-6", isLast && "pb-0")}>
                  <p
                    className={cn(
                      "text-sm",
                      entry.isCompleted ? "font-medium" : "text-ink-muted",
                    )}
                  >
                    {entry.title}
                  </p>
                  {entry.occurredAt ? (
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {formatDate(entry.occurredAt)}
                    </p>
                  ) : null}
                  {entry.note ? (
                    <p className="mt-1 text-xs text-ink-muted">{entry.note}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {order.trackingNumber ? (
        <p className="mt-4 text-sm text-ink-muted">
          {order.courierName ? `${order.courierName} · ` : null}
          <span className="tabular">{order.trackingNumber}</span>
          {order.trackingLink ? (
            <>
              {" — "}
              <a
                href={order.trackingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-4 hover:underline"
              >
                Track
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function Fact({
  label,
  value,
  isMono,
}: {
  label: string;
  value: string;
  isMono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={cn("mt-0.5 font-medium", isMono && "tabular")}>{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd data-price>{value}</dd>
    </div>
  );
}
