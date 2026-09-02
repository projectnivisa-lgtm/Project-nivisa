import { cn } from "@/lib/utils";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import type { Product } from "@/types/product";

/**
 * Horizontal product rail.
 *
 * Scroll-snapped and edge-bled on mobile so a card is visibly cut off at the
 * right — the clearest possible signal that the row continues, and far more
 * reliable than an arrow affordance nobody taps. On desktop the same list
 * becomes a grid, because a scroll rail on a wide screen hides products behind
 * a gesture mouse users have to discover.
 *
 * Both layouts are ONE list, switched by CSS. Rendering a mobile rail and a
 * desktop grid as separate trees is the obvious approach and the wrong one:
 * browsers still fetch images inside `display: none`, so every visitor would
 * download both sets. On an image-heavy furniture homepage that doubles the
 * image payload of every rail on the page.
 *
 * Renders nothing when empty rather than an empty band — a homepage showing
 * "No products" under a heading it wrote itself looks broken.
 */
export function ProductRail({
  products,
  isLoading = false,
  skeletonCount = 4,
}: {
  products: Product[];
  isLoading?: boolean;
  skeletonCount?: number;
}) {
  if (isLoading) {
    return (
      <div className="container-page grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <ul
      className={cn(
        // Mobile: a bled, snapping scroll rail.
        "rail gap-4 px-(--space-gutter) pb-2",
        // Desktop: a four-up grid inside the page container. `rail` utilities
        // are neutralised rather than duplicated in a second tree.
        "lg:mx-auto lg:grid lg:max-w-(--container-page) lg:grid-cols-4 lg:gap-6",
        "lg:overflow-visible lg:px-(--space-gutter-lg)",
        // A fifth and sixth card are worth scrolling to on a phone but would
        // start a lopsided second row on desktop.
        "lg:[&>li:nth-child(n+5)]:hidden",
      )}
    >
      {products.map((product, index) => (
        <li key={product.id} className="w-[62vw] max-w-64 sm:w-[38vw] lg:w-auto lg:max-w-none">
          <ProductCard product={product} priority={index < 4} />
        </li>
      ))}
    </ul>
  );
}
