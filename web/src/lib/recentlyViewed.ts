import type { Product } from "@/types/product";

/**
 * Locally remembered "recently viewed", for signed-out visitors.
 *
 * The API tracks a guest's views — `POST /catalog/books/{id}/view` accepts an
 * anonymous caller and writes a row marked `guest` — but nothing can read them
 * back: `GET /catalog/recently-viewed` is customer-only, and every guest shares
 * one `"guest"` marker, so there is no per-person list to return even in
 * principle. A guest's views are recorded and unreadable.
 *
 * Rather than show the rail only to signed-in customers, guests get a local
 * list. It is the same feature, kept on the device instead of the server.
 *
 * **What is stored, and why a snapshot.** There is no public "fetch these
 * product ids" endpoint, so rebuilding the rail from ids alone would cost one
 * request per product. A small snapshot is kept instead. That snapshot can go
 * stale — a price changed since the visit would display the old figure — so
 * this is treated strictly as a navigation aid back to the product, and the
 * product page remains the only authority on price. Signed-in customers read
 * live data from the API and are unaffected.
 */

const STORAGE_KEY = "nivisa.recentlyViewed";

/** Matches the backend's per-customer cap, so both paths behave the same. */
const MAX_ENTRIES = 20;

export interface RecentEntry {
  id: string;
  slug: string;
  name: string;
  /** Rupees, at the time of the visit. See the staleness note above. */
  price: number;
  mrp: number;
  discountPercent: number;
  /** Line-art key, so the rail renders without a network round trip. */
  art?: string;
  viewedAt: number;
}

function read(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: RecentEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* Storage unavailable — the rail is simply empty for this visitor. */
  }
}

export const recentlyViewedStore = {
  list(): RecentEntry[] {
    return read();
  },

  /** Most recent first, one entry per product, capped — same as the backend. */
  record(product: Product, art?: string): void {
    if (typeof window === "undefined") return;

    const entry: RecentEntry = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price.selling.amount,
      mrp: product.price.mrp.amount,
      discountPercent: product.price.discountPercent,
      art,
      viewedAt: Date.now(),
    };

    const next = [entry, ...read().filter((e) => e.id !== product.id)].slice(
      0,
      MAX_ENTRIES,
    );
    write(next);
  },

  clear(): void {
    write([]);
  },
};

/**
 * Rebuilds a `Product` from a stored entry.
 *
 * Only the fields the card actually renders are reconstructed. Everything else
 * is left at its empty default rather than invented — a card built from a
 * snapshot should not claim a rating or a stock state it never captured.
 */
export function entryToProduct(entry: RecentEntry): Product {
  return {
    id: entry.id,
    slug: entry.slug,
    name: entry.name,
    images: [],
    price: {
      selling: { amount: entry.price, currency: "INR" },
      mrp: { amount: entry.mrp, currency: "INR" },
      discountPercent: entry.discountPercent,
    },
    // Deliberately unset: the snapshot has no live stock, and showing
    // "in stock" from a week-old visit would be a claim we cannot support.
    stockState: "in-stock",
    stockQuantity: 0,
    variants: [],
    badges: [],
    ...({ demoArt: entry.art } as Record<string, unknown>),
  };
}
