import type { ArtKey } from "@/config/navigation";
import { stockImage } from "@/config/stockImages";
import type { ProductImage } from "@/types/product";

/**
 * DEMO PHOTOGRAPHY — STAND-INS, NOT PRODUCTS.
 *
 * Hotlinked from Unsplash, whose licence (https://unsplash.com/license) allows
 * commercial use with no permission and no attribution, and whose CDN is the
 * delivery it intends. The photo ids stay legible below so the credit is at
 * least possible, and so a wrong-looking card can be traced to a photograph
 * rather than to a hash.
 *
 * None of these show a Nivisa product — there are no Nivisa products. They
 * exist so a demo of the storefront reads as a furniture shop instead of a
 * wireframe. `ProductImage`'s line-art fallback is still what renders for
 * anything not listed here, and real photography replaces both.
 *
 * The API seed keeps the same bank in `apis/scripts/photos.py`. Two copies
 * because the two sides never talk: demo content is a build-time constant in
 * the storefront, the seed writes rows in a database. Keep them in step by
 * hand, or don't — nothing breaks if they drift, since both are stand-ins.
 */

/**
 * Three framings per silhouette: the card's portrait cut-out, a room, and a
 * close view. Ordered the way the product gallery shows them.
 */
const SETS: Record<ArtKey, [studio: string, lifestyle: string, detail: string]> = {
  sofa: ["1555041469-a586c61ea9bc", "1493663284031-b7e3aefcae8e", "1567016432779-094069958ea5"],
  bed: ["1631049307264-da0ec9d70304", "1615874959474-d609969a20ed", "1592789705501-f9ae4278a9c9"],
  mattress: ["1631049307264-da0ec9d70304", "1617104678098-de229db51175", "1584100936595-c0654b55a2e2"],
  wardrobe: ["1558997519-83ea9252edf8", "1505693416388-ac5ce068fe85", "1595428774223-ef52624120d2"],
  storage: ["1594026112284-02bb6f3352fe", "1616486338812-3dadae4b4ace", "1526243741027-444d633d7365"],
  table: ["1617806118233-18e1de247200", "1544457070-4cd773b4d71e", "1517705008128-361805f42e86"],
  chair: ["1567538096630-e0c55bd6374c", "1550226891-ef816aed4a98", "1586023492125-27b2c045efd7"],
  study: ["1518455027359-f3f8164ba6bd", "1593062096033-9a26b09da705", "1533090161767-e6ffed986c88"],
  lighting: ["1507473885765-e6ed057f782c", "1524758631624-e2822e304c36", "1513506003901-1e6a229e2d15"],
  decor: ["1594026112284-02bb6f3352fe", "1616486338812-3dadae4b4ace", "1513506003901-1e6a229e2d15"],
  outdoor: ["1416331108676-a22ccb276e35", "1560448204-e02f11c3d0e2", "1519710164239-da123dc03ef4"],
  kids: ["1503602642458-232111445657", "1631679706909-1844bbd07221", "1517705008128-361805f42e86"],
};

/**
 * Alt text says these are stand-ins.
 *
 * Someone reading the page through a screen reader gets nothing else to go on,
 * and telling them a stock room is the piece they are about to buy is the one
 * failure worth avoiding here.
 */
export function demoImages(name: string, art: ArtKey): ProductImage[] {
  const [studio, lifestyle, detail] = SETS[art];
  return [
    {
      // Landscape, like the piece itself: a portrait crop of a wide subject
      // returns the middle of a sofa and none of its shape.
      url: stockImage(studio, 1600, 1200),
      alt: `Stand-in photograph for ${name}: a similar piece against a plain background`,
      kind: "primary",
    },
    {
      url: stockImage(lifestyle, 1600, 1200),
      alt: `Stand-in photograph for ${name}: a similar piece in a furnished room`,
      kind: "lifestyle",
    },
    {
      url: stockImage(detail, 1200, 1200),
      alt: `Stand-in photograph for ${name}: a close view of a similar material`,
      kind: "detail",
    },
  ];
}

/** One tile, for a room, category or editorial card. */
export function demoTile(art: ArtKey, width = 1200, height = 900): string {
  return stockImage(SETS[art][1], width, height);
}
