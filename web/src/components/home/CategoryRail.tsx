"use client";

import Link from "next/link";
import { useCategories } from "@/hooks/useProducts";
import { artForCategory } from "@/config/navigation";
import { ProductImage } from "@/components/commerce/ProductImage";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import { surfaceState } from "@/lib/surfaceState";
import { cn } from "@/lib/utils";

/**
 * Shop by category, from the live catalogue.
 *
 * Every state goes through `surfaceState` rather than raw query flags:
 * loading (skeletons of the same geometry), offline, error, empty (renders
 * nothing rather than an empty band under its own heading), and ready. See
 * `lib/surfaceState.ts` for the two failure modes that are easy to miss.
 */

/** Shown at most. Beyond this the band stops being a summary. */
const MAX_TILES = 6;

/**
 * The desktop grid is sized to what there actually is.
 *
 * A fixed six columns leaves a visibly empty slot when the shop has five
 * top-level categories, which reads as a tile that failed to load rather than
 * as a deliberate layout. Written out in full because Tailwind only ships
 * classes it can see as literal strings.
 */
const COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

/**
 * Mobile a bled, snapping scroll rail; desktop a grid inside the page
 * container. Matches `ProductRail` — the `rail` utilities are neutralised
 * at `lg` rather than duplicated in a second element tree.
 *
 * `lg:mx-auto lg:max-w-(--container-page) lg:px-(--space-gutter-lg)` is what
 * lines the tiles up with the heading above them. Without it the grid runs
 * edge to edge while the heading sits at the gutter, and the first tile is
 * clipped by the viewport.
 */
const LAYOUT = cn(
  "rail gap-4 px-(--space-gutter)",
  "lg:mx-auto lg:grid lg:max-w-(--container-page) lg:gap-6",
  "lg:overflow-visible lg:px-(--space-gutter-lg)",
);

export function CategoryRail() {
  const query = useCategories();
  const { categories, refetch } = query;
  const state = surfaceState(query, categories.length === 0);

  if (state === "loading") {
    return (
      <div className={cn(LAYOUT, COLUMNS[MAX_TILES])}>
        {Array.from({ length: MAX_TILES }).map((_, i) => (
          <div key={i} className="w-36 lg:w-auto" aria-hidden="true">
            <div className="skeleton aspect-square rounded-xs" />
            <div className="skeleton mt-3 h-3.5 w-3/4 rounded-xs" />
          </div>
        ))}
      </div>
    );
  }

  if (state === "offline" || state === "error") {
    return (
      <div className="container-page">
        <SurfaceMessage kind={state} onRetry={() => refetch()} />
      </div>
    );
  }

  if (state === "empty") return null;

  const shown = categories.slice(0, MAX_TILES);

  return (
    <ul className={cn(LAYOUT, COLUMNS[shown.length] ?? COLUMNS[MAX_TILES])}>
      {shown.map((category) => (
        <li key={category.id} className="w-36 lg:w-auto">
          <Link href={`/category/${category.slug}`} className="group block">
            <ProductImage
              src={category.imageUrl}
              alt={category.name}
              aspect="aspect-square"
              art={artForCategory(category.slug || category.name)}
              // A fixed 144px tile on the phone rail; a share of the row once
              // the rail becomes a grid.
              sizes="(max-width: 1024px) 144px, 16vw"

              className="transition-shadow duration-slow group-hover:shadow-card"
            />
            <p className="mt-3 text-sm font-medium leading-snug group-hover:text-accent">
              {category.name}
            </p>
            {category.productCount > 0 ? (
              <p className="mt-0.5 text-xs text-ink-muted tabular">
                {category.productCount} piece{category.productCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
