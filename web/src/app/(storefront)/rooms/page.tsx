import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/listing/Breadcrumbs";
import { ProductImage } from "@/components/commerce/ProductImage";
import { loadNavigation } from "@/lib/navigationSource";

export const metadata: Metadata = {
  title: "Shop by room",
  description:
    "Start where you are standing. Furniture for the living room, bedroom, dining room, study, kids' rooms and the balcony.",
  alternates: { canonical: "/rooms" },
};

/**
 * Rooms index.
 *
 * The header links here, so it has to exist — a menu item that 404s is worse
 * than one that is missing. It is also the first navigation choice a furniture
 * shopper wants: people arrive with a room in mind far more often than a
 * product type.
 */
export default async function RoomsPage() {
  const { rooms } = await loadNavigation();

  return (
    <div className="container-page py-8 lg:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Rooms" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="text-3xl lg:text-4xl">Shop by room</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          Start where you are standing.
        </p>
      </header>

      <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:gap-x-6">
        {rooms.map((room) => (
          <li key={room.slug}>
            <Link href={room.href} className="group block">
              <ProductImage
                src={room.imageUrl ?? null}
                alt={`${room.label} furniture`}
                art={room.art}
                aspect="aspect-4/3"
                className="transition-shadow duration-slow group-hover:shadow-card"
              />
              <h2 className="mt-3.5 font-sans text-base font-medium tracking-normal group-hover:text-accent">
                {room.label}
              </h2>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
