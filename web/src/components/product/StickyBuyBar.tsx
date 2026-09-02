"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatMoney } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import type { Product } from "@/types/product";

/**
 * Mobile sticky purchase bar.
 *
 * Appears only once the main buy panel has scrolled out of view, so it does
 * not sit on top of the buttons it duplicates. Detection observes the buy
 * panel itself, by id, rather than a sentinel rendered inside this component —
 * this component sits at the end of the page, so a local sentinel would only
 * leave the viewport once the customer reached the footer, which is exactly
 * when the bar is no longer needed.
 *
 * IntersectionObserver rather than a scroll listener: no main-thread work
 * while scrolling, which is where jank on a long image-heavy page comes from.
 *
 * Carries the price as well as the buttons. A bar that says only "Add to cart"
 * makes the customer scroll back up to check what they are committing to.
 */

/** The buy panel marks itself with this id for the observer to find. */
export const BUY_PANEL_ID = "buy-panel";

export function StickyBuyBar({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const panel = document.getElementById(BUY_PANEL_ID);
    if (!panel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Visible once the buy panel has left the viewport upwards. The
        // downward case is deliberately excluded: on first paint the panel is
        // below the fold on a phone, and showing the bar then would cover the
        // page before the customer has seen the product.
        setIsVisible(
          !entry.isIntersecting && entry.boundingClientRect.top < 0,
        );
      },
      { threshold: 0 },
    );

    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const isOutOfStock = product.stockState === "out-of-stock";

  return (
    <>
      <div
        // Clears the bottom navigation. The number lives in
        // `--space-bottom-nav` because the storefront layout has to reserve
        // exactly the same height, and two hand-written copies of a calc()
        // drift the moment the nav changes height.
        style={{ bottom: "var(--space-bottom-nav)" }}
        className={cn(
          "fixed inset-x-0 z-30 border-t border-border bg-canvas/97 backdrop-blur-sm lg:hidden",
          "transition-transform duration-slow ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          isVisible ? "translate-y-0" : "translate-y-full",
        )}
        // Hidden from assistive tech while off-screen so it is not announced
        // as a second, duplicate set of buy buttons.
        aria-hidden={!isVisible}
        inert={!isVisible}
      >
        <div className="flex items-center gap-3 px-(--space-gutter) py-3">
          <div className="min-w-0 flex-1">
            <p data-price className="truncate text-base font-semibold">
              {formatMoney(product.price.selling)}
            </p>
            {product.price.discountPercent > 0 ? (
              <p className="text-2xs text-sale">
                {product.price.discountPercent}% off
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={isOutOfStock || addItem.isPending}
            onClick={() => {
              if (!product.defaultVariantId || product.variants.length > 1) {
                document
                  .getElementById("buy-panel")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
              }
              addItem.mutate({ variantId: product.defaultVariantId, quantity: 1 });
            }}
            className={cn(
              "min-h-11 shrink-0 rounded-sm border px-4 text-sm font-medium transition-colors duration-fast",
              isOutOfStock
                ? "cursor-not-allowed border-border text-ink-subtle"
                : "border-border-interactive hover:border-ink",
            )}
          >
            {addItem.isPending ? "Adding…" : "Add"}
          </button>

          <button
            type="button"
            disabled={isOutOfStock || addItem.isPending}
            onClick={async () => {
              if (!product.defaultVariantId || product.variants.length > 1) {
                document
                  .getElementById("buy-panel")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
              }
              await addItem.mutateAsync({
                variantId: product.defaultVariantId,
                quantity: 1,
              });
              router.push("/checkout");
            }}
            className={cn(
              "min-h-11 shrink-0 rounded-sm px-5 text-sm font-medium transition-colors duration-fast",
              isOutOfStock
                ? "cursor-not-allowed bg-surface-sunken text-ink-subtle"
                : "bg-primary text-on-primary hover:bg-primary-hover",
            )}
          >
            {isOutOfStock ? "Out of stock" : "Buy now"}
          </button>
        </div>
      </div>
    </>
  );
}
