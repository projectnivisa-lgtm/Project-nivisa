/**
 * Stock photography used as a stand-in, and how to size it.
 *
 * Hotlinked from Unsplash, whose licence (https://unsplash.com/license) allows
 * commercial use without permission or attribution, and whose CDN crops and
 * resizes at the edge — so one photo id serves a card, a gallery and a hero
 * without three files, and a phone never downloads a 4000px original.
 *
 * Nothing here shows a Nivisa product. These are placeholders that make the
 * shop read as a furniture shop while it is being designed and demoed; every
 * one of them is replaced by real photography uploaded through the dashboard,
 * with no code change. Where a photograph would be claiming to *be* a specific
 * product, the alt text says it is a stand-in.
 *
 * The API seed keeps a matching bank in `apis/scripts/photos.py`, for the rows
 * it writes into the database.
 */

const SOURCE = "https://images.unsplash.com/photo-";

/** A cropped, right-sized delivery URL for one photograph. */
export function stockImage(id: string, width: number, height: number): string {
  return `${SOURCE}${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
}

/**
 * Fixed placements — art directed once, rather than picked by silhouette.
 * Photo ids are left legible so a wrong-looking frame can be traced back to a
 * photograph instead of a hash.
 */
export const STOCK = {
  /** The homepage hero. Wide, so it survives being cropped to the text column. */
  hero: stockImage("1600210492486-724fe5c67fb0", 1600, 1200),
} as const;

/**
 * Widths offered to the browser for a CDN-backed image.
 *
 * Chosen to cover a card on a phone through a hero on a 2x desktop without
 * offering so many that the srcset itself becomes the payload. The browser
 * picks one using `sizes` and its own pixel ratio; our job is only to make
 * sure a 310px card is not handed a 1600px file, which is what happened while
 * every image was a single fixed-width URL.
 */
const WIDTHS = [320, 480, 640, 960, 1280, 1600];

/**
 * A `srcset` for one of these photographs, or nothing.
 *
 * Only for the CDN: it resizes on request, so a set of widths costs one
 * parameter each. An uploaded photograph served from our own /media has no
 * resizer behind it, and offering widths that all return the same bytes would
 * be a lie the browser acts on.
 *
 * Never wider than the URL already asks for. Upscaling past the requested
 * width buys no detail and costs bandwidth to prove it.
 */
export function stockSrcSet(url: string | null | undefined): string | undefined {
  if (!url || !url.includes("images.unsplash.com")) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  const width = Number(parsed.searchParams.get("w"));
  if (!width) return undefined;

  // Kept so every width in the set crops to the same shape - a srcset whose
  // candidates have different aspect ratios makes the layout jump when the
  // browser swaps one for another.
  const height = Number(parsed.searchParams.get("h"));
  const ratio = height ? height / width : null;

  return WIDTHS.filter((candidate) => candidate <= width)
    .map((candidate) => {
      const variant = new URL(parsed.toString());
      variant.searchParams.set("w", String(candidate));
      if (ratio) variant.searchParams.set("h", String(Math.round(candidate * ratio)));
      return `${variant.toString()} ${candidate}w`;
    })
    .join(", ");
}
