"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { buildListingHref, SORT_OPTIONS } from "@/lib/listing";
import type { ProductSort } from "@/types/product";

/**
 * Sort control.
 *
 * A native `<select>`, not a custom dropdown. On mobile it becomes the OS
 * picker — a better control than anything built in a div, already accessible,
 * already keyboard-operable, and it costs no JavaScript to make correct.
 *
 * Only the three sorts the backend can honour are offered. Rating and
 * discount sorts are in the domain type but absent from the API (API-GAPS §4);
 * listing them would silently return newest-first and look broken.
 */
export function SortSelect({ value }: { value: ProductSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="shrink-0 text-xs text-ink-muted">
        Sort
      </label>
      <select
        id="sort"
        value={value}
        onChange={(event) => {
          const current = Object.fromEntries(searchParams.entries());
          router.push(
            buildListingHref(pathname, current, { sort: event.target.value }),
            { scroll: false },
          );
        }}
        className="min-h-11 rounded-sm border border-border-interactive bg-surface px-3 pr-8 text-sm transition-colors duration-fast hover:border-ink focus:border-accent"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
