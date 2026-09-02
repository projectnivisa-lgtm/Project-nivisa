"use client";

import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { ProductRail } from "./ProductRail";

/**
 * "Recently viewed" rail.
 *
 * Furniture is a long, interrupted decision — people leave and come back
 * several times before buying — so getting someone back to the piece they were
 * looking at last week is one of the few genuinely useful recommendations a
 * shop can make. Unlike "you might also like", it is based on something the
 * customer actually did.
 *
 * Renders nothing at all when there is nothing to show, or when the only thing
 * to show is the page you are already on. A heading over an empty rail, or a
 * rail whose single entry is the current product, both look broken.
 */
export function RecentlyViewedRail({
  excludeProductId,
  heading = "Recently viewed",
  className,
}: {
  /** The product being viewed, so the rail does not point at itself. */
  excludeProductId?: string;
  heading?: string;
  className?: string;
}) {
  const { products, isLoading } = useRecentlyViewed();

  const visible = excludeProductId
    ? products.filter((product) => product.id !== excludeProductId)
    : products;

  // No skeleton: this rail is supplementary, and reserving space for something
  // that usually turns out to be empty pushes the page around for no reason.
  if (isLoading || visible.length === 0) return null;

  return (
    <section className={className} aria-labelledby="recently-viewed-heading">
      <h2 id="recently-viewed-heading" className="container-page text-2xl">
        {heading}
      </h2>
      <div className="mt-8">
        <ProductRail products={visible} />
      </div>
    </section>
  );
}
