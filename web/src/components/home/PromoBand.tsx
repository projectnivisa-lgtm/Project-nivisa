import Link from "next/link";

/**
 * Campaign band.
 *
 * The one place on the homepage that gets the inverse surface. Because it is
 * the only dark band above the footer, it reads as a deliberate pause in the
 * page rather than another card — which is what a campaign needs, and what a
 * fifth product rail cannot do.
 *
 * Copy states the actual offer terms inline. A campaign that makes the reader
 * click through to discover the conditions converts worse and annoys more.
 */
interface Cta {
  label: string;
  href: string;
}

/** Copy comes from the homepage's editorial band. */
export function PromoBand({
  eyebrow,
  title,
  body,
  cta,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  cta?: Cta;
}) {
  return (
    <section className="bg-surface-inverse text-ink-inverse">
      <div className="container-page grid items-center gap-10 py-(--space-section-sm) lg:grid-cols-[1.2fr_1fr] lg:py-(--space-section)">
        <div>
          {eyebrow ? (
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-clay-300">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-4 max-w-xl text-3xl lg:text-4xl">{title}</h2>
          {body ? (
            <p className="mt-5 max-w-md leading-relaxed text-lime-400">{body}</p>
          ) : null}
          {cta ? (
            <Link
              href={cta.href}
              className="mt-8 inline-flex min-h-12 items-center rounded-sm bg-canvas px-7 text-sm font-medium text-ink transition-colors duration-fast hover:bg-lime-200"
            >
              {cta.label}
            </Link>
          ) : null}
        </div>

        <div className="hidden lg:block">
          <svg
            viewBox="0 0 200 140"
            className="w-full"
            role="img"
            aria-label="Illustration of three furniture pieces grouped together"
          >
            <g
              fill="none"
              stroke="var(--color-lime-600)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 110h172" />
              {/* Sofa */}
              <path d="M28 110V88a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v22" />
              <path d="M38 110V94h36v16" />
              {/* Table */}
              <path d="M96 92h48v3M104 95v15M136 95v15" />
              {/* Lamp */}
              <path d="M158 110V64M150 64h20l-3-11h-14z" />
              <path d="M153 110h14" />
            </g>
            <g stroke="var(--color-clay-500)" strokeWidth="1.4" fill="none" strokeLinecap="round">
              <path d="M24 78h66M92 84h56M146 48h28" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}
