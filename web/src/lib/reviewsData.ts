import { catalogApi } from "@/api/catalog";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { getDemoReviews } from "@/lib/demo/reviews";
import type { Review } from "@/types/review";

/**
 * Review source.
 *
 * One branch point, so the Reviews component does not carry a demo-mode
 * conditional of its own. Client-safe: the demo flag is a NEXT_PUBLIC value.
 */
export function fetchReviews(productId: string): Promise<Review[]> {
  if (IS_DEMO_CONTENT) return Promise.resolve(getDemoReviews(productId));
  return catalogApi.listReviews(productId);
}

/** Whether review submission is wired. Demo mode has nowhere to post. */
export const CAN_SUBMIT_REVIEW = !IS_DEMO_CONTENT;
