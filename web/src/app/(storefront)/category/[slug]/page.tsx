import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/listing/ProductListing";
import {
  listingCanonical,
  parseListingParams,
  type SearchParamsInput,
} from "@/lib/listing";
import { fetchFilterCategories } from "@/lib/listingData";

/**
 * Category page.
 *
 * The slug is a real category slug. Rooms are a separate taxonomy and live at
 * `/rooms/<slug>`; folding them in here was a workaround for a backend that
 * had neither, and it meant one URL space held two different kinds of thing.
 *
 * A slug that matches no category is a genuine 404 rather than an empty grid,
 * so a mistyped or retired URL does not present itself as a category with
 * nothing in it.
 *
 * `notFound()` is called from `generateMetadata`, not only from the component.
 * With a `loading.tsx` present Next streams the shell as soon as metadata
 * resolves, so a `notFound()` thrown later in the component arrives after the
 * 200 headers are already on the wire — the page renders correctly but the
 * response is a soft 404 that search engines will happily index. Metadata runs
 * before the flush, so throwing there produces a real 404 status.
 */

interface RouteProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsInput>;
}

interface ResolvedCategory {
  id: string;
  name: string;
  description?: string;
}

// Wrapped in `cache` so metadata and the page body share one lookup per
// request instead of each issuing an identical category fetch.
const resolveCategory = cache(async function resolveCategory(
  slug: string,
): Promise<ResolvedCategory | null> {
  // The tree is searched at every depth: "sofas" is a leaf under "Seating",
  // and a category page has to work for both.
  const find = (nodes: Awaited<ReturnType<typeof fetchFilterCategories>>): ResolvedCategory | null => {
    for (const node of nodes) {
      if (node.slug === slug) return { id: node.slug, name: node.name };
      const nested = find(node.children ?? []);
      if (nested) return nested;
    }
    return null;
  };
  return find(await fetchFilterCategories());
});

export async function generateMetadata({
  params,
  searchParams,
}: RouteProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = await resolveCategory(slug);
  if (!category) notFound();

  const { page } = parseListingParams(query);

  return {
    title: page > 1 ? `${category.name} — page ${page}` : category.name,
    description:
      category.description ??
      `${category.name} furniture with real dimensions, named materials and free delivery and assembly.`,
    alternates: { canonical: listingCanonical(`/category/${slug}`, page) },
  };
}

export default async function CategoryPage({ params, searchParams }: RouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = await resolveCategory(slug);
  if (!category) notFound();

  const state = parseListingParams(query);

  return (
    <ProductListing
      title={category.name}
      description={category.description}
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: category.name },
      ]}
      state={state}
      searchParams={query}
      pathname={`/category/${slug}`}
      lockedCategoryId={category.id}
      categoryNameForChip={category.name}
    />
  );
}
