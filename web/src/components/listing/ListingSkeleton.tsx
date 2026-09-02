import { ProductGridSkeleton } from "./ProductGrid";

/**
 * Listing loading state.
 *
 * Listing routes are server-rendered on demand, so a filter change is a real
 * navigation with a real round trip. Without this, clicking a filter appears
 * to do nothing until the response lands — the single most common reason
 * people click a filter twice.
 *
 * The geometry matches the loaded page exactly: same header block, same
 * sidebar width, same grid. Anything else produces a visible jump at the
 * moment the content arrives.
 */
export function ListingSkeleton({ withSidebar = true }: { withSidebar?: boolean }) {
  return (
    <div className="container-page py-6 lg:py-10" aria-busy="true">
      <span className="sr-only" role="status">
        Loading products
      </span>

      <div className="skeleton h-3 w-48 rounded-xs" aria-hidden="true" />

      <div className="mt-6" aria-hidden="true">
        <div className="skeleton h-9 w-72 rounded-xs lg:h-11" />
        <div className="skeleton mt-4 h-4 w-full max-w-lg rounded-xs" />
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10 xl:gap-14">
        {withSidebar ? (
          <div className="hidden lg:block" aria-hidden="true">
            {[0, 1, 2].map((section) => (
              <div key={section} className="mb-8">
                <div className="skeleton h-4 w-24 rounded-xs" />
                <div className="mt-4 space-y-2.5">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="skeleton h-4 w-full rounded-xs" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="min-w-0">
          <div
            className="skeleton mb-6 h-11 w-full rounded-sm lg:h-6 lg:w-40"
            aria-hidden="true"
          />
          <ProductGridSkeleton />
        </div>
      </div>
    </div>
  );
}
