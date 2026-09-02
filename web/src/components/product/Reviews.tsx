"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogApi } from "@/api/catalog";
import { fetchReviews } from "@/lib/reviewsData";
import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import { cn, formatDate } from "@/lib/utils";
import { surfaceState } from "@/lib/surfaceState";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import { summariseReviews } from "@/types/review";

/**
 * Reviews.
 *
 * Client-side rather than server-rendered: reviews are the one part of the
 * page that changes between visits, and they carry a form. The rest of the
 * page is in the HTML for crawlers, which is where the SEO value sits.
 *
 * The star distribution is computed from the reviews actually fetched — the
 * backend has no aggregate (API-GAPS §8). That is accurate for a product with
 * tens of reviews and will need a server-side aggregate before it has hundreds.
 */
export function Reviews({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const queryClient = useQueryClient();
  const isAuthenticated = authApi.isAuthenticated();

  const query = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => fetchReviews(productId),
  });

  const reviews = query.data ?? [];
  const state = surfaceState(query, reviews.length === 0);
  const summary = summariseReviews(reviews);

  return (
    <section aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-2xl">
        Reviews
      </h2>

      {state === "loading" ? (
        <div className="mt-6 space-y-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-sm border border-border p-5">
              <div className="skeleton h-3.5 w-28 rounded-xs" />
              <div className="skeleton mt-3 h-3 w-full rounded-xs" />
              <div className="skeleton mt-2 h-3 w-2/3 rounded-xs" />
            </div>
          ))}
        </div>
      ) : state === "error" || state === "offline" ? (
        <SurfaceMessage
          kind={state}
          onRetry={() => query.refetch()}
          className="mt-6"
        />
      ) : (
        <div className="mt-6 grid gap-10 lg:grid-cols-[18rem_1fr]">
          <div>
            {reviews.length > 0 ? (
              <>
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-semibold tabular">
                    {summary.average.toFixed(1)}
                  </span>
                  <span className="text-sm text-ink-muted">out of 5</span>
                </p>
                <p className="mt-1 text-xs text-ink-muted tabular">
                  {summary.total} {summary.total === 1 ? "review" : "reviews"}
                </p>

                <ul className="mt-5 space-y-1.5">
                  {([5, 4, 3, 2, 1] as const).map((star) => {
                    const count = summary.distribution[star];
                    const pct = summary.total
                      ? Math.round((count / summary.total) * 100)
                      : 0;
                    return (
                      <li key={star} className="flex items-center gap-3 text-xs">
                        <span className="w-10 shrink-0 tabular">{star} star</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        {/* The count, not just the bar — a bar alone cannot
                            be read by anyone using a screen reader. */}
                        <span className="w-8 shrink-0 text-right text-ink-muted tabular">
                          {count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            <ReviewForm
              productId={productId}
              productName={productName}
              isAuthenticated={isAuthenticated}
              onSubmitted={() =>
                queryClient.invalidateQueries({ queryKey: ["reviews", productId] })
              }
            />
          </div>

          <div>
            {reviews.length === 0 ? (
              <div className="rounded-sm border border-border bg-surface px-6 py-12 text-center">
                <p className="text-sm font-medium">No reviews yet</p>
                <p className="mx-auto mt-1.5 max-w-sm text-xs text-ink-muted">
                  If you have bought this piece, yours would be the first — and
                  the most useful one anyone reads.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {reviews.map((review) => (
                  <li key={review.id} className="py-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={review.rating} />
                      <span className="text-sm font-medium">
                        {review.authorName}
                      </span>
                      {review.isVerifiedPurchase ? (
                        <span className="rounded-xs bg-success-soft px-2 py-0.5 text-2xs text-success">
                          Verified purchase
                        </span>
                      ) : null}
                      <span className="text-xs text-ink-subtle">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="mt-2.5 max-w-prose leading-relaxed text-ink-muted">
                        {review.comment}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span
      className="flex items-center gap-px"
      aria-label={`${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={cn("h-3.5 w-3.5", i <= filled ? "text-accent" : "text-lime-400")}
          fill="currentColor"
        >
          <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Review submission.
 *
 * Requires authentication, so signed-out visitors get a sign-in prompt rather
 * than a form that 401s after they have typed a paragraph.
 */
function ReviewForm({
  productId,
  productName,
  isAuthenticated,
  onSubmitted,
}: {
  productId: string;
  productName: string;
  isAuthenticated: boolean;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const submit = useMutation({
    mutationFn: () => catalogApi.submitReview(productId, { rating, comment }),
    onSuccess: () => {
      setIsDone(true);
      setComment("");
      setRating(0);
      onSubmitted();
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We could not post your review. Please try again.",
      );
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="mt-8 rounded-sm border border-border bg-surface p-5">
        <p className="text-sm font-medium">Bought this piece?</p>
        <p className="mt-1 text-xs text-ink-muted">
          Sign in to leave a review.
        </p>
        <a
          href={`/login?next=/product/${productId}`}
          className="mt-4 inline-flex min-h-11 items-center rounded-sm border border-border-interactive px-5 text-sm transition-colors duration-fast hover:border-ink"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (isDone) {
    return (
      <div
        role="status"
        className="mt-8 rounded-sm bg-success-soft p-5 text-sm text-success"
      >
        Thank you — your review has been posted.
      </div>
    );
  }

  return (
    <form
      className="mt-8 rounded-sm border border-border bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (rating < 1) {
          setError("Choose a star rating first.");
          return;
        }
        submit.mutate();
      }}
    >
      <fieldset>
        <legend className="text-sm font-medium">Write a review</legend>
        <div className="mt-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
              aria-pressed={rating === star}
              className="flex h-11 w-9 items-center justify-center"
            >
              <svg
                viewBox="0 0 20 20"
                className={cn(
                  "h-6 w-6 transition-colors duration-fast",
                  star <= rating ? "text-accent" : "text-lime-400",
                )}
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z" />
              </svg>
            </button>
          ))}
        </div>
      </fieldset>

      <label htmlFor="review-comment" className="mt-4 block text-xs text-ink-muted">
        What should other people know about {productName}?
      </label>
      <textarea
        id="review-comment"
        rows={4}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={1000}
        className="mt-1.5 w-full rounded-sm border border-border-interactive bg-canvas p-3 text-sm focus:border-accent"
      />

      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submit.isPending}
        className="mt-3 inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
      >
        {submit.isPending ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
