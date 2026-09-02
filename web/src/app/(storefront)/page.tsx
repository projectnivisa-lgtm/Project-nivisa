import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { HomeSection } from "@/components/home/Section";
import { loadNavigation } from "@/lib/navigationSource";
import { loadHomepage } from "@/lib/homeSource";
import { ShopByRoom } from "@/components/home/ShopByRoom";
import { CategoryRail } from "@/components/home/CategoryRail";
import { TrustBand } from "@/components/home/TrustBand";
import { PromoBand } from "@/components/home/PromoBand";
import { BannerBand } from "@/components/home/BannerBand";
import { ProductRail } from "@/components/commerce/ProductRail";
import { RecentlyViewedRail } from "@/components/commerce/RecentlyViewedRail";

export const metadata: Metadata = {
  title: "Furniture for the way you live",
  description:
    "Considered furniture for Indian homes. Real dimensions on every listing, delivered and assembled by our own team, with a ten-year structural warranty.",
  alternates: { canonical: "/" },
};

/**
 * Homepage.
 *
 * Every band — including the hero, the trust pillars and the editorial strip —
 * comes from the API in the order the dashboard's Homepage screen sets. This
 * file decides how each *kind* of band looks; it no longer decides which
 * bands exist, what they say, or what order they run in.
 *
 * "Recently viewed" is the one exception, and deliberately so: it is personal
 * to the visitor rather than merchandised, renders nothing when there is no
 * history, and belongs where someone deciding has already scrolled.
 */
export default async function HomePage() {
  const [nav, bands] = await Promise.all([loadNavigation(), loadHomepage()]);

  // Placed after the first rail rather than at a fixed index: it should follow
  // some product, and which band is first is now a merchandiser's decision.
  const firstRailIndex = bands.findIndex((band) => band.kind === "collection_rail");

  return (
    <>
      {bands.map((band, index) => (
        <div key={`${band.kind}-${index}`}>
          {band.kind === "hero" && (
            <Hero
              eyebrow={band.eyebrow}
              title={band.title}
              lede={band.subtitle}
              primaryCta={band.primaryCta}
              secondaryCta={band.secondaryCta}
              stats={band.stats}
            />
          )}

          {band.kind === "room_grid" && (
            <HomeSection eyebrow="Start here" title={band.title ?? "Shop by room"} description={band.subtitle}>
              <ShopByRoom rooms={nav.rooms} />
            </HomeSection>
          )}

          {band.kind === "category_grid" && (
            <HomeSection
              title={band.title ?? "Browse by category"}
              description={band.subtitle}
              action={{ label: "All categories", href: "/shop" }}
              bleed
            >
              <CategoryRail />
            </HomeSection>
          )}

          {band.kind === "collection_rail" && (
            <HomeSection
              title={band.title}
              description={band.subtitle}
              action={{ label: "See all", href: band.href }}
              bleed
            >
              <ProductRail products={band.products} />
            </HomeSection>
          )}

          {band.kind === "banner" && <BannerBand banners={band.banners} />}

          {band.kind === "trust" && <TrustBand title={band.title} pillars={band.pillars} />}

          {band.kind === "editorial" && (
            <PromoBand
              eyebrow={band.eyebrow}
              title={band.title}
              body={band.subtitle}
              cta={band.cta}
            />
          )}

          {index === firstRailIndex && (
            <RecentlyViewedRail className="py-(--space-section-sm) lg:py-(--space-section)" />
          )}
        </div>
      ))}

      {/* A homepage with no bands at all means the API could not be reached.
          The header, footer and navigation still work, so the page is a way
          into the shop rather than an error. */}
      {bands.length === 0 && (
        <HomeSection title="Shop by room" description="Start where you are standing.">
          <ShopByRoom rooms={nav.rooms} />
        </HomeSection>
      )}
    </>
  );
}
