import Link from "next/link";
import type { RoomLink } from "@/config/navigation";
import { ProductImage } from "@/components/commerce/ProductImage";

/**
 * Shop by room.
 *
 * The first navigation choice on a furniture homepage, above category, because
 * shoppers arrive with a room in mind ("we need something for the balcony")
 * far more often than a product type ("I need a bench").
 *
 * The rooms come from the catalogue, so adding one in the dashboard puts it on
 * the homepage without a release.
 */
export function ShopByRoom({ rooms }: { rooms: RoomLink[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:gap-x-6">
      {rooms.map((room) => (
        <li key={room.slug}>
          <Link href={room.href} className="group block">
            <ProductImage
              src={room.imageUrl ?? null}
              alt={`${room.label} furniture`}
              art={room.art}
              aspect="aspect-4/3"
              // Two up on a phone, three from md. Without this the card
              // default (25vw) applies and a third-width tile is fetched at
              // quarter width, which is a soft image rather than a small one.
              sizes="(max-width: 768px) 50vw, 33vw"
              className="transition-shadow duration-slow group-hover:shadow-card"
            />
            <h3 className="mt-3.5 font-sans text-base font-medium tracking-normal group-hover:text-accent">
              {room.label}
            </h3>
          </Link>
        </li>
      ))}
    </ul>
  );
}
