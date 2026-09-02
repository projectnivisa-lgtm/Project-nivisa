/**
 * The furniture domain model.
 *
 * This is the shape the entire UI operates on. It intentionally does not
 * resemble the current backend, which is a book catalogue: the mapping from
 * `Book` to `Product` lives in `src/api/adapters/productAdapter.ts` and is the
 * only file that knows the legacy vocabulary exists.
 *
 * Fields are marked with their backend status so nobody has to guess:
 *   [live]    — populated from the current API today.
 *   [absent]  — no backend field exists; always undefined until the catalogue
 *               is migrated. Safe to render conditionally, never fabricated.
 */

export type ProductId = string;

/** Availability, derived rather than raw so the UI has one thing to switch on. */
export type StockState =
  | "in-stock"
  | "low-stock" // on hand, but few enough to create urgency honestly
  | "out-of-stock"
  | "made-to-order";

export interface Money {
  /** Amount in rupees. The backend sends rupees, not paise. */
  amount: number;
  currency: "INR";
}

export interface ProductPrice {
  /** What the customer pays. */
  selling: Money;
  /** Manufacturer's list price. Only shown when strictly greater than selling. */
  mrp: Money;
  /** Whole-number percent off, 0 when there is no reduction. */
  discountPercent: number;
}

export interface ProductImage {
  url: string;
  alt: string;
  /** Lets the PDP gallery group lifestyle shots apart from cut-outs. [absent] */
  kind?: "primary" | "alternate" | "lifestyle" | "detail" | "dimension";
}

export interface ProductRating {
  /** Mean score 0–5. */
  average: number;
  count: number;
  /** Star -> number of reviews. [absent] — computed client-side from reviews. */
  distribution?: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** Physical size, in centimetres. Furniture shoppers measure before they buy. */
export interface Dimensions {
  widthCm?: number;
  depthCm?: number;
  heightCm?: number;
  /** Free-text fallback when the backend has an unparsed dimension string. */
  raw?: string;
  weightKg?: number;
}

export type ProductBadge =
  | "new"
  | "bestseller"
  | "sale"
  | "low-stock"
  | "made-to-order"
  | "ar-ready";

/**
 * A purchasable variation — "Teak / 3-Seater". [absent]
 *
 * The current backend has no variant concept: one product is one SKU. The type
 * exists so the PDP, cart and admin forms are built around variants from day
 * one; the adapter currently returns a single implicit variant per product, so
 * no screen has to be rewritten when real variants arrive.
 */
export interface ProductVariant {
  id: string;
  /** Label shown on the selector, e.g. "Walnut". */
  label: string;
  /** Which axis this belongs to, e.g. "Finish". */
  axis: string;
  /** Hex for colour/material swatches. */
  swatchHex?: string;
  swatchImageUrl?: string;
  price?: ProductPrice;
  stockState: StockState;
  available: boolean;
}

/** Furniture attributes. All [absent] on the current backend. */
export interface ProductSpecs {
  material?: string;
  finish?: string;
  colour?: string;
  room?: string;
  style?: string;
  seatingCapacity?: number;
  assemblyRequired?: boolean;
  assemblyNotes?: string;
  warrantyMonths?: number;
  careInstructions?: string;
  installationIncluded?: boolean;
  /** Arbitrary spec rows for the PDP table, in display order. */
  additional?: Array<{ label: string; value: string }>;
}

export interface Product {
  id: ProductId;
  /** URL segment for /product/[slug]. Falls back to the id when unset. */
  slug: string;
  name: string;
  /** Marketing one-liner under the title. */
  summary?: string;
  description?: string;

  images: ProductImage[];
  price: ProductPrice;
  rating?: ProductRating;

  stockState: StockState;
  /** On-hand units. Used for the low-stock threshold, never shown raw. */
  stockQuantity: number;

  category?: { id: string; slug: string; name: string };
  /** Room association drives /category and the "Shop by room" navigation. [absent] */
  room?: { id: string; slug: string; name: string };
  /** Present because Indian furniture retail is multi-brand. [live, remapped] */
  brand?: { id: string; name: string };

  dimensions?: Dimensions;
  specs?: ProductSpecs;
  variants: ProductVariant[];
  /**
   * The variant the displayed price belongs to — the cheapest active one.
   *
   * A grid card carries this but no `variants`, because a listing does not
   * need every option's price and stock. It is what lets a single-option
   * product be added to the cart straight from a grid or a wishlist; with
   * more than one variant the card links to the product page instead, since
   * choosing on the shopper's behalf is guessing.
   */
  defaultVariantId?: string;
  badges: ProductBadge[];

  /**
   * AR is a separate subsystem (Phase 13). It is intentionally an optional
   * sub-object rather than inline fields, so no core component ever destructures
   * AR state by accident, and `ar === undefined` is the honest default for a
   * backend that has never heard of 3D models.
   */
  ar?: ProductArMetadata;

  /**
   * Buying questions shown on the product page. [absent]
   *
   * Furniture has a small set of recurring pre-purchase questions ("does it
   * come assembled?", "will it fit through a 30-inch door?") that reviews
   * answer badly and a spec table answers not at all. No backend field exists,
   * so this stays undefined and the section does not render.
   */
  faqs?: Array<{ question: string; answer: string }>;

  seo?: {
    title?: string;
    description?: string;
    canonicalPath?: string;
  };
}

/* -------------------------------------------------------------------------
   AR — Phase 13. Declared here so the type is shared, but nothing in the
   core commerce flow reads it. [absent] on the current backend.
   ------------------------------------------------------------------------- */

export type ArModelStatus =
  | "unavailable" // no model has been supplied
  | "processing" // uploaded, optimisation pipeline running
  | "ready" // validated and publishable — the ONLY state that shows the CTA
  | "failed" // validation rejected it
  | "deprecated"; // superseded, kept for rollback

export interface ProductArMetadata {
  enabled: boolean;
  status: ArModelStatus;
  /** glTF binary, for WebXR and Android Scene Viewer. */
  modelUrl?: string;
  /** USDZ, for iOS AR Quick Look. */
  iosModelUrl?: string;
  posterUrl?: string;
  /**
   * True-world size of the model, which must match `Product.dimensions`.
   * Admin validation refuses to publish when they disagree.
   */
  realWorldWidthCm?: number;
  realWorldHeightCm?: number;
  realWorldDepthCm?: number;
  /** Furniture is locked to actual size; manual scaling misleads buyers. */
  scaleMode: "fixed" | "manual";
  placement: "floor" | "wall";
  version?: number;
  updatedAt?: string;
}

/** A product may only advertise AR when a validated model is actually live. */
export function isArPublishable(product: Product): boolean {
  return product.ar?.enabled === true && product.ar.status === "ready";
}

/* -------------------------------------------------------------------------
   Listing
   ------------------------------------------------------------------------- */

export type ProductSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating" // [absent] — backend has no rating sort; the UI hides this option
  | "discount"; // [absent]

export interface ProductFilters {
  query?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: ProductSort;
  /**
   * Furniture facets the UI is architected for but the backend cannot filter
   * on yet. They are carried through the filter state and the URL so the
   * listing page is ready; `catalog.listProducts` drops them from the request
   * rather than sending parameters the API would ignore.
   */
  material?: string[];
  colour?: string[];
  room?: string[];
  style?: string[];
  seatingCapacity?: number[];
  minRating?: number;
}

/**
 * Offset-based paging, matching what `/catalog/books` actually returns
 * (`{books, total, nextCursor}`) rather than the `{page, total_pages}` shape
 * described in the docs' generic pagination section. Do not invent page
 * numbers the backend never sent.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
