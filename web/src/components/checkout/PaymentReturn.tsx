"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orderSource, startPayment } from "@/lib/orderSource";
import { formatMoney } from "@/lib/utils";

/**
 * The landing state after the payment gateway sends the browser back.
 *
 * The gateway returns to `/checkout?order=…` with no indication of the
 * outcome, so the outcome has to be read from the order itself. The backend
 * re-checks payment status server-to-server when an unpaid order carrying an
 * in-flight reference is fetched, which means simply reading the order is what
 * confirms the payment.
 *
 * That check is not always instant, so an unpaid result is retried a few times
 * before being reported as failed — telling someone their payment failed while
 * it is still settling is the worst possible false negative, and typically
 * produces a second payment for the same order.
 */
const CONFIRM_ATTEMPTS = 5;
const CONFIRM_INTERVAL_MS = 2000;

export function PaymentReturn({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();

  const query = useQuery({
    queryKey: ["order", orderNumber, "confirm"],
    queryFn: () => orderSource.get(orderNumber),
    // Keep re-reading while the payment is still unconfirmed. The backend
    // reconciles on read, so each attempt is a real check, not a poll of a
    // cached value.
    refetchInterval: (q) =>
      q.state.data?.paymentStatus === "paid" ? false : CONFIRM_INTERVAL_MS,
    retry: 2,
  });

  const order = query.data;
  const isPaid = order?.paymentStatus === "paid";

  // A wall-clock deadline rather than a count of query results: the number of
  // refetches is not observable from the result object, and time is what the
  // customer is actually experiencing while they wait.
  const [hasTimedOut, setHasTimedOut] = useState(false);
  useEffect(() => {
    if (isPaid) return;
    const timer = setTimeout(
      () => setHasTimedOut(true),
      CONFIRM_ATTEMPTS * CONFIRM_INTERVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [isPaid]);

  useEffect(() => {
    if (isPaid) router.replace(`/order/${orderNumber}`);
  }, [isPaid, orderNumber, router]);

  if (query.isPending || (!isPaid && !hasTimedOut && !query.isError)) {
    return (
      <Shell title="Confirming your payment">
        <p className="mt-4 text-ink-muted">
          This takes a few seconds. Please do not close this page or press back.
        </p>
        <div
          className="mx-auto mt-8 h-1 w-40 overflow-hidden rounded-full bg-surface-sunken"
          aria-hidden="true"
        >
          <div className="skeleton h-full w-full" />
        </div>
        <span className="sr-only" role="status">
          Confirming payment for order {orderNumber}
        </span>
      </Shell>
    );
  }

  if (query.isError || !order) {
    return (
      <Shell title="We could not check your payment">
        <p className="mt-4 text-ink-muted">
          Your order number is{" "}
          <span className="font-medium tabular">{orderNumber}</span>. If money
          has left your account, the order is safe — open it from your orders in
          a minute, or call us and quote that number.
        </p>
        <Actions orderNumber={orderNumber} />
      </Shell>
    );
  }

  // The deadline passed with the order still unpaid.
  return (
    <Shell title="Your payment did not complete">
      <p className="mt-4 text-ink-muted">
        Order{" "}
        <span className="font-medium tabular">{order.orderNumber}</span> for{" "}
        <span className="font-medium">{formatMoney(order.total)}</span> is saved
        but unpaid. Nothing has been charged. You can pay for it now without
        rebuilding your cart.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => startPayment(order.orderNumber)}
          className="inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Try payment again
        </button>
        <Link
          href={`/order/${order.orderNumber}`}
          className="inline-flex min-h-12 items-center rounded-sm border border-border-interactive px-7 text-sm font-medium transition-colors duration-fast hover:border-ink"
        >
          View order
        </Link>
      </div>
    </Shell>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-page py-24 text-center">
      <div className="mx-auto max-w-lg">
        <h1 className="text-3xl">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function Actions({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <Link
        href={`/order/${orderNumber}`}
        className="inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
      >
        View order
      </Link>
      <Link
        href="/orders"
        className="inline-flex min-h-12 items-center rounded-sm border border-border-interactive px-7 text-sm font-medium transition-colors duration-fast hover:border-ink"
      >
        All orders
      </Link>
    </div>
  );
}
