"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/commerce/ProductImage";
import type { ArtKey } from "@/config/navigation";

export interface GalleryView {
  /** Real photograph when one exists, otherwise line art by `art`. */
  url?: string | null;
  art: ArtKey;
  alt: string;
}

/**
 * Product gallery.
 *
 * Desktop: a vertical thumbnail strip beside a large frame. Thumbnails go on
 * the left rather than underneath so the main image can be as tall as the
 * viewport allows — on furniture, image size is the product information.
 *
 * Mobile: a swipeable, snapping track with dot indicators. A carousel with
 * arrow buttons is the wrong control on a touch device; swiping is what people
 * already do, and the dots exist to say how many views there are rather than
 * to be tapped.
 *
 * Zoom is press-and-hold-to-magnify on the main frame, not a lightbox: it
 * keeps the customer on the page and works with one hand.
 */
export function ProductGallery({ views }: { views: GalleryView[] }) {
  const [active, setActive] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const trackRef = useRef<HTMLDivElement>(null);

  const current = views[active] ?? views[0];
  const canZoom = Boolean(current?.url);

  if (views.length === 0) return null;

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isZoomed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  return (
    <div className="lg:flex lg:gap-4">
      {/* ------------------------------------------------ Desktop thumbnails */}
      {views.length > 1 ? (
        <div
          role="tablist"
          aria-label="Product images"
          aria-orientation="vertical"
          className="hidden w-20 shrink-0 flex-col gap-3 lg:flex"
        >
          {views.map((view, index) => (
            <button
              key={index}
              role="tab"
              type="button"
              aria-selected={index === active}
              aria-label={`View ${index + 1} of ${views.length}`}
              onClick={() => setActive(index)}
              className={cn(
                "overflow-hidden rounded-xs border transition-colors duration-fast",
                index === active
                  ? "border-ink"
                  : "border-border hover:border-border-interactive",
              )}
            >
              <ProductImage
                src={view.url}
                alt=""
                art={view.art}
                aspect="aspect-4/3"
              />
            </button>
          ))}
        </div>
      ) : null}

      {/* ------------------------------------------------------- Main frame */}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "relative hidden overflow-hidden rounded-sm lg:block",
            canZoom && (isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"),
          )}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setIsZoomed(false)}
          onClick={() => canZoom && setIsZoomed((z) => !z)}
        >
          <div
            className="transition-transform duration-slow ease-[cubic-bezier(0.22,0.61,0.36,1)]"
            style={
              isZoomed
                ? {
                    transform: "scale(2)",
                    transformOrigin: `${origin.x}% ${origin.y}%`,
                  }
                : undefined
            }
          >
            <ProductImage
              src={current.url}
              alt={current.alt}
              art={current.art}
              // Landscape, matching the shape the photographs are delivered
              // in. A 4:5 frame cropped a straight-on sofa to its cushions and
              // stood taller than the buy panel beside it, so the price and
              // the add-to-cart button started below the fold on a laptop.
              aspect="aspect-4/3"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          {canZoom ? (
            <p className="pointer-events-none absolute bottom-3 right-3 rounded-xs bg-surface/90 px-2.5 py-1 text-2xs text-ink-muted">
              {isZoomed ? "Click to zoom out" : "Click to zoom"}
            </p>
          ) : null}
        </div>

        {/* ------------------------------------------ Mobile swipeable track */}
        <div className="lg:hidden">
          <div
            ref={trackRef}
            className="rail -mx-(--space-gutter) gap-0 px-0"
            onScroll={(event) => {
              const el = event.currentTarget;
              const index = Math.round(el.scrollLeft / el.clientWidth);
              if (index !== active) setActive(index);
            }}
          >
            {views.map((view, index) => (
              <div key={index} className="w-screen">
                <ProductImage
                  src={view.url}
                  alt={view.alt}
                  art={view.art}
                  aspect="aspect-4/3"
                  priority={index === 0}
                  sizes="100vw"
                />
              </div>
            ))}
          </div>

          {views.length > 1 ? (
            <div className="mt-3 flex justify-center gap-1.5">
              {views.map((_, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-fast",
                    index === active ? "w-5 bg-ink" : "w-1.5 bg-lime-400",
                  )}
                />
              ))}
              <span className="sr-only" role="status">
                Image {active + 1} of {views.length}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
