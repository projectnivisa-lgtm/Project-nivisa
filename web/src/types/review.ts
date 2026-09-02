/**
 * Reviews.
 *
 * The backend supports listing and submitting only. Photo reviews, helpful
 * votes and a server-side star aggregate do not exist (API-GAPS §8), so the
 * distribution below is computed from the fetched page — which is honest for a
 * product with a few dozen reviews and will need a backend aggregate once
 * counts grow past what one request returns.
 */

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string | null;
  /** True when the reviewer's order for this product is on record. */
  isVerifiedPurchase: boolean;
}

export interface ReviewSummary {
  average: number;
  total: number;
  /** Star -> count, computed from the reviews actually loaded. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function summariseReviews(reviews: Review[]): ReviewSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let sum = 0;
  for (const review of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
    sum += review.rating;
  }

  return {
    average: reviews.length ? sum / reviews.length : 0,
    total: reviews.length,
    distribution,
  };
}
