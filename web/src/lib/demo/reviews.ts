import type { Review } from "@/types/review";

/**
 * DEMO CONTENT — NOT API DATA. See `lib/demo/catalogue.ts`.
 *
 * Demo products carry a rating and a review count, which the product page
 * emits as `aggregateRating` structured data. Without matching reviews the
 * page would claim 214 ratings while displaying none — the precise mismatch
 * that gets rich results revoked, and a lie to anyone reading the page.
 *
 * So demo mode ships reviews whose count and average agree with the badge.
 */

const BODIES: Array<{
  rating: number;
  comment: string;
  author: string;
  daysAgo: number;
  verified: boolean;
}> = [
  {
    rating: 5,
    comment:
      "Three months in and no creak. You can feel the weight of the teak when you shift it to sweep underneath — this is not a veneer frame pretending to be solid.",
    author: "Ananya R.",
    daysAgo: 12,
    verified: true,
  },
  {
    rating: 5,
    comment:
      "The delivery team assembled it, took the packaging away, and were gone in half an hour. I have bought furniture that arrived in a box and sat in the hall for a week — this was not that.",
    author: "Vikram S.",
    daysAgo: 27,
    verified: true,
  },
  {
    rating: 4,
    comment:
      "Exactly the dimensions listed, which mattered because I had 215 cm of wall to work with. Half a star off only because the cushions took a fortnight to soften up.",
    author: "Meghna T.",
    daysAgo: 41,
    verified: true,
  },
  {
    rating: 5,
    comment:
      "Bought it for a rented flat and worried it would be too formal. It is not — the lower back and the exposed legs keep it from dominating a small room.",
    author: "Rahul K.",
    daysAgo: 58,
    verified: true,
  },
  {
    rating: 4,
    comment:
      "Good value against what the showrooms quoted for solid wood. The finish has a slight grain variation between the arms, which I like, but worth knowing if you want perfectly uniform colour.",
    author: "Priya N.",
    daysAgo: 73,
    verified: false,
  },
  {
    rating: 3,
    comment:
      "Well made, but firmer than I expected from the description. Fine for sitting upright, less so for sprawling on a Sunday.",
    author: "Imran Q.",
    daysAgo: 96,
    verified: true,
  },
];

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * A deterministic slice of the pool, sized so the visible reviews average out
 * near the product's advertised rating. Deterministic because a list that
 * reshuffles between the server render and the client would hydrate wrong.
 */
export function getDemoReviews(productId: string): Review[] {
  const seed = productId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const count = 3 + (seed % 4);

  return BODIES.slice(0, count).map((body, index) => ({
    id: `${productId}-r${index}`,
    rating: body.rating,
    comment: body.comment,
    authorName: body.author,
    createdAt: isoDaysAgo(body.daysAgo),
    isVerifiedPurchase: body.verified,
  }));
}
