import type { ProductFilters, ProductSort } from "@/types/product";

/**
 * Listing state lives in the URL, not in React state.
 *
 * A filtered grid is something people share, bookmark, and reach for the back
 * button from. Holding that in component state breaks all three, and makes the
 * page uncrawlable besides. Every control below writes a URL; the page reads
 * it on the server and renders the result.
 *
 * Params are kept short because they end up in shared links:
 *   q     search terms
 *   c     category id  (the backend has no category slugs — API-GAPS §3)
 *   min   minimum price, rupees
 *   max   maximum price, rupees
 *   stock "1" for in-stock only
 *   sort  newest | price_asc | price_desc
 *   page  1-based
 */

export const PAGE_SIZE = 24;

/** The sorts the backend can actually honour. See API-GAPS §4. */
export const SORT_OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

/**
 * Price buckets, chosen to match how Indian furniture is actually shopped —
 * a bracket per budget conversation, not evenly spaced numbers.
 */
export const PRICE_BUCKETS = [
  { label: "Under ₹10,000", min: undefined, max: 10000 },
  { label: "₹10,000 – ₹25,000", min: 10000, max: 25000 },
  { label: "₹25,000 – ₹50,000", min: 25000, max: 50000 },
  { label: "₹50,000 – ₹1,00,000", min: 50000, max: 100000 },
  { label: "Above ₹1,00,000", min: 100000, max: undefined },
] as const;

/** Next 15+ hands route params in as a promise. */
export type SearchParamsInput = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

export interface ListingState {
  filters: ProductFilters;
  page: number;
  offset: number;
}

export function parseListingParams(params: SearchParamsInput): ListingState {
  const sortParam = one(params.sort);
  const sort = SORT_OPTIONS.some((o) => o.value === sortParam)
    ? (sortParam as ProductSort)
    : "newest";

  const min = positiveInt(one(params.min));
  const max = positiveInt(one(params.max));

  // A reversed range returns nothing and looks like a broken catalogue rather
  // than a mistyped filter, so swap instead of honouring it literally.
  const [minPrice, maxPrice] =
    min !== undefined && max !== undefined && min > max ? [max, min] : [min, max];

  const page = Math.max(1, positiveInt(one(params.page)) ?? 1);

  return {
    filters: {
      query: one(params.q)?.trim() || undefined,
      categoryId: one(params.c) || undefined,
      minPrice,
      maxPrice,
      inStockOnly: one(params.stock) === "1",
      sort,
    },
    page,
    offset: (page - 1) * PAGE_SIZE,
  };
}

/**
 * Build a href from the current params plus a patch.
 *
 * `null` removes a key. Changing anything except the page resets to page 1 —
 * landing on page 4 of a freshly narrowed result set is the classic way to
 * show someone an empty grid and make them think the filter broke.
 */
export function buildListingHref(
  pathname: string,
  current: SearchParamsInput,
  patch: Record<string, string | number | null | undefined>,
): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(current)) {
    const single = one(value);
    if (single) next.set(key, single);
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }

  if (!("page" in patch)) next.delete("page");
  if (next.get("page") === "1") next.delete("page");

  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Human-readable chips for whatever is currently narrowing the results. */
export interface ActiveFilter {
  /** Params to clear when this chip is dismissed. */
  clear: Record<string, null>;
  label: string;
}

export function describeActiveFilters(
  state: ListingState,
  categoryName?: string,
): ActiveFilter[] {
  const chips: ActiveFilter[] = [];
  const { filters } = state;

  if (filters.query) {
    chips.push({ label: `“${filters.query}”`, clear: { q: null } });
  }
  if (filters.categoryId && categoryName) {
    chips.push({ label: categoryName, clear: { c: null } });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const min = filters.minPrice;
    const max = filters.maxPrice;
    const label =
      min !== undefined && max !== undefined
        ? `₹${min.toLocaleString("en-IN")} – ₹${max.toLocaleString("en-IN")}`
        : min !== undefined
          ? `Above ₹${min.toLocaleString("en-IN")}`
          : `Under ₹${max!.toLocaleString("en-IN")}`;
    chips.push({ label, clear: { min: null, max: null } });
  }
  if (filters.inStockOnly) {
    chips.push({ label: "In stock", clear: { stock: null } });
  }

  return chips;
}

/**
 * Canonical path for a listing page.
 *
 * Includes the page number but drops every filter. Filter permutations are
 * near-infinite and would each become a competing near-duplicate of the
 * category page; page 2, by contrast, holds products that appear nowhere else,
 * so pointing its canonical at page 1 would quietly remove them from the index.
 */
export function listingCanonical(pathname: string, page: number): string {
  return page > 1 ? `${pathname}?page=${page}` : pathname;
}

/** Everything a "Clear all" control needs to remove. */
export const CLEARABLE_PARAMS: Record<string, null> = {
  q: null,
  c: null,
  min: null,
  max: null,
  stock: null,
  page: null,
};
