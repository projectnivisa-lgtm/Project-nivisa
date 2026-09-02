/**
 * A page body, typeset by the design system.
 *
 * The HTML comes from the API already sanitised — a strict tag and attribute
 * allowlist applied when a page is SAVED, in the dashboard's content routes.
 * That is what makes rendering it here safe: sanitising on write means there
 * is one place responsible for it, and no path by which unsanitised markup
 * reaches the database in the first place. Do not relax that and rely on this
 * component to compensate.
 *
 * Measure is capped at `--container-prose` (68ch). Policy text set the full
 * width of a 1440px viewport is unreadable regardless of how good the type is.
 */
export function Prose({ html }: { html: string }) {
  if (!html.trim()) {
    return <p className="text-ink-muted">This page has no content yet.</p>;
  }

  return (
    <div
      className="prose-page max-w-(--container-prose) leading-relaxed text-ink-muted"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
