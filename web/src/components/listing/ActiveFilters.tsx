"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { buildListingHref, CLEARABLE_PARAMS } from "@/lib/listing";
import type { ActiveFilter } from "@/lib/listing";

/**
 * Applied-filter chips.
 *
 * The customer needs to see what is narrowing the results without opening the
 * panel that set it — otherwise an unexpectedly small grid reads as "you have
 * nothing" rather than "you filtered hard". Each chip removes exactly its own
 * filter; "Clear all" appears only once there are at least two to clear.
 */
export function ActiveFilters({ chips }: { chips: ActiveFilter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (chips.length === 0) return null;

  function go(patch: Record<string, null>) {
    const current = Object.fromEntries(searchParams.entries());
    router.push(buildListingHref(pathname, current, patch), { scroll: false });
  }

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.label}>
          <button
            type="button"
            onClick={() => go(chip.clear)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border bg-surface pl-3 pr-2 text-xs transition-colors duration-fast hover:border-ink"
          >
            {chip.label}
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-ink-subtle"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            <span className="sr-only">Remove filter</span>
          </button>
        </li>
      ))}

      {chips.length > 1 ? (
        <li>
          <button
            type="button"
            onClick={() => go(CLEARABLE_PARAMS)}
            className="min-h-9 px-1 text-xs text-accent underline-offset-4 hover:underline"
          >
            Clear all
          </button>
        </li>
      ) : null}
    </ul>
  );
}
