import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/listing/Breadcrumbs";
import { ProductGallery, type GalleryView } from "@/components/product/ProductGallery";
import { BuyPanel } from "@/components/product/BuyPanel";
import { ArButton } from "@/components/product/ArButton";
import { PincodeCheck } from "@/components/product/PincodeCheck";
import { ProductDetails } from "@/components/product/ProductDetails";
import { Reviews } from "@/components/product/Reviews";
import { BUY_PANEL_ID, StickyBuyBar } from "@/components/product/StickyBuyBar";
import { ProductJsonLd } from "@/components/product/ProductJsonLd";
import { TrackView } from "@/components/product/TrackView";
import { ProductCard } from "@/components/commerce/ProductCard";
import { RecentlyViewedRail } from "@/components/commerce/RecentlyViewedRail";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import { Rating } from "@/components/commerce/Rating";
import { loadProduct, loadSimilarProducts } from "@/lib/productData";
import { demoArtKey } from "@/lib/demo";
import { demoGallery } from "@/lib/demo/detail";
import { formatDimensions } from "@/lib/utils";
import type { ArtKey } from "@/config/navigation";
import type { Product } from "@/types/product";

/**
 * Product detail page.
 *
 * The page the whole shop exists to deliver someone to, so it is ordered by
 * the questions a furniture buyer asks, in the order they ask them:
 * what does it look like → what does it cost → will it fit → what is it made
 * of → will it arrive intact → what did other people think.
 *
 * Server-rendered, with client islands only where interaction demands it
 * (gallery, buy panel, pincode, reviews, sticky bar). The specification and
 * dimensions — the parts worth ranking for — are in the HTML.
 *
 * NOTE: no `loading.tsx` in this segment. A Suspense boundary makes Next flush
 * 200 headers before `notFound()` can throw, turning every retired product URL
 * into a soft 404. See category/[slug]/README-no-loading.md.
 */

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await loadProduct(slug);
  if (!product) notFound();

  const size = product.dimensions ? formatDimensions(product.dimensions) : null;

  return {
    title: product.seo?.title ?? product.name,
    description:
      product.seo?.description ??
      [product.summary, size ? `Dimensions ${size}.` : null, product.specs?.material]
        .filter(Boolean)
        .join(" ")
        .slice(0, 155),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description: product.summary,
      ...(product.images[0] ? { images: [product.images[0].url] } : {}),
    },
  };
}

export default async function ProductPage({ params }: RouteProps) {
  const { slug } = await params;
  const { product, error } = await loadProduct(slug);

  if (error) {
    return (
      <div className="container-page py-16">
        <SurfaceMessage kind="error" />
      </div>
    );
  }
  if (!product) notFound();

  const similar = await loadSimilarProducts(product);
  const views = buildGalleryViews(product);

  return (
    <>
      <ProductJsonLd product={product} />
      <TrackView product={product} />

      <div className="buy-compact container-page py-4 lg:py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            ...(product.category
              ? [
                  {
                    label: product.category.name,
                    href: `/category/${product.category.slug}`,
                  },
                ]
              : []),
            { label: product.name },
          ]}
        />

        {/* --------------------------------------------- Gallery + buy panel */}
        <div className="buy-grid mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-12 xl:gap-16">
          <ProductGallery views={views} />

          {/* Sticky on desktop so the price and buttons stay with the customer
              as they read down a long specification. */}
          <div className="buy-column mt-8 lg:sticky lg:top-(--space-sticky-top) lg:mt-0">
            <header>
              {product.brand ? (
                <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent">
                  {product.brand.name}
                </p>
              ) : null}
              <h1 className="mt-2 text-3xl lg:text-4xl">{product.name}</h1>
              {product.summary ? (
                <p className="buy-summary mt-3 text-lg leading-relaxed text-ink-muted">
                  {product.summary}
                </p>
              ) : null}

              <div className="buy-meta mt-3 flex flex-wrap items-center gap-4">
                {product.rating ? (
                  <a
                    href="#reviews-heading"
                    className="underline-offset-4 hover:underline"
                  >
                    <Rating rating={product.rating} />
                  </a>
                ) : null}
                {product.dimensions ? (
                  <p className="text-xs text-ink-muted tabular">
                    {formatDimensions(product.dimensions)}
                  </p>
                ) : null}
              </div>
            </header>

            <div id={BUY_PANEL_ID} className="buy-panel mt-7">
              <BuyPanel product={product} />
            </div>

            {/* Above the delivery check: "can I picture it here" comes
                before "when can I have it", and only renders at all for a
                piece with a published, scale-checked model. */}
            <div className="mt-6 space-y-4">
              <ArButton product={product} />
              <PincodeCheck />
            </div>
          </div>
        </div>

        {/* --------------------------------------------------- Long-form info */}
        <div className="mt-16 border-t border-border pt-12 lg:mt-24 lg:pt-16">
          <ProductDetails product={product} />
        </div>

        <div className="mt-16 border-t border-border pt-12 lg:mt-20 lg:pt-16">
          <Reviews productId={product.id} productName={product.name} />
        </div>

        {similar.length > 0 ? (
          <section className="mt-16 border-t border-border pt-12 lg:mt-20 lg:pt-16">
            <h2 className="text-2xl">You might also consider</h2>
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
              {similar.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <ProductCard product={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Excludes the current product, so the rail never points at the page
            it is sitting on. */}
        <RecentlyViewedRail
          excludeProductId={product.id}
          heading="You looked at these"
          className="mt-16 border-t border-border pt-12 lg:mt-20 lg:pt-16"
        />
      </div>

      <StickyBuyBar product={product} />
    </>
  );
}

/**
 * Gallery views.
 *
 * Real photographs when the catalogue has them — today at most one
 * (API-GAPS §2). Demo products contribute extra line-art views so the gallery
 * can be built and reviewed with more than a single frame; that art is clearly
 * drawn rather than photographic, so no view can be mistaken for a picture of
 * the actual piece.
 */
function buildGalleryViews(product: Product): GalleryView[] {
  const fallbackArt = (demoArtKey(product) as ArtKey | undefined) ?? "sofa";

  const photos: GalleryView[] = product.images.map((image) => ({
    url: image.url,
    art: fallbackArt,
    alt: image.alt || product.name,
  }));

  const drawn: GalleryView[] = demoGallery(product).map((art, index) => ({
    art,
    alt: `${product.name} — view ${index + 1}`,
  }));

  const views = [...photos, ...drawn];
  return views.length > 0
    ? views
    : [{ art: fallbackArt, alt: product.name }];
}
