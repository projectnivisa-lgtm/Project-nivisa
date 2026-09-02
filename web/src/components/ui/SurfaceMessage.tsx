import { cn } from "@/lib/utils";
import { SURFACE_COPY } from "@/lib/surfaceState";

/**
 * The failure state for a section of a page.
 *
 * Deliberately understated: one section failing is not a page-level
 * catastrophe, and a red alert box for a category rail that did not load
 * teaches customers to distrust the whole site. It says what happened, notes
 * that the rest of the page is fine, and offers the one useful action.
 */
export function SurfaceMessage({
  kind,
  onRetry,
  className,
}: {
  kind: "offline" | "error";
  onRetry?: () => void;
  className?: string;
}) {
  const copy = SURFACE_COPY[kind];

  return (
    <div
      role="status"
      className={cn(
        "rounded-sm border border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium">{copy.title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs text-ink-muted">
        {copy.body}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-11 items-center rounded-sm border border-border-interactive px-5 text-sm transition-colors duration-fast hover:border-ink"
        >
          {copy.action}
        </button>
      ) : null}
    </div>
  );
}
