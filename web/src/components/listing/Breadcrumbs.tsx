import Link from "next/link";
import { absoluteUrl } from "@/config/env";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Breadcrumbs.
 *
 * Emits BreadcrumbList structured data alongside the visible trail, because
 * this is what produces the hierarchy shown under a search result — one of the
 * few pieces of structured data that visibly changes how a category page
 * appears in search.
 *
 * The last crumb is plain text with `aria-current`: linking the page you are
 * already on is a dead control.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      // schema.org requires an absolute URL here; a relative path is
      // accepted by some parsers and silently dropped by others.
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.label} className="flex items-center gap-2">
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="underline-offset-4 transition-colors duration-fast hover:text-ink hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? "page" : undefined} className="text-ink">
                    {item.label}
                  </span>
                )}
                {!isLast ? (
                  <span aria-hidden="true" className="text-lime-500">
                    /
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
