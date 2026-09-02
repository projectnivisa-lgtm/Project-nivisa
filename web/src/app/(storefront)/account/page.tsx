"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AccountShell } from "@/components/account/AccountShell";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { orderSource } from "@/lib/orderSource";
import { customerSource } from "@/lib/customerSource";
import { formatDate, formatMoney } from "@/lib/utils";

/**
 * Account overview.
 *
 * Leads with the most recent order, because "where is my thing" is what brings
 * people to an account page. Everything else is a count and a way in — this is
 * a junction, not a destination, and filling it with a dashboard of widgets
 * would just delay the click the customer came to make.
 */
export default function AccountPage() {
  const { customer, isAuthenticated } = useAuth();
  const wishlist = useWishlist();

  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => orderSource.list(),
    enabled: isAuthenticated,
  });

  const addresses = useQuery({
    queryKey: ["addresses", "shipping"],
    queryFn: () => customerSource.listAddresses("shipping"),
    enabled: isAuthenticated,
  });

  const latest = orders.data?.[0];
  const greeting = customer?.name ? `Hello, ${customer.name}` : "Your account";

  return (
    <AccountShell title={greeting}>
      {latest ? (
        <section>
          <h2 className="font-sans text-lg font-medium tracking-normal">
            Latest order
          </h2>
          <Link
            href={`/order/${latest.orderNumber}`}
            className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-sm border border-border bg-surface p-5 transition-colors duration-fast hover:border-ink"
          >
            <div className="min-w-0 flex-1">
              <span className="rounded-xs bg-surface-sunken px-2.5 py-1 text-xs">
                {latest.statusLabel}
              </span>
              <p className="mt-2.5 text-sm font-medium tabular">
                {latest.orderNumber}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted tabular">
                {formatDate(latest.placedAt)} · {latest.itemCount}{" "}
                {latest.itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <p data-price className="text-lg font-semibold">
              {formatMoney(latest.total)}
            </p>
          </Link>
        </section>
      ) : null}

      <section className={latest ? "mt-12" : undefined}>
        <h2 className="font-sans text-lg font-medium tracking-normal">
          Everything else
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          <Tile
            href="/account/orders"
            label="Orders"
            detail={
              orders.isPending
                ? "Loading…"
                : `${orders.data?.length ?? 0} placed`
            }
          />
          <Tile
            href="/account/wishlist"
            label="Saved pieces"
            detail={
              wishlist.isLoading
                ? "Loading…"
                : `${wishlist.products.length} saved`
            }
          />
          <Tile
            href="/account/addresses"
            label="Addresses"
            detail={
              addresses.isPending
                ? "Loading…"
                : `${addresses.data?.length ?? 0} saved`
            }
          />
          <Tile
            href="/account/profile"
            label="Profile"
            detail={customer?.email ? customer.email : "Add your email"}
          />
        </ul>
      </section>
    </AccountShell>
  );
}

function Tile({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-20 items-center justify-between gap-4 rounded-sm border border-border bg-surface p-5 transition-colors duration-fast hover:border-ink"
      >
        <span>
          <span className="block text-sm font-medium">{label}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-muted">
            {detail}
          </span>
        </span>
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
  );
}
