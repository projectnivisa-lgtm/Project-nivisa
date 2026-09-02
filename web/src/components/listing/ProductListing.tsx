import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { FilterControls } from "./FilterControls";
import { FilterBar } from "./FilterBar";
import { SortSelect } from "./SortSelect";
import { ActiveFilters } from "./ActiveFilters";
import { ProductGrid } from "./ProductGrid";
import { ListingEmpty } from "./ListingEmpty";
import { Pagination } from "./Pagination";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import {
  buildListingHref,
  CLEARABLE_PARAMS,
  describeActiveFilters,
  PAGE_SIZE,
  type ListingState,
  type SearchParamsInput,
} from "@/lib/listing";
import { fetchFilterCategories, fetchListing } from "@/lib/listingData";

/**
 * The listing page.
 *
 * One server component behind /shop, /category/[slug], /collection/[slug] and
 * /search — they differ only in heading, breadcrumbs and which filter is
 * pre-applied, and forking them would guarantee four subtly different filter
 * behaviours within a month.
 *
 * Layout is a persistent sidebar on desktop and a sticky bar plus drawer on
 * mobile. The sidebar stays open rather than hiding behind a button: on a wide
 * screen there is room, and a visible filter list is also the category
 * navigation for someone who arrived on the wrong page.
 */
export async function ProductListing({
  title,
  description,
  crumbs,
  state,
  searchParams,
  pathname,
  /** Category page: locks the category filter and hides that section. */
  lockedCategoryId,
  /** Room page: locks the room filter the same way. */
  lockedRoomSlug,
  categoryNameForChip,
}: {
  title: string;
  description?: string;
  crumbs: Crumb[];
  state: ListingState;
  searchParams: SearchParamsInput;
  pathname: string;
  lockedCategoryId?: string;
  lockedRoomSlug?: string;
  categoryNameForChip?: string;
}) {
  // A locked facet is the page, not a filter the customer chose, so it is
  // applied to the query but never rendered as a removable chip.
  const effectiveFilters = {
    ...state.filters,
    ...(lockedCategoryId ? { categoryId: lockedCategoryId } : {}),
    ...(lockedRoomSlug ? { room: [lockedRoomSlug] } : {}),
  };

  // Both requests are independent; running them in series would add a full
  // round trip to time-to-first-byte for no reason.
  const [{ page, error }, allCategories] = await Promise.all([
    fetchListing(effectiveFilters, PAGE_SIZE, state.offset),
    fetchFilterCategories(),
  ]);

  // On a category page the category is the page, not a filter to change.
  const categories = lockedCategoryId ? [] : allCategories;

  const chips = describeActiveFilters(
    { ...state, filters: state.filters },
    allCategories.find((c) => c.id === state.filters.categoryId)?.name ??
      categoryNameForChip,
  );

  // The search term is a chip (you want to see and remove it) but it is not a
  // "filter" for the empty state's purposes: offering "search without filters"
  // when nothing but the query is applied would clear the query itself and
  // land the customer on a blank search page.
  const hasNarrowingFilters = chips.some((chip) => !("q" in chip.clear));

  const clearHref = buildListingHref(pathname, searchParams, CLEARABLE_PARAMS);
  const total = page?.total ?? 0;
  const products = page?.items ?? [];

  return (
    <div className="container-page py-6 lg:py-10">
      <Breadcrumbs items={crumbs} />

      <header className="mt-5 max-w-3xl">
        <h1 className="text-3xl lg:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-prose leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}
      </header>

      <div className="mt-8 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10 xl:gap-14">
        <aside className="hidden lg:block">
          {/* Sticky so the filters stay reachable through a long grid without
              scrolling back to the top of the page. */}
          <div className="sticky top-28">
            <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Filter
            </h2>
            <div className="mt-4">
              <FilterControls filters={state.filters} categories={categories} />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <FilterBar
            filters={state.filters}
            categories={categories}
            activeCount={chips.length}
            total={total}
          />

          <div className="mt-4 hidden items-center justify-between gap-6 lg:flex">
            <p className="text-sm text-ink-muted">
              <span className="tabular">{total}</span>{" "}
              {total === 1 ? "piece" : "pieces"}
            </p>
            <SortSelect value={state.filters.sort ?? "newest"} />
          </div>

          {chips.length > 0 ? (
            <div className="mt-4">
              <ActiveFilters chips={chips} />
            </div>
          ) : null}

          <p className="mt-4 text-sm text-ink-muted lg:hidden">
            <span className="tabular">{total}</span>{" "}
            {total === 1 ? "piece" : "pieces"}
          </p>

          <div className="mt-6">
            {error ? (
              <SurfaceMessage kind="error" />
            ) : products.length === 0 ? (
              <ListingEmpty
                hasFilters={hasNarrowingFilters}
                query={state.filters.query}
                clearHref={clearHref}
              />
            ) : (
              <>
                <ProductGrid products={products} />
                <Pagination
                  pathname={pathname}
                  searchParams={searchParams}
                  page={state.page}
                  total={total}
                  pageSize={PAGE_SIZE}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
