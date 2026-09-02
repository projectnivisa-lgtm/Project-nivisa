import { ProductCard, ProductCardSkeleton } from "@/components/commerce/ProductCard";
import type { Product } from "@/types/product";

/**
 * Product grid.
 *
 * Two columns on a phone rather than one. A single-column furniture grid feels
 * generous on a mockup and terrible in use: it puts one product per screen, so
 * comparing two sofas means scrolling between them from memory. Two columns
 * keep a pair in view at once, which is how people actually choose.
 *
 * Four columns is the maximum at 1440px+ — a fifth would drop each image below
 * the size at which upholstery texture and joinery are legible, which is the
 * whole job of the image on a furniture card.
 */
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id}>
          {/* The first row is above the fold at every breakpoint. */}
          <ProductCard product={product} priority={index < 4} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
