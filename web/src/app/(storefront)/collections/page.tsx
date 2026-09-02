import type { Metadata } from "next";
import Link from "next/link";
import { catalogApi } from "@/api/catalog";
import { Breadcrumbs } from "@/components/listing/Breadcrumbs";
import { ProductImage } from "@/components/commerce/ProductImage";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Curated groups of furniture — new arrivals, best sellers, and pieces chosen to work together.",
  alternates: { canonical: "/collections" },
};

/**
 * Collections index.
 *
 * Only collections with something in them are listed. An empty rail here is a
 * link to a page that says "no products", which reads as a broken shop rather
 * than as an unfinished campaign.
 */
export default async function CollectionsPage() {
  let collections: Awaited<ReturnType<typeof catalogApi.getCollections>> = [];
  try {
    collections = (await catalogApi.getCollections()).filter((c) => c.productCount > 0);
  } catch {
    // An unreachable catalogue renders the empty state below rather than an
    // error page: the rest of the site still works, and so does the header.
  }

  return (
    <div className="container-page py-8 lg:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Collections" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="text-3xl lg:text-4xl">Collections</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          Pieces we have grouped because they belong together.
        </p>
      </header>

      {collections.length === 0 ? (
        <p className="mt-12 text-ink-muted">
          There are no collections just now.{" "}
          <Link href="/shop" className="text-accent underline-offset-4 hover:underline">
            Browse all furniture
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:gap-x-6">
          {collections.map((collection) => (
            <li key={collection.slug}>
              <Link href={`/collection/${collection.slug}`} className="group block">
                <ProductImage
                  src={collection.imageUrl}
                  alt={collection.name}
                  art="decor"
                  aspect="aspect-4/3"
                  className="transition-shadow duration-slow group-hover:shadow-card"
                />
                <h2 className="mt-3.5 font-sans text-base font-medium tracking-normal group-hover:text-accent">
                  {collection.name}
                </h2>
                <p className="mt-1 text-xs leading-normal text-ink-muted">
                  {collection.productCount} piece
                  {collection.productCount === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
