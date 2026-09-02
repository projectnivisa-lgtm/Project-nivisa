import { absoluteUrl } from "@/config/env";
import type { Product } from "@/types/product";

/**
 * Product structured data.
 *
 * This is what produces price, availability and star ratings in a search
 * result, which is the difference between a listing that gets clicked and one
 * that does not.
 *
 * Only fields with real values are emitted. `aggregateRating` in particular is
 * omitted unless there are genuine reviews — Google penalises rating markup
 * that is not backed by visible reviews on the page, and inventing one to fill
 * the schema is exactly the sort of thing that gets rich results revoked.
 */
export function ProductJsonLd({ product }: { product: Product }) {
  const availability =
    product.stockState === "out-of-stock"
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.images.length > 0
      ? { image: product.images.map((image) => image.url) }
      : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    ...(product.specs?.material ? { material: product.specs.material } : {}),
    ...(product.specs?.colour ? { color: product.specs.colour } : {}),
    sku: product.id,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/product/${product.slug}`),
      priceCurrency: "INR",
      price: product.price.selling.amount,
      availability,
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  if (product.rating && product.rating.count > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating.average,
      reviewCount: product.rating.count,
    };
  }

  const { widthCm, depthCm, heightCm, weightKg } = product.dimensions ?? {};
  if (widthCm) jsonLd.width = quantity(widthCm, "CMT");
  if (depthCm) jsonLd.depth = quantity(depthCm, "CMT");
  if (heightCm) jsonLd.height = quantity(heightCm, "CMT");
  if (weightKg) jsonLd.weight = quantity(weightKg, "KGM");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/** UN/CEFACT unit codes, which is what schema.org expects for `unitCode`. */
function quantity(value: number, unitCode: "CMT" | "KGM") {
  return { "@type": "QuantitativeValue", value, unitCode };
}
