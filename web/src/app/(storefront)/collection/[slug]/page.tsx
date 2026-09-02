import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/listing/Breadcrumbs";
import { ProductGrid } from "@/components/listing/ProductGrid";
import { ListingEmpty } from "@/components/listing/ListingEmpty";
import { Pagination } from "@/components/listing/Pagination";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import { fetchCollection } from "@/lib/listingData";
import {
  listingCanonical,
  PAGE_SIZE,
  parseListingParams,
  type SearchParamsInput,
} from "@/lib/listing";

/**
 * Collection page.
 *
 * Deliberately NOT the shared listing shell. The collection endpoint accepts
 * only `q`, `limit` and `offset` — no price, availability or sort (API-GAPS
 * §3) — so a filter sidebar here would be four controls that quietly do
 * nothing. A collection is also a curated, ordered set: re-sorting it by price
 * would discard the merchandising that makes it a collection rather than a
 * search.
 *
 * What it keeps: breadcrumbs, the grid, pagination, and the empty and error
 * states, so it behaves like the rest of the shop where it can.
 *
 * A missing collection calls `notFound()` from `generateMetadata` — see the
 * category page for why doing it only in the component yields a soft 404.
 */

/** One fetch per request, shared by metadata and the page body. */
const loadCollection = cache(
  (slug: string, query: string | undefined, limit: number, offset: number) =>
    fetchCollection(slug, query, limit, offset),
);

interface RouteProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsInput>;
}

export async function generateMetadata({
  params,
  searchParams,
}: RouteProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const { page: pageNum } = parseListingParams(query);
  const collection = await loadCollection(
    slug,
    undefined,
    PAGE_SIZE,
    (pageNum - 1) * PAGE_SIZE,
  );
  if (collection.notFound) notFound();

  const page = pageNum;
  const name = collection.name ?? "Collection";

  return {
    title: page > 1 ? `${name} — page ${page}` : name,
    description: `A curated selection from Nivisa — ${collection.name ?? "our collection"}, with real dimensions and free delivery and assembly.`,
    alternates: { canonical: listingCanonical(`/collection/${slug}`, page) },
  };
}

export default async function CollectionPage({ params, searchParams }: RouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const state = parseListingParams(query);

  const { page, name, error, notFound: missing } = await loadCollection(
    slug,
    state.filters.query,
    PAGE_SIZE,
    state.offset,
  );

  if (missing) notFound();

  const products = page?.items ?? [];

  return (
    <div className="container-page py-6 lg:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: name ?? "Collection" },
        ]}
      />

      <header className="mt-5 max-w-3xl">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">
          Collection
        </p>
        <h1 className="mt-2.5 text-3xl lg:text-4xl">{name ?? "Collection"}</h1>
        <p className="mt-3 text-sm text-ink-muted">
          <span className="tabular">{products.length}</span>{" "}
          {products.length === 1 ? "piece" : "pieces"}, chosen and ordered by our
          buying team.
        </p>
      </header>

      <div className="mt-10">
        {error ? (
          <SurfaceMessage kind="error" />
        ) : products.length === 0 ? (
          <ListingEmpty hasFilters={false} clearHref={`/collection/${slug}`} />
        ) : (
          <>
            <ProductGrid products={products} />
            <Pagination
              pathname={`/collection/${slug}`}
              searchParams={query}
              page={state.page}
              total={page?.total ?? 0}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </div>
    </div>
  );
}
