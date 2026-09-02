import { DEMO_TESTIMONIALS, IS_DEMO_CONTENT } from "@/lib/demo";

/**
 * Customer reviews band.
 *
 * Quotes name the specific product they refer to. A five-star review of "the
 * company" is worth very little; a review of the sofa a shopper is considering
 * is worth a great deal, and naming the product is what makes it credible.
 *
 * There is no site-wide reviews endpoint — reviews are per-product only
 * (docs/API-GAPS.md §8) — so this band renders nothing unless demo content is
 * on. It does not invent quotes to fill space.
 */
export function Testimonials() {
  if (!IS_DEMO_CONTENT) return null;

  return (
    <ul className="grid gap-6 lg:grid-cols-3">
      {DEMO_TESTIMONIALS.map((review) => (
        <li
          key={review.name}
          className="flex flex-col rounded-sm border border-border bg-surface p-6"
        >
          <span
            className="flex gap-px"
            aria-label={`Rated ${review.rating} out of 5`}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <svg
                key={i}
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={
                  i <= review.rating ? "h-4 w-4 text-accent" : "h-4 w-4 text-lime-400"
                }
                fill="currentColor"
              >
                <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z" />
              </svg>
            ))}
          </span>

          <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink-muted">
            {review.quote}
          </blockquote>

          <footer className="mt-5 border-t border-border pt-4 text-xs">
            <p className="font-medium">
              {review.name} · {review.city}
            </p>
            <p className="mt-0.5 text-ink-muted">on {review.product}</p>
          </footer>
        </li>
      ))}
    </ul>
  );
}
