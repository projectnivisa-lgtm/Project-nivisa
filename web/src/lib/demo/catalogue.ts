import type { ArtKey } from "@/config/navigation";
import type { Product } from "@/types/product";
import { getDemoReviews } from "./reviews";
import { demoImages } from "./photos";

/**
 * DEMO CONTENT — NOT API DATA.
 *
 * The backend is a book catalogue, so it cannot serve a single sofa. This
 * module supplies realistic furniture content so the storefront can be
 * designed and reviewed against believable copy, prices and dimensions rather
 * than lorem ipsum.
 *
 * Three rules govern it:
 *   1. It is only ever read through `getHomeContent()` in `lib/demo/index.ts`,
 *      which is gated on NEXT_PUBLIC_DEMO_CONTENT.
 *   2. Nothing here is ever presented as having come from the API. When demo
 *      mode is on, a build banner says so.
 *   3. Every product below satisfies the real `Product` type, so swapping in
 *      live data is a change of source, not a change of shape.
 *
 * Prices are researched mid-market Indian furniture retail figures. Dimensions
 * are internally consistent (a 3-seater is ~210cm, a queen bed is 152×198cm).
 */

interface DemoSeed {
  name: string;
  summary: string;
  art: ArtKey;
  mrp: number;
  selling: number;
  material: string;
  finish: string;
  room: string;
  w: number;
  d: number;
  h: number;
  stock: number;
  seating?: number;
}

const SEEDS: DemoSeed[] = [
  {
    name: "Malabar 3-Seater Sofa",
    summary: "Solid teak frame, hand-rubbed oil finish, reversible cushions",
    art: "sofa",
    mrp: 56000,
    selling: 42999,
    material: "Solid Teak",
    finish: "Natural Oil",
    room: "Living Room",
    w: 210,
    d: 90,
    h: 80,
    stock: 12,
    seating: 3,
  },
  {
    name: "Kadamba Queen Bed with Storage",
    summary: "Hydraulic lift storage that swallows a season of quilts",
    art: "bed",
    mrp: 48000,
    selling: 36500,
    material: "Solid Sheesham",
    finish: "Walnut",
    room: "Bedroom",
    w: 152,
    d: 198,
    h: 95,
    stock: 4,
  },
  {
    name: "Anantha 4-Door Wardrobe",
    summary: "Full-length mirror, soft-close hinges, two locker drawers",
    art: "wardrobe",
    mrp: 62000,
    selling: 51999,
    material: "Engineered Wood",
    finish: "Matte Ivory",
    room: "Bedroom",
    w: 180,
    d: 60,
    h: 210,
    stock: 9,
  },
  {
    name: "Vetri 6-Seater Dining Table",
    summary: "Live-edge acacia top on a powder-coated steel base",
    art: "table",
    mrp: 44000,
    selling: 34999,
    material: "Solid Acacia",
    finish: "Honey",
    room: "Dining Room",
    w: 180,
    d: 90,
    h: 76,
    stock: 6,
    seating: 6,
  },
  {
    name: "Sanjh Cane Armchair",
    summary: "Hand-woven rattan back on a slim ash frame",
    art: "chair",
    mrp: 18500,
    selling: 13999,
    material: "Cane & Ash",
    finish: "Natural",
    room: "Living Room",
    w: 68,
    d: 72,
    h: 84,
    stock: 3,
    seating: 1,
  },
  {
    name: "Nira Orthopaedic Mattress",
    summary: "Seven-zone memory foam, medium-firm, 10-year warranty",
    art: "mattress",
    mrp: 34000,
    selling: 21999,
    material: "Memory Foam",
    finish: "Quilted Knit",
    room: "Bedroom",
    w: 152,
    d: 198,
    h: 20,
    stock: 40,
  },
  {
    name: "Ilaya Study Desk",
    summary: "Cable channel, keyboard tray and a shelf that takes files upright",
    art: "study",
    mrp: 22000,
    selling: 16499,
    material: "Engineered Wood",
    finish: "Oak",
    room: "Study",
    w: 120,
    d: 60,
    h: 75,
    stock: 18,
  },
  {
    name: "Tarang Open Bookshelf",
    summary: "Five tiers, wall-anchored, rated to 20kg a shelf",
    art: "storage",
    mrp: 19500,
    selling: 14999,
    material: "Solid Mango",
    finish: "Dark Walnut",
    room: "Living Room",
    w: 90,
    d: 32,
    h: 180,
    stock: 11,
  },
  {
    name: "Deepa Arc Floor Lamp",
    summary: "Brushed brass stem with a linen drum shade",
    art: "lighting",
    mrp: 12000,
    selling: 8499,
    material: "Brass & Linen",
    finish: "Antique Brass",
    room: "Living Room",
    w: 160,
    d: 40,
    h: 200,
    stock: 22,
  },
  {
    name: "Chaya Coffee Table",
    summary: "Fluted base, tempered glass insert, felt-tipped feet",
    art: "table",
    mrp: 21000,
    selling: 15999,
    material: "Solid Sheesham",
    finish: "Charcoal",
    room: "Living Room",
    w: 110,
    d: 60,
    h: 42,
    stock: 7,
  },
  {
    name: "Sundara Shoe Cabinet",
    summary: "Three tilt-out fronts, holds eighteen pairs, 32cm deep",
    art: "storage",
    mrp: 15000,
    selling: 10999,
    material: "Engineered Wood",
    finish: "Ivory",
    room: "Entryway",
    w: 90,
    d: 32,
    h: 120,
    stock: 15,
  },
  {
    name: "Meera Balcony Set",
    summary: "Powder-coated aluminium and weatherproof rope, for two",
    art: "outdoor",
    mrp: 28000,
    selling: 22999,
    material: "Aluminium & Rope",
    finish: "Graphite",
    room: "Outdoor",
    w: 130,
    d: 70,
    h: 78,
    stock: 5,
    seating: 2,
  },
];

function toDemoProduct(seed: DemoSeed, index: number): Product {
  const discountPercent = Math.round(
    ((seed.mrp - seed.selling) / seed.mrp) * 100,
  );
  const slug = seed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const badges: Product["badges"] = [];
  if (discountPercent >= 5) badges.push("sale");
  if (seed.stock <= 5) badges.push("low-stock");
  if (index < 2) badges.push("bestseller");
  if (index >= 8) badges.push("new");

  return {
    id: `demo-${index + 1}`,
    slug,
    name: seed.name,
    summary: seed.summary,
    // Stand-in photography, chosen by silhouette. Not this product - there is
    // no such product - which the alt text says out loud. `ProductImage` still
    // draws its line art for anything that arrives without an image.
    images: demoImages(seed.name, seed.art),
    price: {
      selling: { amount: seed.selling, currency: "INR" },
      mrp: { amount: seed.mrp, currency: "INR" },
      discountPercent,
    },
    // Derived from the demo reviews that the product page actually renders,
    // NOT from the seed's headline figure. The product page emits this as
    // `aggregateRating` structured data, and markup claiming 214 ratings above
    // a list showing five is both a lie to the reader and the exact pattern
    // that gets rich results revoked. Card, badge, JSON-LD and the visible
    // list all read from one source.
    rating: demoRating(`demo-${index + 1}`),
    stockState:
      seed.stock <= 0 ? "out-of-stock" : seed.stock <= 5 ? "low-stock" : "in-stock",
    stockQuantity: seed.stock,
    dimensions: { widthCm: seed.w, depthCm: seed.d, heightCm: seed.h },
    specs: {
      material: seed.material,
      finish: seed.finish,
      room: seed.room,
      seatingCapacity: seed.seating,
    },
    variants: [],
    badges,
    // `art` rides along so the placeholder can pick the right silhouette.
    // Not part of the API contract — demo content only.
    ...({ demoArt: seed.art } as Record<string, unknown>),
  };
}

/** Average and count of the reviews this product will actually show. */
function demoRating(productId: string) {
  const reviews = getDemoReviews(productId);
  if (reviews.length === 0) return undefined;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    average: Math.round((sum / reviews.length) * 10) / 10,
    count: reviews.length,
  };
}

export const DEMO_PRODUCTS: Product[] = SEEDS.map(toDemoProduct);

export const DEMO_RAILS = {
  bestSellers: DEMO_PRODUCTS.slice(0, 6),
  newArrivals: [...DEMO_PRODUCTS].slice(6, 12),
  trending: [DEMO_PRODUCTS[3], DEMO_PRODUCTS[0], DEMO_PRODUCTS[5], DEMO_PRODUCTS[8]],
};

/** Editorial buying guides. Demo content — the blog API serves posts, not these. */
export const DEMO_GUIDES = [
  {
    slug: "sofa-size-guide",
    eyebrow: "Buying guide",
    title: "What size sofa actually fits your living room",
    readingMinutes: 6,
    art: "sofa" as ArtKey,
  },
  {
    slug: "solid-vs-engineered-wood",
    eyebrow: "Materials",
    title: "Solid wood or engineered: what you are really paying for",
    readingMinutes: 8,
    art: "storage" as ArtKey,
  },
  {
    slug: "mattress-firmness",
    eyebrow: "Sleep",
    title: "Firm, medium or soft — choosing without lying on it first",
    readingMinutes: 5,
    art: "mattress" as ArtKey,
  },
];

/** Customer reviews for the social-proof band. Demo content. */
export const DEMO_TESTIMONIALS = [
  {
    quote:
      "The teak is genuinely solid — you can feel the weight when you move it. Three months in and no creak.",
    name: "Ananya R.",
    city: "Bengaluru",
    product: "Malabar 3-Seater Sofa",
    rating: 5,
  },
  {
    quote:
      "Delivery team assembled the wardrobe in forty minutes and took the packaging away with them.",
    name: "Vikram S.",
    city: "Pune",
    product: "Anantha 4-Door Wardrobe",
    rating: 5,
  },
  {
    quote:
      "Ordered the queen bed for a 10x12 room. The storage is deep enough for two quilts and a suitcase.",
    name: "Meghna T.",
    city: "Hyderabad",
    product: "Kadamba Queen Bed",
    rating: 4,
  },
];
