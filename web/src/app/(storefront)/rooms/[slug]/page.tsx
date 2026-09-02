import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { catalogApi } from "@/api/catalog";
import { ProductListing } from "@/components/listing/ProductListing";
import {
  listingCanonical,
  parseListingParams,
  type SearchParamsInput,
} from "@/lib/listing";

/**
 * Room page.
 *
 * Rooms are their own taxonomy, not categories: a product belongs to exactly
 * one category and to as many rooms as it suits. They used to share the
 * `/category` URL space because the backend had neither, which meant one route
 * resolved two different kinds of thing and a slug collision between them
 * would have silently shown the wrong grid.
 *
 * `notFound()` is called from `generateMetadata`, not only from the component:
 * metadata runs before the response is flushed, so throwing there produces a
 * real 404 status rather than a soft 404 a crawler will index.
 */

interface RouteProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsInput>;
}

const resolveRoom = cache(async function resolveRoom(slug: string) {
  try {
    const rooms = await catalogApi.getRooms();
    return rooms.find((room) => room.slug === slug) ?? null;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
  searchParams,
}: RouteProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const room = await resolveRoom(slug);
  if (!room) notFound();

  const { page } = parseListingParams(query);
  return {
    title: `${room.name} furniture`,
    description: `Furniture for the ${room.name.toLowerCase()}, with real dimensions, named materials, and delivery and assembly included.`,
    alternates: { canonical: listingCanonical(`/rooms/${slug}`, page) },
  };
}

export default async function RoomPage({ params, searchParams }: RouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const room = await resolveRoom(slug);
  if (!room) notFound();

  return (
    <ProductListing
      title={room.name}
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Rooms", href: "/rooms" },
        { label: room.name },
      ]}
      state={parseListingParams(query)}
      searchParams={query}
      pathname={`/rooms/${slug}`}
      lockedRoomSlug={slug}
      categoryNameForChip={room.name}
    />
  );
}
