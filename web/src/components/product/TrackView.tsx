"use client";

import { useEffect, useRef } from "react";
import { catalogApi } from "@/api/catalog";
import { recentlyViewedStore } from "@/lib/recentlyViewed";
import { demoArtKey } from "@/lib/demo";
import type { Product } from "@/types/product";

/**
 * Records a product view.
 *
 * Two destinations, because one of them cannot be read back:
 *
 *  - **The API**, which keeps the canonical per-customer list. Fire-and-forget:
 *    `catalogApi.trackView` swallows its own errors, so a failed analytics call
 *    can never interrupt browsing.
 *  - **Local storage**, which is the only place a signed-out visitor's history
 *    can live — the backend records guest views under one shared `"guest"`
 *    marker and never serves them back. Written for signed-in customers too, so
 *    the rail still works if they sign out.
 *
 * The ref guard stops React's development double-effect recording two views
 * per visit, which would quietly skew the one endpoint this feeds.
 */
export function TrackView({ product }: { product: Product }) {
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    if (recorded.current === product.id) return;
    recorded.current = product.id;

    void catalogApi.trackView();
    recentlyViewedStore.record(product, demoArtKey(product));
  }, [product]);

  return null;
}
