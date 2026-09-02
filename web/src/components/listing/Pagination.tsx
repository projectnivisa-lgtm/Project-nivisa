import Link from "next/link";
import { cn } from "@/lib/utils";
import { buildListingHref, type SearchParamsInput } from "@/lib/listing";

/**
 * Pagination.
 *
 * Real `<a>` links, not a "Load more" button. Three reasons: search engines
 * can follow them, the back button returns you to the page you were on rather
 * than the top of an unbuilt list, and a customer who wants page 4 can get
 * there without loading pages 2 and 3 first. On a catalogue this is worth more
 * than the smoothness of infinite scroll.
 *
 * The window is deliberately small — first, last, current ±1 — because a
 * furniture catalogue is browsed by filtering, not by paging to page 27.
 */
export function Pagination({
  pathname,
  searchParams,
  page,
  total,
  pageSize,
}: {
  pathname: string;
  searchParams: SearchParamsInput;
  page: number;
  total: number;
  pageSize: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const href = (target: number) =>
    buildListingHref(pathname, searchParams, { page: target });

  const numbers: Array<number | "gap"> = [];
  for (let i = 1; i <= pageCount; i += 1) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) {
      numbers.push(i);
    } else if (numbers[numbers.length - 1] !== "gap") {
      numbers.push("gap");
    }
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-14 flex items-center justify-center gap-1.5"
    >
      <PageLink
        href={href(page - 1)}
        isDisabled={page <= 1}
        label="Previous page"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </PageLink>

      {numbers.map((entry, index) =>
        entry === "gap" ? (
          <span
            key={`gap-${index}`}
            aria-hidden="true"
            className="px-1 text-sm text-ink-subtle"
          >
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={href(entry)}
            aria-current={entry === page ? "page" : undefined}
            aria-label={`Page ${entry}`}
            className={cn(
              "flex h-11 min-w-11 items-center justify-center rounded-sm px-3 text-sm tabular transition-colors duration-fast",
              entry === page
                ? "bg-primary text-on-primary"
                : "border border-border hover:border-ink",
            )}
          >
            {entry}
          </Link>
        ),
      )}

      <PageLink
        href={href(page + 1)}
        isDisabled={page >= pageCount}
        label="Next page"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  isDisabled,
  label,
  children,
}: {
  href: string;
  isDisabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  // A disabled arrow is rendered as a span, not a link with a click handler
  // that does nothing — there is nowhere to go, so there should be nothing to
  // focus or activate.
  if (isDisabled) {
    return (
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-sm border border-border text-lime-400"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-sm border border-border transition-colors duration-fast hover:border-ink"
    >
      {children}
    </Link>
  );
}
