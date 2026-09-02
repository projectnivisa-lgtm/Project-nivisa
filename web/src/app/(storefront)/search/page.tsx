import type { Metadata } from "next";
import { ProductListing } from "@/components/listing/ProductListing";
import { parseListingParams, type SearchParamsInput } from "@/lib/listing";

/**
 * Search results.
 *
 * The same listing page with the query pre-applied, so filtering and sorting a
 * set of results behaves exactly as it does anywhere else in the shop.
 *
 * Noindex: search result pages are near-infinite, thin, and duplicate the
 * category pages that should rank instead. Letting them be crawled is a
 * well-known way to spend a site's crawl budget on nothing.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  return {
    title: query ? `Search: ${query}` : "Search",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const state = parseListingParams(params);
  const query = state.filters.query;

  return (
    <ProductListing
      title={query ? `Results for “${query}”` : "Search"}
      description={
        query
          ? undefined
          : "Search by piece, material or room — “teak sideboard”, “queen mattress”, “balcony chair”."
      }
      crumbs={[{ label: "Home", href: "/" }, { label: "Search" }]}
      state={state}
      searchParams={params}
      pathname="/search"
    />
  );
}
