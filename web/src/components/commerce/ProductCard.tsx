import Link from "next/link";
import { cn, formatDimensions } from "@/lib/utils";
import { demoArtKey } from "@/lib/demo";
import { ProductImage } from "./ProductImage";
import { PriceDisplay } from "./PriceDisplay";
import { Rating } from "./Rating";
import { WishlistButton } from "./WishlistButton";
import type { ArtKey } from "@/config/navigation";
import type { Product, ProductBadge } from "@/types/product";

/**
 * Product card.
 *
 * Furniture cards live or die on two things: the image being large, and the
 * shopper being able to tell whether the piece fits. So the frame gets the
 * majority of the card, and dimensions sit directly under the name — above the
 * rating, because "210 × 90 cm" answers a question that four-and-a-half stars
 * cannot.
 *
 * Deliberately absent: a quick-add button. Furniture is not an impulse
 * purchase; a customer who has not chosen a finish or checked delivery is not
 * ready to add to cart, and a card-level Add button on a ₹43,000 sofa produces
 * abandoned carts rather than orders. The card's job is to earn the click.
 */

const BADGE_STYLES: Record<ProductBadge, string> = {
  sale: "bg-sale-soft text-sale",
  new: "bg-accent-soft text-clay-700",
  bestseller: "bg-verd-50 text-secondary",
  "low-stock": "bg-warning-soft text-warning",
  "made-to-order": "bg-surface-sunken text-ink-muted",
  "ar-ready": "bg-surface-sunken text-ink-muted",
};

const BADGE_LABELS: Record<ProductBadge, string> = {
  sale: "Sale",
  new: "New",
  bestseller: "Bestseller",
  "low-stock": "Few left",
  "made-to-order": "Made to order",
  "ar-ready": "View in your room",
};

/** One badge only. A card wearing four badges communicates nothing. */
const BADGE_PRIORITY: ProductBadge[] = [
  "low-stock",
  "bestseller",
  "new",
  "sale",
  "made-to-order",
  "ar-ready",
];

function leadBadge(badges: ProductBadge[]): ProductBadge | null {
  return BADGE_PRIORITY.find((b) => badges.includes(b)) ?? null;
}

export function ProductCard({
  product,
  priority = false,
  className,
}: {
  product: Product;
  priority?: boolean;
  className?: string;
}) {
  const badge = leadBadge(product.badges);
  const dimensions = product.dimensions
    ? formatDimensions(product.dimensions)
    : null;
  const art = (demoArtKey(product) as ArtKey | undefined) ?? "sofa";
  const material = product.specs?.material;

  return (
    <article className={cn("group relative", className)}>
      <Link
        href={`/product/${product.slug}`}
        // The whole card is the target, but the accessible name comes from the
        // heading below rather than repeating every scrap of text in a label.
        className="block focus-visible:outline-none"
      >
        <div className="relative">
          <ProductImage
            src={product.images[0]?.url}
            alt={product.name}
            art={art}
            priority={priority}
            className="transition-shadow duration-slow group-hover:shadow-card"
          />

          {badge ? (
            <span
              className={cn(
                "absolute left-3 top-3 rounded-xs px-2 py-1 text-2xs font-medium",
                BADGE_STYLES[badge],
              )}
            >
              {BADGE_LABELS[badge]}
            </span>
          ) : null}

          {product.stockState === "out-of-stock" ? (
            <span className="absolute inset-x-0 bottom-0 bg-ink/85 px-3 py-2 text-center text-xs text-ink-inverse">
              Out of stock
            </span>
          ) : null}
        </div>

        <div className="mt-3.5">
          <h3 className="font-sans text-base font-medium leading-snug tracking-normal group-hover:text-accent">
            {/* Stretched link: the click target covers the card without
                nesting interactive elements inside an anchor. */}
            <span className="absolute inset-0" aria-hidden="true" />
            {product.name}
          </h3>

          {dimensions || material ? (
            <p className="mt-1 text-xs text-ink-muted tabular">
              {[dimensions, material].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          <PriceDisplay price={product.price} size="sm" className="mt-2" />

          {product.rating ? (
            <Rating rating={product.rating} className="mt-2" />
          ) : null}
        </div>
      </Link>

      {/* Sits above the stretched link so it stays independently clickable. */}
      <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
        <WishlistButton productId={product.id} productName={product.name} />
      </div>
    </article>
  );
}

/** Matches the card's exact geometry so the grid never shifts on load. */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton aspect-4/3 rounded-xs" />
      <div className="skeleton mt-3.5 h-4 w-4/5 rounded-xs" />
      <div className="skeleton mt-2 h-3 w-3/5 rounded-xs" />
      <div className="skeleton mt-2.5 h-5 w-2/5 rounded-xs" />
    </div>
  );
}
