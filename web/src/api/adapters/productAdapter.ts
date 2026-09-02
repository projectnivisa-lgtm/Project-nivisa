/**
 * Wire shape -> domain model.
 *
 * This file used to be a translation layer: the backend was a book catalogue,
 * and it renamed `Book` to `Product`, invented a single implicit variant,
 * dropped `Author` and `Translator`, and parsed dimensions out of free text.
 * The backend is furniture-native now, so none of that remains.
 *
 * What is left is the work that genuinely belongs here and nowhere else:
 * deriving the things the UI switches on — stock state, discount percent,
 * badges — from the raw figures, once, so no component re-derives them and
 * two screens can never disagree about whether something is "low stock".
 */
import type {
  Dimensions, Money, Product, ProductArMetadata, ProductBadge, ProductImage,
  ProductPrice, ProductRating, ProductSpecs, ProductVariant, StockState,
} from "@/types/product";

/* -------------------------------------------------------------------------
   Wire types — exactly what `/api/v1/catalog/*` returns.
   ------------------------------------------------------------------------- */

export interface ApiImage {
  id: number;
  url: string;
  alt_text: string;
  kind: "studio" | "lifestyle" | "detail" | "dimension";
  position: number;
  variant_id: number | null;
}

export interface ApiVariant {
  id: number;
  sku: string;
  option_label: string | null;
  price: string;
  compare_at_price: string | null;
  tax_rate: string;
  stock_quantity: number;
  low_stock_threshold: number;
  backorder_allowed: boolean;
  in_stock: boolean;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  weight_g: number | null;
  lead_time_days: number | null;
  position: number;
  is_active: boolean;
}

export interface ApiTaxonomyRef {
  id: number;
  name: string;
  slug: string;
}

export interface ApiAttribute extends ApiTaxonomyRef {
  kind: "material" | "finish" | "colour" | "style" | "upholstery";
  hex_code: string | null;
}

export interface ApiProductCard {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  brand: ApiTaxonomyRef | null;
  category: ApiTaxonomyRef | null;
  price_from: string;
  compare_at_price: string | null;
  primary_image: ApiImage | null;
  hover_image: ApiImage | null;
  in_stock: boolean;
  variant_count: number;
  default_variant_id: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  rating_average: number | null;
  rating_count: number;
}

export interface ApiProductDetail {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  status: string;
  brand: ApiTaxonomyRef | null;
  category: ApiTaxonomyRef | null;
  rooms: ApiTaxonomyRef[];
  attributes: ApiAttribute[];
  variants: ApiVariant[];
  images: ApiImage[];
  assembly_required: boolean | null;
  assembly_note: string | null;
  warranty_months: number | null;
  care_instructions: string | null;
  seating_capacity: number | null;
  specifications: Array<{ label: string; value: string }> | null;
  meta_title: string | null;
  meta_description: string | null;
  rating_average: number | null;
  rating_count: number;
  ar: ApiAr | null;
  created_at: string;
}

/** Sent only for a published, scale-checked model. See the AR section below. */
export interface ApiAr {
  enabled: boolean;
  status: string;
  model_url: string | null;
  ios_model_url: string | null;
  poster_url: string | null;
  real_world_width_cm: number | null;
  real_world_height_cm: number | null;
  real_world_depth_cm: number | null;
  scale_mode: string;
  placement: string;
  version: number;
  updated_at: string | null;
}

/* -------------------------------------------------------------------------
   Primitives
   ------------------------------------------------------------------------- */

/**
 * Decimal strings, not numbers, come off the wire — the API sends money as a
 * string so a two-decimal amount survives JSON without a float rounding it.
 * Parsed once here; nothing downstream sees a string.
 */
function money(value: string | number | null | undefined): Money {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return { amount: Number.isFinite(amount) ? amount : 0, currency: "INR" };
}

function mm(value: number | null | undefined): number | undefined {
  // Millimetres on the wire, centimetres in the UI: furniture is quoted in cm
  // in India, and a spec sheet reading "2140 cm" is the tell of a missed
  // conversion.
  return value == null ? undefined : Math.round(value / 10);
}

/** Newer than this and a product wears the "new" badge. */
const NEW_FOR_DAYS = 30;

function price(selling: string | number, compareAt: string | number | null): ProductPrice {
  const sellingMoney = money(selling);
  const compare = compareAt == null ? null : money(compareAt);

  // A compare-at at or below the selling price is not a saving. The API
  // already rejects it on write; this is the second guard, because a
  // struck-through number lower than what you pay is the kind of thing that
  // reaches a customer before it reaches a bug report.
  const hasReduction = compare !== null && compare.amount > sellingMoney.amount;
  const mrp = hasReduction ? compare : sellingMoney;

  return {
    selling: sellingMoney,
    mrp,
    discountPercent: hasReduction
      ? Math.round(((mrp.amount - sellingMoney.amount) / mrp.amount) * 100)
      : 0,
  };
}

function stockState(variant: {
  stock_quantity: number;
  low_stock_threshold: number;
  backorder_allowed: boolean;
}): StockState {
  // Backorder is checked first: a made-to-order piece has no meaningful stock
  // level, and reporting it "out of stock" would refuse a sale the shop is
  // happy to make.
  if (variant.backorder_allowed) return "made-to-order";
  if (variant.stock_quantity <= 0) return "out-of-stock";
  if (variant.stock_quantity <= variant.low_stock_threshold) return "low-stock";
  return "in-stock";
}

function image(source: ApiImage): ProductImage {
  return {
    url: source.url,
    alt: source.alt_text,
    // The API's "studio" is the domain's "primary": a cut-out on a plain
    // ground, which is what a card and the first gallery frame want.
    kind:
      source.kind === "studio"
        ? "primary"
        : source.kind === "lifestyle"
          ? "lifestyle"
          : source.kind === "detail"
            ? "detail"
            : "dimension",
  };
}

function rating(average: number | null, count: number): ProductRating | undefined {
  // Undefined rather than zero when nothing has been reviewed: "0.0 from 0
  // reviews" reads as a terrible product, where no stars at all reads as a
  // new one.
  if (average == null || count === 0) return undefined;
  return { average, count };
}

function badges(input: {
  createdAt?: string;
  discountPercent: number;
  stock: StockState;
}): ProductBadge[] {
  // Priority order, and the card renders only the first. A card wearing four
  // badges communicates nothing.
  const all: ProductBadge[] = [];
  if (input.stock === "out-of-stock") return [];
  if (input.discountPercent > 0) all.push("sale");
  if (input.stock === "low-stock") all.push("low-stock");
  if (input.stock === "made-to-order") all.push("made-to-order");
  if (input.createdAt) {
    const age = Date.now() - new Date(input.createdAt).getTime();
    if (age < NEW_FOR_DAYS * 86_400_000) all.push("new");
  }
  return all;
}

/* -------------------------------------------------------------------------
   Variants and specs
   ------------------------------------------------------------------------- */

/**
 * The option axis, inferred from the label.
 *
 * The API stores one free-text `option_label` per variant ("Walnut",
 * "1800mm, seats 6") rather than structured axes, because furniture options
 * are rarely a clean matrix — a sofa comes in three finishes, not in three
 * finishes crossed with two sizes. The selector shows one row of options, so
 * one axis name is all it needs.
 */
function axisFor(label: string | null): string {
  if (!label) return "Option";
  if (/mm|cm|seat/i.test(label)) return "Size";
  return "Finish";
}

function variant(source: ApiVariant, swatches: Map<string, string>): ProductVariant {
  const label = source.option_label ?? source.sku;
  return {
    id: String(source.id),
    label,
    axis: axisFor(source.option_label),
    // Matched by name against the product's colour attributes, so a variant
    // called "Ink boucle" picks up the Ink swatch. No match simply means no
    // swatch, never a wrong colour.
    swatchHex: swatches.get(label.toLowerCase().trim()),
    price: price(source.price, source.compare_at_price),
    stockState: stockState(source),
    available: source.is_active && source.in_stock,
  };
}

function specs(detail: ApiProductDetail): ProductSpecs | undefined {
  const of = (kind: ApiAttribute["kind"]) =>
    detail.attributes
      .filter((a) => a.kind === kind)
      .map((a) => a.name)
      .join(", ") || undefined;

  const result: ProductSpecs = {
    material: of("material"),
    finish: of("finish"),
    colour: of("colour"),
    style: of("style"),
    room: detail.rooms.map((r) => r.name).join(", ") || undefined,
    seatingCapacity: detail.seating_capacity ?? undefined,
    assemblyRequired: detail.assembly_required ?? undefined,
    assemblyNotes: detail.assembly_note ?? undefined,
    warrantyMonths: detail.warranty_months ?? undefined,
    careInstructions: detail.care_instructions ?? undefined,
    additional: detail.specifications ?? undefined,
  };

  // Every field empty means the section would render as an empty table.
  // Undefined lets the PDP hide it instead.
  return Object.values(result).some((v) => v !== undefined) ? result : undefined;
}

function dimensionsOf(source: {
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  weight_g?: number | null;
}): Dimensions | undefined {
  const dims: Dimensions = {
    widthCm: mm(source.width_mm),
    depthCm: mm(source.depth_mm),
    heightCm: mm(source.height_mm),
    weightKg: source.weight_g == null ? undefined : Math.round(source.weight_g / 100) / 10,
  };
  return Object.values(dims).some((v) => v !== undefined) ? dims : undefined;
}

/**
 * AR metadata.
 *
 * The API sends this only for a model that is published AND whose real-world
 * size was checked against the product's own dimensions, so anything arriving
 * here is safe to advertise. Absent is the common case and the honest default:
 * most furniture has no 3D model, and the page hides the button rather than
 * offering one that cannot work.
 */
function arMetadata(source: ApiAr | null): ProductArMetadata | undefined {
  if (!source || !source.enabled || source.status !== "ready") return undefined;
  return {
    enabled: true,
    status: "ready",
    modelUrl: source.model_url ?? undefined,
    iosModelUrl: source.ios_model_url ?? undefined,
    posterUrl: source.poster_url ?? undefined,
    realWorldWidthCm: source.real_world_width_cm ?? undefined,
    realWorldHeightCm: source.real_world_height_cm ?? undefined,
    realWorldDepthCm: source.real_world_depth_cm ?? undefined,
    scaleMode: source.scale_mode === "manual" ? "manual" : "fixed",
    placement: source.placement === "wall" ? "wall" : "floor",
    version: source.version,
    updatedAt: source.updated_at ?? undefined,
  };
}

/* -------------------------------------------------------------------------
   Public mappers
   ------------------------------------------------------------------------- */

/** A grid card. The list endpoint sends less than the detail endpoint does. */
export function toProductCard(source: ApiProductCard): Product {
  const productPrice = price(source.price_from, source.compare_at_price);
  const images = [source.primary_image, source.hover_image]
    .filter((i): i is ApiImage => i !== null)
    .map(image);

  // A card knows whether anything is buyable, but not each variant's count.
  // "in stock or not" is the honest resolution at this level; the low-stock
  // nudge belongs on the product page, where the real number is known.
  const stock: StockState = source.in_stock ? "in-stock" : "out-of-stock";

  return {
    id: String(source.id),
    slug: source.slug,
    name: source.name,
    summary: source.tagline ?? undefined,
    images,
    price: productPrice,
    rating: rating(source.rating_average, source.rating_count),
    stockState: stock,
    // Not sent on a card, and not guessed. Components use `stockState`.
    stockQuantity: 0,
    category: source.category
      ? { id: String(source.category.id), slug: source.category.slug, name: source.category.name }
      : undefined,
    brand: source.brand ? { id: String(source.brand.id), name: source.brand.name } : undefined,
    dimensions: dimensionsOf(source),
    // A card carries no variants, only the id of the one its price belongs
    // to. Fabricating a variant list here from a card's single price would
    // make a multi-option product look like it had one option.
    variants: [],
    defaultVariantId:
      source.variant_count === 1 && source.default_variant_id !== null
        ? String(source.default_variant_id)
        : undefined,
    badges: badges({ discountPercent: productPrice.discountPercent, stock }),
  };
}

export function toProduct(source: ApiProductDetail): Product {
  const sellable = source.variants.filter((v) => v.is_active);
  const variants = sellable.length ? sellable : source.variants;

  // The "from" price belongs to the cheapest variant, and so does everything
  // shown beside it. Taking the lowest price from one variant and the
  // compare-at from another would advertise a saving on a price nobody is
  // being offered.
  const cheapest = variants.reduce<ApiVariant | undefined>(
    (best, v) => (best === undefined || Number(v.price) < Number(best.price) ? v : best),
    undefined,
  );

  const productPrice = cheapest
    ? price(cheapest.price, cheapest.compare_at_price)
    : price(0, null);

  const swatches = new Map(
    source.attributes
      .filter((a) => a.kind === "colour" && a.hex_code)
      .map((a) => [a.name.toLowerCase().trim(), a.hex_code as string]),
  );

  const stock = cheapest ? stockState(cheapest) : "out-of-stock";
  const room = source.rooms[0];

  return {
    id: String(source.id),
    slug: source.slug,
    name: source.name,
    summary: source.tagline ?? undefined,
    description: source.description ?? undefined,
    images: source.images.map(image),
    price: productPrice,
    rating: rating(source.rating_average, source.rating_count),
    stockState: stock,
    stockQuantity: cheapest?.stock_quantity ?? 0,
    category: source.category
      ? { id: String(source.category.id), slug: source.category.slug, name: source.category.name }
      : undefined,
    room: room ? { id: String(room.id), slug: room.slug, name: room.name } : undefined,
    brand: source.brand ? { id: String(source.brand.id), name: source.brand.name } : undefined,
    dimensions: cheapest ? dimensionsOf(cheapest) : undefined,
    specs: specs(source),
    // A single-option product still gets its one variant, because that is what
    // the cart adds. The PDP hides the selector when there is only one.
    variants: variants.map((v) => variant(v, swatches)),
    defaultVariantId: cheapest ? String(cheapest.id) : undefined,
    badges: badges({
      createdAt: source.created_at,
      discountPercent: productPrice.discountPercent,
      stock,
    }),
    ar: arMetadata(source.ar),
    seo: {
      title: source.meta_title ?? undefined,
      description: source.meta_description ?? undefined,
      canonicalPath: `/product/${source.slug}`,
    },
  };
}
