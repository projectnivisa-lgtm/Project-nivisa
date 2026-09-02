import { api } from "@/api/client";
import { toProductCard, type ApiProductCard } from "@/api/adapters/productAdapter";
import { IS_DEMO_CONTENT, getDemoRails } from "@/lib/demo";
import type { Product } from "@/types/product";

/**
 * The homepage, as the dashboard defines it.
 *
 * Bands are ordered, titled and configured on the Homepage screen, and each
 * arrives from the API already resolved — a rail with its products in it, a
 * room grid with its rooms. The alternative is one request per band, which on
 * a seven-band homepage is seven round trips before anything renders.
 *
 * The hero, the trust pillars and the editorial band used to be hardcoded
 * JSX. They carry their copy in `config` now, because a shop that cannot
 * change its own headline without a release does not really own it.
 *
 * Returns an empty list rather than throwing. A homepage whose bands could not
 * load should still render its header, its footer and its navigation;
 * replacing the whole page with an error because one rail failed is a worse
 * outcome than a shorter page.
 */

export interface Cta {
  label: string;
  href: string;
}

export interface HeroBand {
  kind: "hero";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  stats: Array<{ value: string; label: string }>;
}

export interface TrustBand {
  kind: "trust";
  title?: string;
  pillars: Array<{ icon: string; title: string; body: string }>;
}

export interface EditorialBand {
  kind: "editorial";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  cta?: Cta;
}

export interface RailBand {
  kind: "collection_rail";
  title: string;
  subtitle?: string;
  href: string;
  products: Product[];
}

export interface RoomGridBand {
  kind: "room_grid";
  title?: string;
  subtitle?: string;
}

export interface CategoryGridBand {
  kind: "category_grid";
  title?: string;
  subtitle?: string;
}

export interface BannerBand {
  kind: "banner";
  banners: Array<{
    title: string;
    subtitle: string | null;
    image_url: string;
    mobile_image_url: string | null;
    alt_text: string;
    link_url: string | null;
    cta_label: string | null;
  }>;
}

export type HomeBand =
  | HeroBand | TrustBand | EditorialBand
  | RailBand | RoomGridBand | CategoryGridBand | BannerBand;

interface ApiBand {
  kind: string;
  title: string | null;
  subtitle: string | null;
  config: Record<string, unknown>;
  products?: ApiProductCard[];
  banners?: BannerBand["banners"];
}

function cta(value: unknown): Cta | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { label, href } = value as { label?: string; href?: string };
  // Both halves or neither: a labelled button with no destination is a dead
  // control, and a destination with no label renders as an empty box.
  return label && href ? { label, href } : undefined;
}

export async function loadHomepage(): Promise<HomeBand[]> {
  if (IS_DEMO_CONTENT) {
    const demo = getDemoRails();
    return [
      {
        kind: "collection_rail",
        title: "Best sellers this month",
        href: "/shop",
        products: demo.bestSellers,
      },
    ].filter((band) => band.products.length > 0) as HomeBand[];
  }

  let raw: { sections: ApiBand[] } | null = null;
  try {
    raw = await api.get<{ sections: ApiBand[] }>("/homepage", {
      auth: false,
      next: { revalidate: 120 },
    });
  } catch {
    return [];
  }

  const bands: HomeBand[] = [];

  for (const band of raw?.sections ?? []) {
    const config = band.config ?? {};

    switch (band.kind) {
      case "hero":
        if (!band.title) break;
        bands.push({
          kind: "hero",
          eyebrow: (config.eyebrow as string) || undefined,
          title: band.title,
          subtitle: band.subtitle ?? undefined,
          primaryCta: cta(config.primary_cta),
          secondaryCta: cta(config.secondary_cta),
          stats: Array.isArray(config.stats)
            ? (config.stats as Array<{ value: string; label: string }>).filter(
                (s) => s?.value && s?.label,
              )
            : [],
        });
        break;

      case "trust": {
        const pillars = Array.isArray(config.pillars)
          ? (config.pillars as TrustBand["pillars"]).filter((p) => p?.title)
          : [];
        // A trust band with no pillars is a heading over nothing.
        if (pillars.length) {
          bands.push({ kind: "trust", title: band.title ?? undefined, pillars });
        }
        break;
      }

      case "editorial":
        if (!band.title) break;
        bands.push({
          kind: "editorial",
          eyebrow: (config.eyebrow as string) || undefined,
          title: band.title,
          subtitle: band.subtitle ?? undefined,
          cta: cta(config.cta),
        });
        break;

      case "collection_rail": {
        // An empty rail is dropped rather than rendered under its heading —
        // a titled band with no products reads as a broken shop.
        if (!band.products?.length) break;
        const slug = String(config.collection_slug ?? "");
        bands.push({
          kind: "collection_rail",
          title: band.title ?? "Featured",
          subtitle: band.subtitle ?? undefined,
          href: slug ? `/collection/${slug}` : "/shop",
          products: band.products.map(toProductCard),
        });
        break;
      }

      case "room_grid":
        bands.push({
          kind: "room_grid",
          title: band.title ?? undefined,
          subtitle: band.subtitle ?? undefined,
        });
        break;

      case "category_grid":
        bands.push({
          kind: "category_grid",
          title: band.title ?? undefined,
          subtitle: band.subtitle ?? undefined,
        });
        break;

      case "banner":
        if (band.banners?.length) bands.push({ kind: "banner", banners: band.banners });
        break;
    }
  }

  return bands;
}
