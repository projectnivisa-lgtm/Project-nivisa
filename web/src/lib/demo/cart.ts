import { DEMO_PRODUCTS } from "./catalogue";
import { EMPTY_CART, type Cart, type CartLine } from "@/types/cart";
import type { Money } from "@/types/product";

/**
 * DEMO CONTENT — NOT API DATA. See `lib/demo/catalogue.ts`.
 *
 * A working cart for demo mode, held in localStorage.
 *
 * This is the ONE place in the application permitted to compute cart totals.
 * Everywhere else the backend is authoritative and the frontend must never
 * recompute (see `types/cart.ts`) — but in demo mode there is no backend to be
 * authoritative, and a cart that cannot add an item makes the entire checkout
 * flow undemonstrable. The rules below are stated once, here, and are visibly
 * labelled demo by the banner the layout renders.
 */

/** Matches the announcement bar, so the two cannot drift apart. */
const FREE_SHIPPING_THRESHOLD = 15000;
const SHIPPING_FEE = 1499;

/** Demo coupons. Real coupon rules live server-side and are not modelled here. */
const COUPONS: Record<string, { label: string; percent: number; maxOff: number }> = {
  NIVISA10: { label: "10% off your first order", percent: 10, maxOff: 5000 },
  ROOM15: { label: "15% off when you furnish a room", percent: 15, maxOff: 10000 },
};

const STORAGE_KEY = "nivisa.demoCart";

interface StoredLine {
  productId: string;
  quantity: number;
}

interface StoredCart {
  lines: StoredLine[];
  coupon?: string;
}

function read(): StoredCart {
  if (typeof window === "undefined") return { lines: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lines: [] };
    const parsed = JSON.parse(raw) as StoredCart;
    return Array.isArray(parsed.lines) ? parsed : { lines: [] };
  } catch {
    return { lines: [] };
  }
}

function write(cart: StoredCart): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* Storage unavailable — the demo cart lasts for this page only. */
  }
}

const money = (amount: number): Money => ({
  amount: Math.round(amount),
  currency: "INR",
});

function build(stored: StoredCart): Cart {
  const lines: CartLine[] = [];
  let subtotal = 0;
  let savings = 0;
  let itemCount = 0;

  for (const entry of stored.lines) {
    const product = DEMO_PRODUCTS.find((p) => p.id === entry.productId);
    if (!product) continue; // A product removed from the catalogue since.

    const unit = product.price.selling.amount;
    const mrp = product.price.mrp.amount;
    const quantity = Math.min(entry.quantity, Math.max(1, product.stockQuantity));

    subtotal += unit * quantity;
    savings += Math.max(0, mrp - unit) * quantity;
    itemCount += quantity;

    lines.push({
      id: `demo-line-${product.id}`,
      productId: product.id,
      // The demo store has no variants. Its product id stands in, which is
      // safe because nothing on this path reaches the API.
      variantId: product.defaultVariantId ?? product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.images[0]?.url ?? null,
      unitPrice: money(unit),
      unitMrp: money(mrp),
      quantity,
      lineTotal: money(unit * quantity),
      stockState: product.stockState,
      maxQuantity: product.stockQuantity,
      variantLabels: [],
    });
  }

  const coupon = stored.coupon ? COUPONS[stored.coupon] : undefined;
  const ruleDiscount = coupon
    ? Math.min((subtotal * coupon.percent) / 100, coupon.maxOff)
    : 0;

  const afterDiscount = subtotal - ruleDiscount;
  const shipping =
    lines.length === 0 || afterDiscount >= FREE_SHIPPING_THRESHOLD
      ? 0
      : SHIPPING_FEE;

  return {
    lines,
    subtotal: money(subtotal),
    savings: money(savings),
    shippingFee: money(shipping),
    ruleDiscount: money(ruleDiscount),
    total: money(afterDiscount + shipping),
    itemCount,
    appliedCouponCode: coupon ? stored.coupon : undefined,
  };
}

export const demoCart = {
  get(): Cart {
    if (typeof window === "undefined") return EMPTY_CART;
    return build(read());
  },

  addItem(productId: string, quantity: number): Cart {
    const stored = read();
    const existing = stored.lines.find((l) => l.productId === productId);
    const product = DEMO_PRODUCTS.find((p) => p.id === productId);

    if (!product) {
      throw new Error("That product is no longer available.");
    }
    if (product.stockState === "out-of-stock") {
      throw new Error("That piece is out of stock.");
    }

    const wanted = (existing?.quantity ?? 0) + quantity;
    if (wanted > product.stockQuantity) {
      // Mirrors the backend rule, which checks the running total rather than
      // the increment — so two adds of two cannot exceed three in stock.
      throw new Error(
        `Only ${product.stockQuantity} left in stock. You already have ${existing?.quantity ?? 0} in your cart.`,
      );
    }

    if (existing) existing.quantity = wanted;
    else stored.lines.push({ productId, quantity });

    write(stored);
    return build(stored);
  },

  updateItem(lineId: string, quantity: number): Cart {
    const stored = read();
    const productId = lineId.replace("demo-line-", "");

    if (quantity <= 0) {
      stored.lines = stored.lines.filter((l) => l.productId !== productId);
    } else {
      const line = stored.lines.find((l) => l.productId === productId);
      if (line) line.quantity = quantity;
    }

    write(stored);
    return build(stored);
  },

  removeItem(lineId: string): Cart {
    const stored = read();
    const productId = lineId.replace("demo-line-", "");
    stored.lines = stored.lines.filter((l) => l.productId !== productId);
    write(stored);
    return build(stored);
  },

  clear(): Cart {
    write({ lines: [] });
    return EMPTY_CART;
  },

  applyCoupon(code: string): Cart {
    const stored = read();
    const normalised = code.trim().toUpperCase();

    if (!COUPONS[normalised]) {
      throw new Error("That code is not valid.");
    }
    if (build(stored).lines.length === 0) {
      throw new Error("Add something to your cart before applying a code.");
    }

    stored.coupon = normalised;
    write(stored);
    return build(stored);
  },

  removeCoupon(): Cart {
    const stored = read();
    delete stored.coupon;
    write(stored);
    return build(stored);
  },
};

/** Shown on the cart so the demo codes are discoverable while reviewing. */
export const DEMO_COUPON_CODES = Object.entries(COUPONS).map(([code, c]) => ({
  code,
  label: c.label,
}));
