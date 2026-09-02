"use client";

import Link from "next/link";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/hooks/useCart";
import { ProductCard, ProductCardSkeleton } from "@/components/commerce/ProductCard";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";

/**
 * Saved pieces.
 *
 * Furniture wishlists are a shortlist, not a hoard — people save three sofas
 * and choose one. So each card carries a direct "Move to cart", which is the
 * action the list exists to lead to; without it the customer has to open each
 * product again to do the thing they already decided.
 */
export function WishlistGrid() {
  const { products, isLoading, isError, isEmpty, isAuthenticated } = useWishlist();
  const { addItem } = useCart();

  if (!isAuthenticated) {
    return (
      <div className="rounded-sm border border-border bg-surface px-6 py-14 text-center">
        <p className="text-lg font-medium">Sign in to see your saved pieces</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          Saving a piece keeps it here across devices, so you can compare before
          you commit.
        </p>
        <Link
          href="/login?next=/wishlist"
          className="mt-7 inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <SurfaceMessage kind="error" />;
  }

  if (isEmpty) {
    return (
      <div className="rounded-sm border border-border bg-surface px-6 py-14 text-center">
        <p className="text-lg font-medium">Nothing saved yet</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          Tap the heart on any piece to keep it here while you decide.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Browse furniture
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
          {/* A saved product with one option can go straight to the cart. One
              with several cannot: choosing a finish on the customer's behalf
              is guessing, so the button becomes a link to the piece where the
              options actually are. */}
          {product.defaultVariantId ? (
            <button
              type="button"
              disabled={product.stockState === "out-of-stock" || addItem.isPending}
              onClick={() =>
                addItem.mutate({
                  variantId: product.defaultVariantId as string,
                  quantity: 1,
                })
              }
              className="mt-3 min-h-11 w-full rounded-sm border border-border-interactive text-sm transition-colors duration-fast hover:border-ink disabled:cursor-not-allowed disabled:text-ink-subtle"
            >
              {product.stockState === "out-of-stock"
                ? "Out of stock"
                : "Move to cart"}
            </button>
          ) : (
            <Link
              href={`/product/${product.slug}`}
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-sm border border-border-interactive text-sm transition-colors duration-fast hover:border-ink"
            >
              Choose options
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
