"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { useStore } from "@/hooks/useStore";
import { useWishlist } from "@/hooks/useWishlist";
import { surfaceState } from "@/lib/surfaceState";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import { CartLineRow } from "@/components/cart/CartLineRow";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { CouponField } from "@/components/cart/CouponField";
import { formatMoney } from "@/lib/utils";

/**
 * Cart.
 *
 * One job: review, then check out. So the summary is sticky beside the lines on
 * desktop and pinned to the bottom on mobile — the checkout button should never
 * be something you have to scroll to find.
 *
 * Out-of-stock lines block checkout rather than being silently dropped. Quietly
 * removing something a customer chose is worse than making them remove it: they
 * would find out at the order confirmation, if at all.
 */
export default function CartPage() {
  const {
    cart,
    isLoading,
    isError,
    refetch,
    updateQuantity,
    removeItem,
    applyCoupon,
  } = useCart();
  const { store } = useStore();
  const wishlist = useWishlist();
  const [busyLineId, setBusyLineId] = useState<string | null>(null);

  const state = surfaceState(
    {
      status: isLoading ? "pending" : isError ? "error" : "success",
      fetchStatus: "idle",
    },
    cart.lines.length === 0,
  );

  const blockedLines = cart.lines.filter(
    (line) => line.stockState === "out-of-stock",
  );
  const canCheckout = cart.lines.length > 0 && blockedLines.length === 0;

  if (state === "loading") {
    return (
      <div className="container-page py-10">
        <div className="skeleton h-9 w-40 rounded-xs" aria-hidden="true" />
        <div className="mt-8 lg:grid lg:grid-cols-[1fr_22rem] lg:gap-12">
          <div className="space-y-6" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-6">
                <div className="skeleton aspect-4/3 w-24 rounded-xs sm:w-32" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="skeleton h-4 w-2/3 rounded-xs" />
                  <div className="skeleton h-3 w-1/3 rounded-xs" />
                  <div className="skeleton h-11 w-32 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
          <div className="skeleton mt-8 h-64 rounded-sm lg:mt-0" aria-hidden="true" />
        </div>
        <span className="sr-only" role="status">
          Loading your cart
        </span>
      </div>
    );
  }

  if (state === "error" || state === "offline") {
    return (
      <div className="container-page py-16">
        <h1 className="text-3xl">Your cart</h1>
        <SurfaceMessage
          kind={state}
          onRetry={() => refetch()}
          className="mt-8"
        />
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="container-page py-16 lg:py-24">
        <h1 className="text-3xl lg:text-4xl">Your cart is empty</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-muted">
          Nothing in here yet. Start with a room, or browse everything we make.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/shop"
            className="inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
          >
            Shop all furniture
          </Link>
          <Link
            href="/wishlist"
            className="inline-flex min-h-12 items-center rounded-sm border border-border-interactive px-7 text-sm font-medium transition-colors duration-fast hover:border-ink"
          >
            View saved items
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-compact container-page py-(--space-page) lg:py-(--space-page-lg)">
      <h1 className="text-3xl lg:text-4xl">Your cart</h1>
      <p className="mt-2 text-sm text-ink-muted">
        <span className="tabular">{cart.itemCount}</span>{" "}
        {cart.itemCount === 1 ? "item" : "items"}
      </p>

      <div className="cart-grid mt-8 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-12 xl:gap-16">
        <ul className="divide-y divide-border border-y border-border">
          {cart.lines.map((line) => (
            <CartLineRow
              key={line.id}
              line={line}
              isBusy={busyLineId === line.id}
              onQuantityChange={(quantity) => {
                setBusyLineId(line.id);
                updateQuantity.mutate(
                  { lineId: line.id, quantity },
                  { onSettled: () => setBusyLineId(null) },
                );
              }}
              onRemove={() => {
                setBusyLineId(line.id);
                removeItem.mutate(line.id, {
                  onSettled: () => setBusyLineId(null),
                });
              }}
              onSaveForLater={
                // Only offered when signed in: the wishlist endpoint requires
                // auth, so for a guest this would remove the item and then
                // fail to save it anywhere.
                wishlist.isAuthenticated
                  ? () => {
                      setBusyLineId(line.id);
                      wishlist.toggle.mutate(
                        { productId: line.productId, isWishlisted: false },
                        {
                          onSuccess: () => removeItem.mutate(line.id),
                          onSettled: () => setBusyLineId(null),
                        },
                      );
                    }
                  : undefined
              }
            />
          ))}
        </ul>

        {/* Sticky on desktop; on mobile it follows the lines and the checkout
            button is repeated in a pinned bar below. */}
        <aside className="mt-10 lg:sticky lg:top-(--space-sticky-top) lg:mt-0">
          <div className="cart-summary-card rounded-sm border border-border bg-surface p-6">
            <h2 className="font-sans text-lg font-medium tracking-normal">
              Summary
            </h2>

            <div className="cart-coupon mt-5">
              <CouponField
                appliedCode={cart.appliedCouponCode}
                isBusy={applyCoupon.isPending}
                onApply={(code) => applyCoupon.mutateAsync(code)}
              />
            </div>

            <OrderSummary cart={cart} className="cart-totals mt-6" />

            {blockedLines.length > 0 ? (
              <p
                role="alert"
                className="mt-5 rounded-sm bg-destructive-soft px-4 py-3 text-xs text-destructive"
              >
                Remove the out-of-stock{" "}
                {blockedLines.length === 1 ? "item" : "items"} to continue.
              </p>
            ) : null}

            <Link
              href={canCheckout ? "/checkout" : "#"}
              aria-disabled={!canCheckout}
              tabIndex={canCheckout ? undefined : -1}
              className={
                canCheckout
                  ? "cart-checkout mt-6 flex min-h-12 items-center justify-center rounded-sm bg-primary text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
                  : "cart-checkout mt-6 flex min-h-12 cursor-not-allowed items-center justify-center rounded-sm bg-surface-sunken text-sm font-medium text-ink-subtle"
              }
            >
              Checkout
            </Link>

            <p className="mt-4 text-center text-2xs text-ink-muted">
              {store?.freeDeliveryAbove
                ? `Free delivery and assembly above ${formatMoney({
                    amount: store.freeDeliveryAbove,
                    currency: "INR",
                  })}`
                : "Delivery is calculated from your address at checkout."}
            </p>
          </div>

          <Link
            href="/shop"
            className="mt-4 hidden min-h-11 items-center justify-center text-sm text-accent underline-offset-4 hover:underline lg:flex"
          >
            Continue shopping
          </Link>
        </aside>
      </div>

      {/* Mobile: the total and the button, always reachable. */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-canvas/97 px-(--space-gutter) py-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-2xs text-ink-muted">Total</p>
            <p data-price className="truncate text-base font-semibold">
              {formatMoney(cart.total)}
            </p>
          </div>
          <Link
            href={canCheckout ? "/checkout" : "#"}
            aria-disabled={!canCheckout}
            className={
              canCheckout
                ? "flex min-h-11 shrink-0 items-center rounded-sm bg-primary px-6 text-sm font-medium text-on-primary"
                : "flex min-h-11 shrink-0 cursor-not-allowed items-center rounded-sm bg-surface-sunken px-6 text-sm font-medium text-ink-subtle"
            }
          >
            Checkout
          </Link>
        </div>
      </div>
      {/* Clears the pinned bar so the last line is never trapped under it. */}
      <div aria-hidden="true" className="h-20 lg:hidden" />
    </div>
  );
}
