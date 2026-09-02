import type { Metadata } from "next";
import { ProductListing } from "@/components/listing/ProductListing";
import {
  listingCanonical,
  parseListingParams,
  type SearchParamsInput,
} from "@/lib/listing";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const { page } = parseListingParams(await searchParams);
  return {
    title: page > 1 ? `All furniture — page ${page}` : "All furniture",
    description:
      "Every piece we make, with real dimensions, named materials and a ten-year structural warranty. Filter by room, price and availability.",
    alternates: { canonical: listingCanonical("/shop", page) },
  };
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const state = parseListingParams(params);

  return (
    <ProductListing
      title="All furniture"
      description="Everything in the catalogue, from sofas to shoe racks. Every listing carries its real dimensions, so you can measure before you commit."
      crumbs={[
        { label: "Home", href: "/" },
        { label: "All furniture" },
      ]}
      state={state}
      searchParams={params}
      pathname="/shop"
    />
  );
}
