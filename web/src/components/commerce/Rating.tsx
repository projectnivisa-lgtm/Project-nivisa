import { cn } from "@/lib/utils";
import type { ProductRating } from "@/types/product";

/**
 * Star rating.
 *
 * The numeric average is shown alongside the stars rather than instead of
 * them: stars alone force the reader to count, and a screen reader gets a
 * single readable sentence from the label rather than five identical icons.
 */
export function Rating({
  rating,
  showCount = true,
  className,
}: {
  rating: ProductRating;
  showCount?: boolean;
  className?: string;
}) {
  const rounded = Math.round(rating.average * 10) / 10;
  const filled = Math.round(rating.average);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs", className)}
      aria-label={`Rated ${rounded} out of 5 from ${rating.count} reviews`}
    >
      <span aria-hidden="true" className="flex items-center gap-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            className={cn(
              "h-3.5 w-3.5",
              i <= filled ? "text-accent" : "text-lime-400",
            )}
            fill="currentColor"
          >
            <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z" />
          </svg>
        ))}
      </span>
      <span aria-hidden="true" className="font-medium tabular">
        {rounded.toFixed(1)}
      </span>
      {showCount ? (
        <span aria-hidden="true" className="text-ink-muted tabular">
          ({rating.count})
        </span>
      ) : null}
    </span>
  );
}
