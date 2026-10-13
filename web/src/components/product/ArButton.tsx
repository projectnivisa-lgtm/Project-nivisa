"use client";

import { useState, useSyncExternalStore } from "react";
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

/** Centimetres to feet and inches, the way furniture is sold in India. */
function toFeetInches(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  if (feet === 0) return `${inches}"`;
  return inches === 0 ? `${feet}'` : `${feet}' ${inches}"`;
}

interface Measured {
  width?: number;
  depth?: number;
  height?: number;
  /** "214 × 90 × 78 cm", or null when too little is known to be useful. */
  summary: string | null;
}

function arMeasurements(ar: {
  realWorldWidthCm?: number;
  realWorldDepthCm?: number;
  realWorldHeightCm?: number;
}): Measured {
  const round = (n?: number) =>
    typeof n === "number" && n > 0 ? Math.round(n) : undefined;
  const width = round(ar.realWorldWidthCm);
  const depth = round(ar.realWorldDepthCm);
  const height = round(ar.realWorldHeightCm);
  const parts = [width, depth, height].filter((n): n is number => n !== undefined);
  return {
    width,
    depth,
    height,
    summary: parts.length >= 2 ? `${parts.join(" × ")} cm` : null,
  };
}

/**
 * The line under the AR button.
 *
 * Small, quiet, and always there rather than appearing after a failure: by
 * the time the viewer says it cannot find a surface, the customer is already
 * in a full-screen camera app we do not control and cannot add anything to.
 * The only moment we own is before the tap.
 */
function ArHint({ text, surface }: { text: string; surface: "floor" | "wall" }) {
  return (
    <p className="mt-2 text-2xs leading-relaxed text-ink-subtle">
      <span className="font-medium text-ink-muted">Finding a {surface}:</span> {text}
    </p>
  );
}

/**
 * Measurements, on demand.
 *
 * Neither AR viewer will draw a dimension line for us - they are the phone's
 * own apps and take a file, not an overlay. What they do accept is a caption,
 * so the size travels INTO the session (see `title` and `checkoutSubtitle`
 * below), and this button is the same figures on the way in.
 *
 * Collapsed by default: the buy panel is already dense, and someone who has
 * decided to see the piece in their room is not usually reading a table at
 * the same moment.
 */
function ArMeasurements({ measured }: { measured: Measured }) {
  const [open, setOpen] = useState(false);
  // Typed as the widened pair rather than `as const`: a readonly tuple of
  // literals cannot be narrowed to [string, number] by a predicate, which is
  // what `next build` rejected while the editor's looser check let it pass.
  const rows: Array<[string, number]> = (
    [
      ["Width", measured.width],
      ["Depth", measured.depth],
      ["Height", measured.height],
    ] as Array<[string, number | undefined]>
  ).filter((r): r is [string, number] => typeof r[1] === "number");

  if (rows.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8h18M3 8v8M21 8v8M7 8v3M11 8v3M15 8v3M19 8v3" />
        </svg>
        {open ? "Hide measurements" : "Show measurements"}
      </button>

      {open ? (
        <dl className="mt-2 rounded-sm border border-border bg-surface p-3">
          {rows.map(([label, cm]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 py-1 text-xs"
            >
              <dt className="text-ink-muted">{label}</dt>
              <dd className="tabular text-ink">
                {cm} cm
                <span className="ml-2 text-ink-subtle">{toFeetInches(cm)}</span>
              </dd>
            </div>
          ))}
          <p className="mt-2 border-t border-border pt-2 text-2xs leading-relaxed text-ink-subtle">
            The model is placed at exactly this size — it cannot be resized in
            AR, so what you see standing in the room is what arrives.
          </p>
        </dl>
      ) : null}
    </div>
  );
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

  /**
   * What to point the phone at.
   *
   * Both AR viewers have to find a flat surface before they can put anything
   * down, and in a furnished room that is the one thing there is least of.
   * When it fails they say "move your phone around", which describes the
   * remedy without saying what they are looking for — so people sweep the
   * camera over a sofa and a rug and conclude the feature is broken.
   *
   * `placement` has been recorded against every model since AR was built and
   * has never been read: a wall unit was being sent to the same viewer as a
   * bed with no hint of which surface it belongs on. This is what it is for.
   */
  const surface = ar.placement === "wall" ? "wall" : "floor";
  const hint =
    ar.placement === "wall"
      ? "Point at a clear patch of wall a couple of steps away, and move the phone slowly until it finds the surface."
      : "Point at a clear patch of floor a couple of steps away, and move the phone slowly until it finds the surface.";

  /**
   * The piece's real size, from the model's own validated figures.
   *
   * `ar.realWorld*` rather than `product.dimensions`: publishing already
   * refused unless the two agree within 5%, and these are what the thing
   * standing in the room actually measures.
   */
  const measured = arMeasurements(ar);

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
    // Quick Look's equivalent of Scene Viewer's `resizable=false`, and it was
    // missing: Android held a sofa at its true size while an iPhone let the
    // customer pinch it to whatever fitted. Both platforms now refuse, which
    // is the whole point of the 5% scale check that let the model publish.
    //
    // A URL fragment rather than a query parameter, because Quick Look reads
    // it from the fragment and a query string would be sent to the CDN as
    // part of the file name.
    // Quick Look draws a banner across the bottom of the AR view. Its
    // subtitle is the one place a measurement can be put on an iPhone while
    // the piece is standing in the room, so that is what it carries; the
    // canonical URL is what makes the banner appear at all.
    const params = [
      ar.scaleMode === "manual" ? null : "allowsContentScaling=0",
      `canonicalWebPageURL=${encodeURIComponent(window.location.href)}`,
      `checkoutTitle=${encodeURIComponent(product.name)}`,
      measured.summary
        ? `checkoutSubtitle=${encodeURIComponent(measured.summary)}`
        : null,
      "callToAction=Back%20to%20product",
    ].filter((v): v is string => v !== null);

    const quickLook = `${ar.iosModelUrl}#${params.join("&")}`;

    return (
      <div>
        {/* The hint sits OUTSIDE this anchor on purpose: AR Quick Look needs
            the `rel="ar"` element to contain exactly one child image, and a
            second child stops Safari opening AR at all. */}
        <a
          rel="ar"
          href={quickLook}
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
        <ArHint text={hint} surface={surface} />
        <ArMeasurements measured={measured} />
      </div>
    );
  }

  if (platform === "android" && ar.modelUrl) {
    const model = new URL(ar.modelUrl, window.location.origin).href;
    const fallback = window.location.href;
    // `resizable=false` is what holds a sofa at its real size. Scene Viewer
    // otherwise lets a customer pinch it until it fits, which produces a
    // confident wrong answer to the only question AR is being asked.
    //
    // `mode=3d_preferred` opens Scene Viewer's own object viewer FIRST -
    // the model framed to its bounding box, pinch to zoom, drag to turn -
    // with a button through to camera AR. `ar_only` skipped that and put the
    // piece straight into the room, where it fills the screen and the only
    // way to see the whole of it is to walk backwards: there is no pinch
    // zoom in AR precisely because resizable is false. The preview is also
    // the graceful answer on a phone with no ARCore, which ar_only bounced
    // back to the web page.
    //
    // This matches what an iPhone already does: Quick Look opens in object
    // mode and the customer taps through to AR.
    // Scene Viewer prints `title` over the model, in AR and in the 3D view.
    // It is the only caption it accepts, so the measurements ride along with
    // the name - the size is readable while the piece is standing in the room,
    // which is the moment somebody wants it.
    const caption = measured.summary
      ? `${product.name} · ${measured.summary}`
      : product.name;

    const intent =
      `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(model)}` +
      `&mode=3d_preferred&resizable=${ar.scaleMode === "manual"}` +
      `&title=${encodeURIComponent(caption)}` +
      `#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(fallback)};end;`;

    return (
      <div>
        <a
          href={intent}
          onClick={onOpen}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-border-interactive text-sm font-medium transition-colors duration-fast hover:border-ink"
        >
          {label}
        </a>
        <ArHint text={hint} surface={surface} />
        <ArMeasurements measured={measured} />
      </div>
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
