import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Homepage section frame.
 *
 * One component owns the vertical rhythm and heading hierarchy of every band
 * on the homepage, so sections cannot drift into thirteen slightly different
 * top margins — the thing that makes a long page feel assembled rather than
 * designed.
 *
 * Headings are h2: the page has exactly one h1, in the hero.
 */
export function HomeSection({
  eyebrow,
  title,
  description,
  action,
  children,
  bleed = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  /** Rails run to the viewport edge on mobile so cards can scroll off-screen. */
  bleed?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("py-(--space-section-sm) lg:py-(--space-section)", className)}>
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="max-w-2xl">
            {eyebrow ? (
              <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="mt-2.5 text-2xl lg:text-3xl">{title}</h2>
            {description ? (
              <p className="mt-3 max-w-prose text-ink-muted">{description}</p>
            ) : null}
          </div>

          {action ? (
            <Link
              href={action.href}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
            >
              {action.label}
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          ) : null}
        </div>
      </div>

      <div className={cn("mt-8 lg:mt-10", !bleed && "container-page")}>
        {children}
      </div>
    </section>
  );
}
