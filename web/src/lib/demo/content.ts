import type { ContentPage } from "@/types/content";

/**
 * DEMO CONTENT — NOT API DATA. See `lib/demo/catalogue.ts`.
 *
 * Policy copy for demo mode, so the footer links lead somewhere while working
 * with no API running. The live backend seeds its own equivalents.
 *
 * The text below is plain-English placeholder written for design review. It is
 * NOT legal advice and must be replaced by the operator's own reviewed
 * policies before this store takes a real order.
 */

const PAGES: Record<string, ContentPage> = {
  "terms-of-use": {
    slug: "terms-of-use",
    title: "Terms of use",
    html: `
      <h2>About these terms</h2>
      <p>These terms govern your use of this website and any order you place
      through it. By placing an order you accept them.</p>
      <h2>Placing an order</h2>
      <p>An order is an offer to buy. It is accepted when we confirm it by
      email, and until then we may decline it — most often because a piece has
      sold out between your adding it to the cart and paying for it.</p>
    `,
  },
  "privacy-policy": {
    slug: "privacy-policy",
    title: "Privacy policy",
    html: `
      <h2>What we collect</h2>
      <p>Your name, phone number, delivery address and order history. We need
      the phone number to sign you in and to call before a delivery truck
      arrives.</p>
      <h2>What we do not do</h2>
      <p>We do not sell your details, and we do not send marketing you have not
      asked for.</p>
    `,
  },
  "shipping-delivery": {
    slug: "shipping-delivery",
    title: "Shipping and delivery",
    html: `
      <h2>How long it takes</h2>
      <p>Most pieces are made to order and leave the workshop in three to five
      weeks. Your order page shows the estimate for your own PIN code.</p>
      <h2>What delivery includes</h2>
      <p>Our own team carries the piece in, assembles it, and takes the
      packaging away.</p>
    `,
  },
  "returns-refunds": {
    slug: "returns-refunds",
    title: "Returns and refunds",
    html: `
      <h2>Seven days</h2>
      <p>If a piece is not right, tell us within seven days of delivery and we
      will collect it and refund you.</p>
      <h2>What we cannot take back</h2>
      <p>Made-to-measure pieces built to dimensions you specified, unless they
      are faulty.</p>
    `,
  },
};

export function getDemoPage(slug: string): ContentPage | null {
  return PAGES[slug] ?? null;
}
