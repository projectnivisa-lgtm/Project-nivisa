"use client";

import { useSyncExternalStore } from "react";
import { api } from "@/api/client";
import { isArPublishable, type Product } from "@/types/product";

/**
 * "View in your room".
 *
 * Deliberately **no 3D library**. Both mobile platforms already ship an AR
 * viewer, and using them costs nothing to download:
 *
 *  - iOS Safari renders `<a rel="ar">` pointing at a USDZ with AR Quick Look.
 *  - Android Chrome opens Scene Viewer through an `intent://` URL.
 *
 * A WebGL viewer would be several hundred kilobytes of JavaScript to render,
 * worse, the same model — on the device least able to afford the download,
 * since AR is used on a phone and often on mobile data.
 *
 * On desktop there is no AR. The button says so rather than opening a viewer
 * that cannot place anything in a room, because a control that does not do
 * what it says is worse than one that is not offered.
 */

type Platform = "ios" | "android" | "desktop";

/**
 * The glyph inside the iOS anchor, as a data URI.
 *
 * AR Quick Look requires the `rel="ar"` anchor to contain exactly one child
 * image element — without it Safari treats the link as an ordinary download
 * and the phone saves a .usdz file instead of opening AR. So this image is
 * load-bearing, not decoration, and it must never fail to load: a file in
 * /public can 404 after a bad deploy, and a product's own poster can be
 * missing or corrupt. Either renders a broken-image icon in the middle of the
 * button. Inlined, it cannot 404 and costs no request.
 */
const AR_GLYPH =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5"/><path d="M12 12v10"/></svg>',
  );

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, and the touch-point count is the only
  // reliable way to tell an iPad from a desktop Safari that cannot do AR.
  const isIpad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || isIpad) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** Fire-and-forget. Analytics must never be able to break a product page. */
function record(productId: string, kind: "opened" | "added_to_cart", platform?: Platform) {
  void api
    .post("/ar/events", { product_id: Number(productId), kind, platform }, {
      auth: false,
      withSession: true,
    })
    .catch(() => {});
}

/** Called from the buy panel, so an AR-assisted sale can be attributed. */
export function recordArAssistedAdd(productId: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (sessionStorage.getItem(`nivisa.ar.${productId}`) !== "1") return;
    record(productId, "added_to_cart");
  } catch {
    /* Storage unavailable — the sale still happens, it is just not attributed. */
  }
}

/**
 * The platform never changes under a live page, so there is nothing to
 * subscribe to. Required by `useSyncExternalStore`, which needs a stable
 * function; returning the unsubscribe immediately is the whole contract.
 */
function subscribePlatform() {
  return () => {};
}

export function ArButton({ product }: { product: Product }) {
  // Resolved after mount: the server has no user agent to read, and rendering
  // an iOS link that hydrates into an Android one would flash the wrong
  // control.
  //
  // `useSyncExternalStore` rather than a state-setting effect. The platform is
  // not React state that changes - it is a fact about the device, read once -
  // and setting state synchronously inside an effect asks React to render the
  // whole subtree twice to arrive somewhere it could have started. The server
  // snapshot is null, which is exactly the "not yet known" case handled below.
  const platform = useSyncExternalStore(subscribePlatform, detectPlatform, () => null);

  if (!isArPublishable(product)) return null;

  const ar = product.ar!;
  const label = "View in your room";

  // Before hydration, and on a platform with no model, the button is not
  // rendered at all rather than rendered disabled — a greyed-out control
  // invites a tap that will do nothing.
  if (platform === null) return null;

  const onOpen = () => {
    record(product.id, "opened", platform);
    try {
      sessionStorage.setItem(`nivisa.ar.${product.id}`, "1");
    } catch {
      /* Attribution is a nice-to-have; AR still opens. */
    }
  };

  if (platform === "ios" && ar.iosModelUrl) {
    return (
      <a
        rel="ar"
        href={ar.iosModelUrl}
        onClick={onOpen}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-border-interactive text-sm font-medium transition-colors duration-fast hover:border-ink"
      >
        {/* Load-bearing, not decoration — see AR_GLYPH. The poster is used
            when there is one, and any failure to load falls back to the
            inline glyph rather than leaving a broken image in the button.

            Exempt from the next/image rule rather than converted: AR Quick
            Look requires the `rel="ar"` anchor to contain exactly one child
            image element, and next/image renders a wrapper around its img.
            With one, Safari downloads the .usdz instead of opening AR. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ar.posterUrl ?? AR_GLYPH}
          alt=""
          width={20}
          height={20}
          style={{ objectFit: "cover" }}
          onError={(event) => {
            event.currentTarget.src = AR_GLYPH;
          }}
        />
        {label}
      </a>
    );
  }

  if (platform === "android" && ar.modelUrl) {
    const model = new URL(ar.modelUrl, window.location.origin).href;
    const fallback = window.location.href;
    // `resizable=false` is what holds a sofa at its real size. Scene Viewer
    // otherwise lets a customer pinch it until it fits, which produces a
    // confident wrong answer to the only question AR is being asked.
    const intent =
      `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(model)}` +
      `&mode=ar_only&resizable=${ar.scaleMode === "manual"}` +
      `#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(fallback)};end;`;

    return (
      <a
        href={intent}
        onClick={onOpen}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-border-interactive text-sm font-medium transition-colors duration-fast hover:border-ink"
      >
        {label}
      </a>
    );
  }

  // Desktop, or a phone whose platform has no model uploaded. Honest about
  // why, and it names the dimensions instead — which is the same question AR
  // answers, asked a slower way.
  const dims = [ar.realWorldWidthCm, ar.realWorldDepthCm, ar.realWorldHeightCm]
    .filter((n): n is number => typeof n === "number")
    .map((n) => Math.round(n));

  return (
    <p className="rounded-sm border border-border bg-surface p-4 text-xs leading-relaxed text-ink-muted">
      <span className="font-medium text-ink">This piece has a 3D model.</span> Open this page on
      your phone to stand it in your room at full size
      {dims.length === 3 ? ` — it measures ${dims[0]} × ${dims[1]} × ${dims[2]} cm.` : "."}
    </p>
  );
}
