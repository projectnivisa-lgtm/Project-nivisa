"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildListingHref, CLEARABLE_PARAMS, PRICE_BUCKETS } from "@/lib/listing";
import type { Category } from "@/api/catalog";
import type { ProductFilters } from "@/types/product";

/**
 * The filter body, shared by the desktop sidebar and the mobile drawer.
 *
 * Only filters the backend can actually apply are rendered: category, price,
 * availability. The furniture facets the domain model carries — material,
 * finish, colour, room, style, seating capacity, rating — have no API
 * behind them (API-GAPS §2, §4) and are deliberately NOT shown greyed out.
 * A disabled filter is worse than an absent one: it advertises a capability,
 * occupies the space a working control could use, and reads as broken. The
 * schema is ready in `ProductFilters`; the UI appears when the API does.
 *
 * Each section is a `<details>` so the open/closed state survives without
 * JavaScript and is keyboard-operable for free.
 */
export function FilterControls({
  filters,
  categories,
  onNavigate,
}: {
  filters: ProductFilters;
  categories: Category[];
  /** Lets the mobile drawer close itself after a filter is applied. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [customMin, setCustomMin] = useState(
    filters.minPrice !== undefined ? String(filters.minPrice) : "",
  );
  const [customMax, setCustomMax] = useState(
    filters.maxPrice !== undefined ? String(filters.maxPrice) : "",
  );

  function apply(patch: Record<string, string | number | null>) {
    const current = Object.fromEntries(searchParams.entries());
    router.push(buildListingHref(pathname, current, patch), { scroll: false });
    onNavigate?.();
  }

  const activeBucket = PRICE_BUCKETS.findIndex(
    (b) => b.min === filters.minPrice && b.max === filters.maxPrice,
  );

  return (
    <div className="divide-y divide-border">
      {categories.length > 0 ? (
        <Section title="Category" defaultOpen>
          <ul className="space-y-0.5">
            <li>
              <FilterButton
                isActive={!filters.categoryId}
                onClick={() => apply({ c: null })}
              >
                All categories
              </FilterButton>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <FilterButton
                  isActive={filters.categoryId === category.id}
                  onClick={() => apply({ c: category.id })}
                  count={category.productCount || undefined}
                >
                  {category.name}
                </FilterButton>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Price" defaultOpen>
        <ul className="space-y-0.5">
          {PRICE_BUCKETS.map((bucket, index) => (
            <li key={bucket.label}>
              <FilterButton
                isActive={activeBucket === index}
                onClick={() =>
                  apply(
                    activeBucket === index
                      ? { min: null, max: null }
                      : { min: bucket.min ?? null, max: bucket.max ?? null },
                  )
                }
              >
                {bucket.label}
              </FilterButton>
            </li>
          ))}
        </ul>

        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply({
              min: customMin === "" ? null : Number(customMin),
              max: customMax === "" ? null : Number(customMax),
            });
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="price-min" className="block text-2xs text-ink-muted">
              Min ₹
            </label>
            <input
              id="price-min"
              type="number"
              inputMode="numeric"
              min={0}
              value={customMin}
              onChange={(event) => setCustomMin(event.target.value)}
              className="mt-1 h-11 w-full rounded-sm border border-border-interactive bg-surface px-2.5 text-sm focus:border-accent"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="price-max" className="block text-2xs text-ink-muted">
              Max ₹
            </label>
            <input
              id="price-max"
              type="number"
              inputMode="numeric"
              min={0}
              value={customMax}
              onChange={(event) => setCustomMax(event.target.value)}
              className="mt-1 h-11 w-full rounded-sm border border-border-interactive bg-surface px-2.5 text-sm focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="h-11 shrink-0 rounded-sm border border-border-interactive px-4 text-sm transition-colors duration-fast hover:border-ink"
          >
            Go
          </button>
        </form>
      </Section>

      <Section title="Availability" defaultOpen>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(filters.inStockOnly)}
            onChange={(event) =>
              apply({ stock: event.target.checked ? "1" : null })
            }
            className="h-4.5 w-4.5 shrink-0 rounded-xs border-border-interactive accent-(--color-primary)"
          />
          Ready to ship
        </label>
        <p className="mt-1 text-xs text-ink-muted">
          Hides pieces we would need to restock before dispatch.
        </p>
      </Section>

      <div className="pt-5">
        <button
          type="button"
          onClick={() => apply(CLEARABLE_PARAMS)}
          className="min-h-11 text-sm text-accent underline-offset-4 hover:underline"
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group py-5 first:pt-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-ink-subtle transition-transform duration-fast group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function FilterButton({
  isActive,
  onClick,
  count,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-3 rounded-sm px-2 text-left text-sm transition-colors duration-fast",
        isActive
          ? "bg-surface-sunken font-medium text-ink"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {count !== undefined ? (
        <span className="shrink-0 text-xs text-ink-subtle tabular">{count}</span>
      ) : null}
    </button>
  );
}
