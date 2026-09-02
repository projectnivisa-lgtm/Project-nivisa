import { DEMO_RAILS, DEMO_PRODUCTS } from "./catalogue";
import type { Product } from "@/types/product";

/**
 * The demo-content switch.
 *
 * Demo mode existed so the storefront could be designed against believable
 * furniture while the backend still served books. The backend is furniture-
 * native now, so this is no longer needed for that — it survives only as a way
 * to work on the design with no API running.
 *
 * Opt-in via NEXT_PUBLIC_DEMO_CONTENT, and when on the layout renders a
 * visible banner: there is no configuration in which demo content can be
 * mistaken for live data by someone looking at the screen.
 *
 * Production builds leave the flag unset, and every surface falls back to the
 * real API through the normal hooks.
 */
export const IS_DEMO_CONTENT = process.env.NEXT_PUBLIC_DEMO_CONTENT === "true";

/** The silhouette key a demo product carries. Absent on real products. */
export function demoArtKey(product: Product): string | undefined {
  return (product as unknown as { demoArt?: string }).demoArt;
}

export interface HomeRails {
  bestSellers: Product[];
  newArrivals: Product[];
  trending: Product[];
}

/**
 * Homepage rails.
 *
 * Returns demo content only when the flag is on. Otherwise returns empty
 * arrays, and the homepage sections render their own empty state rather than
 * silently substituting fake products.
 */
export function getDemoRails(): HomeRails {
  if (!IS_DEMO_CONTENT) {
    return { bestSellers: [], newArrivals: [], trending: [] };
  }
  return DEMO_RAILS;
}

export function getDemoProducts(): Product[] {
  return IS_DEMO_CONTENT ? DEMO_PRODUCTS : [];
}

export { DEMO_GUIDES, DEMO_TESTIMONIALS } from "./catalogue";
