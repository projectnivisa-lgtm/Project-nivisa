import { cn } from "@/lib/utils";
import { stockSrcSet } from "@/config/stockImages";
import type { ArtKey } from "@/config/navigation";

/**
 * Product imagery, with an honest fallback.
 *
 * The catalogue has at most one image per product today (docs/API-GAPS.md §2),
 * and demo products have none at all. Rather than shipping grey boxes or
 * stock photography that misrepresents a real product, a missing image renders
 * as deliberate line art on a warm material ground: it reads as a considered
 * empty state rather than a broken one, and nobody can mistake it for a
 * photograph of the item they are buying.
 *
 * Every frame reserves its aspect ratio, so a grid never reflows as images
 * arrive — the single largest source of layout shift on an image-heavy store.
 */

const PATHS: Record<ArtKey, React.ReactNode> = {
  sofa: (
    <>
      <path d="M14 44v14M86 44v14M10 46h80" />
      <path d="M18 46V30a4 4 0 0 1 4-4h56a4 4 0 0 1 4 4v16" />
      <path d="M26 46V34h48v12" />
      <path d="M10 46a4 4 0 0 1 4-4h4v4M90 46a4 4 0 0 0-4-4h-4v4" />
    </>
  ),
  bed: (
    <>
      <path d="M12 56V34a4 4 0 0 1 4-4h12v14" />
      <path d="M88 56V40" />
      <path d="M12 44h76v12H12z" />
      <path d="M28 44v-6h24v6" />
      <path d="M16 56v6M84 56v6" />
    </>
  ),
  wardrobe: (
    <>
      <rect x="24" y="18" width="52" height="58" rx="2" />
      <path d="M50 18v58" />
      <path d="M45 44v8M55 44v8" />
      <path d="M28 76v6M72 76v6" />
    </>
  ),
  table: (
    <>
      <path d="M12 40h76" />
      <path d="M12 40v4h76v-4" />
      <path d="M22 44v22M78 44v22" />
      <path d="M22 60h56" />
    </>
  ),
  chair: (
    <>
      <path d="M32 24h36v26H32z" />
      <path d="M28 50h44" />
      <path d="M32 50v22M68 50v22" />
      <path d="M36 34h28M36 42h28" />
    </>
  ),
  storage: (
    <>
      <rect x="22" y="16" width="56" height="64" rx="2" />
      <path d="M22 32h56M22 48h56M22 64h56" />
      <path d="M32 20v8M40 18v10" />
    </>
  ),
  mattress: (
    <>
      <rect x="14" y="38" width="72" height="24" rx="8" />
      <path d="M26 44v12M38 44v12M50 44v12M62 44v12M74 44v12" />
    </>
  ),
  decor: (
    <>
      <rect x="30" y="20" width="40" height="52" rx="2" />
      <path d="M38 56l12-16 10 13 6-7" />
      <circle cx="42" cy="34" r="4" />
    </>
  ),
  lighting: (
    <>
      <path d="M36 20h28l6 18H30z" />
      <path d="M50 38v34" />
      <path d="M36 76h28" />
      <path d="M44 76v-4h12v4" />
    </>
  ),
  study: (
    <>
      <path d="M14 44h72v4H14z" />
      <path d="M20 48v24M80 48v24" />
      <rect x="30" y="26" width="30" height="18" rx="1" />
      <path d="M20 56h30" />
    </>
  ),
  outdoor: (
    <>
      <path d="M24 46h52" />
      <path d="M30 46V32h40v14" />
      <path d="M28 46v20M72 46v20" />
      <path d="M36 36h28M36 41h28" />
    </>
  ),
  kids: (
    <>
      <path d="M20 60V34a4 4 0 0 1 4-4h10v10" />
      <path d="M80 60V44" />
      <path d="M20 48h60v12H20z" />
      <circle cx="66" cy="30" r="7" />
    </>
  ),
};

export interface ProductImageProps {
  src?: string | null;
  alt: string;
  /** Which silhouette to draw when there is no image. */
  art?: ArtKey;
  /**
   * Tailwind aspect utility.
   *
   * Landscape by default, because furniture is: a sofa, a bed and a dining
   * table are all wide subjects photographed straight on, and a portrait frame
   * crops a three-seater down to its middle cushion. The line-art fallback was
   * what made a taller frame look right, and it is the thing being replaced.
   */
  aspect?: string;
  className?: string;
  /** Above-the-fold images opt out of lazy loading. */
  priority?: boolean;
  sizes?: string;
}

export function ProductImage({
  src,
  alt,
  art = "sofa",
  aspect = "aspect-4/3",
  className,
  priority = false,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
}: ProductImageProps) {
  if (src) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-surface-sunken rounded-xs",
          aspect,
          className,
        )}
      >
        {/* A plain <img> rather than next/image: product URLs come from a CDN
            whose hostnames are configured per environment, and an unconfigured
            host makes next/image throw at request time. Revisit once the CDN
            origins are pinned. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          // Lets the browser fetch a width that matches the slot. Without it
          // `sizes` does nothing - there is only one candidate - and a 310px
          // card downloads the same file as a full-bleed hero.
          srcSet={stockSrcSet(src)}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          sizes={sizes}
          className="h-full w-full object-cover transition-transform duration-slow ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.03]"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xs bg-surface-sunken",
        aspect,
        className,
      )}
    >
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={alt}
        className="h-full w-full text-lime-500"
        preserveAspectRatio="xMidYMid meet"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          {PATHS[art]}
        </g>
      </svg>
    </div>
  );
}
