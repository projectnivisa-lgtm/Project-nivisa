"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orderSource } from "@/lib/orderSource";
import { useAuth } from "@/hooks/useAuth";
import { surfaceState } from "@/lib/surfaceState";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import { OrderRows } from "@/components/account/OrderRows";

/**
 * Order history, reached from the order confirmation.
 *
 * The same list as `/account/orders`, without the account navigation — someone
 * arriving straight from a confirmation is following one thread, and does not
 * need the whole account section wrapped around it. Both render `OrderRows`.
 */
export default function OrdersPage() {
  const { isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: ["orders"],
    queryFn: () => orderSource.list(),
    enabled: isAuthenticated,
  });

  const orders = query.data ?? [];

  if (!isAuthenticated) {
    return (
      <div className="container-page py-20">
        <h1 className="text-3xl lg:text-4xl">Your orders</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-muted">
          Sign in with your mobile number to see your orders and track
          deliveries.
        </p>
        <Link
          href="/login?next=/orders"
          className="mt-8 inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const state = surfaceState(query, orders.length === 0);

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl lg:text-4xl">Your orders</h1>
        <Link
          href="/account"
          className="min-h-11 text-sm text-accent underline-offset-4 hover:underline"
        >
          Account settings
        </Link>
      </div>

      <div className="mt-10">
        {state === "loading" ? (
          <div className="space-y-4" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-28 rounded-sm" />
            ))}
          </div>
        ) : state === "error" || state === "offline" ? (
          <SurfaceMessage kind={state} onRetry={() => query.refetch()} />
        ) : state === "empty" ? (
          <div className="rounded-sm border border-border bg-surface px-6 py-16 text-center">
            <p className="text-lg font-medium">No orders yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              When you order something, it will appear here with its delivery
              status.
            </p>
            <Link
              href="/shop"
              className="mt-7 inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <OrderRows orders={orders} />
        )}
      </div>
    </div>
  );
}
