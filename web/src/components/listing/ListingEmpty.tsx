import Link from "next/link";

/**
 * Empty results.
 *
 * An empty grid is a dead end unless it offers a way out, and the way out
 * depends on why it is empty. Over-filtering is recoverable by widening;
 * a search miss is recoverable by rephrasing; an empty category is neither,
 * and should just point back at the catalogue.
 *
 * No apology, no illustration of a sad box. The customer wants the next step.
 */
export function ListingEmpty({
  hasFilters,
  query,
  clearHref,
}: {
  hasFilters: boolean;
  query?: string;
  clearHref: string;
}) {
  if (query) {
    return (
      <Shell
        title={`Nothing matched “${query}”`}
        body="Furniture is often listed under a broader word than the one people search for — try “storage” rather than a model name, or “2 seater” rather than “loveseat”."
      >
        <Link
          href="/shop"
          className="inline-flex min-h-12 items-center rounded-sm bg-primary px-6 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Browse everything
        </Link>
        {hasFilters ? (
          <Link
            href={clearHref}
            className="inline-flex min-h-12 items-center rounded-sm border border-border-interactive px-6 text-sm transition-colors duration-fast hover:border-ink"
          >
            Search without filters
          </Link>
        ) : null}
      </Shell>
    );
  }

  if (hasFilters) {
    return (
      <Shell
        title="No pieces match all of those filters"
        body="Widening the price range or turning off “ready to ship” usually brings results back."
      >
        <Link
          href={clearHref}
          className="inline-flex min-h-12 items-center rounded-sm bg-primary px-6 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Clear filters
        </Link>
      </Shell>
    );
  }

  return (
    <Shell
      title="Nothing here yet"
      body="This part of the catalogue is still being filled. There is plenty elsewhere."
    >
      <Link
        href="/shop"
        className="inline-flex min-h-12 items-center rounded-sm bg-primary px-6 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
      >
        Browse everything
      </Link>
    </Shell>
  );
}

function Shell({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-border bg-surface px-6 py-16 text-center">
      <h2 className="font-sans text-lg font-medium tracking-normal">{title}</h2>
      <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-ink-muted">
        {body}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}
