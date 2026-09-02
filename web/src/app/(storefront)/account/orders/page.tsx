"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AccountShell } from "@/components/account/AccountShell";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import { useAuth } from "@/hooks/useAuth";
import { orderSource } from "@/lib/orderSource";
import { surfaceState } from "@/lib/surfaceState";
import { OrderRows } from "@/components/account/OrderRows";

/**
 * Orders inside the account area.
 *
 * `/orders` and `/account/orders` are both linked from around the site — the
 * confirmation page goes to the first, the account navigation to the second.
 * Rather than redirect one to the other (which loses the account navigation
 * and confuses the back button), both render the same `OrderRows`.
 */
export default function AccountOrdersPage() {
  const { isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: ["orders"],
    queryFn: () => orderSource.list(),
    enabled: isAuthenticated,
  });

  const orders = query.data ?? [];
  const state = surfaceState(query, orders.length === 0);

  return (
    <AccountShell title="Orders">
      {state === "loading" ? (
        <div className="space-y-4" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-28 rounded-sm" />
          ))}
        </div>
      ) : state === "error" || state === "offline" ? (
        <SurfaceMessage kind={state} onRetry={() => query.refetch()} />
      ) : state === "empty" ? (
        <div className="rounded-sm border border-border bg-surface px-6 py-14 text-center">
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
    </AccountShell>
  );
}
