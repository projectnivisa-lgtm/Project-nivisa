/**
 * Why buy here.
 *
 * Placed after the first product rails, not before: trust signals persuade a
 * shopper who has already found something they like, and shown too early they
 * are just claims about a company nobody has a reason to care about yet.
 *
 * Each item names a specific, checkable commitment. "Great quality" is not a
 * trust signal; "we name the wood and the joint" is.
 */

const ICONS: Record<string, React.ReactNode> = {
  material: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20V9l5-4 5 4v11" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  measure: (
    <>
      <path d="M3 8h18v8H3z" />
      <path d="M7 8v4M11 8v3M15 8v4M19 8v3" />
    </>
  ),
  delivery: (
    <>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  warranty: (
    <>
      <path d="M12 3l8 3v6c0 4-3.4 7.4-8 9-4.6-1.6-8-5-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};

export interface Pillar {
  icon: string;
  title: string;
  body: string;
}

/**
 * The promises the shop makes, edited on the Homepage screen.
 *
 * The words are content; the icons are not. A merchandiser rewriting a
 * promise should not have to draw an SVG, so `icon` is a key into the set
 * above and an unknown key simply renders no mark rather than a broken one.
 */
export function TrustBand({
  title = "The parts of furniture shopping that usually go wrong.",
  pillars,
}: {
  title?: string;
  pillars: Pillar[];
}) {
  if (pillars.length === 0) return null;

  return (
    <section className="border-y border-border bg-surface">
      <div className="container-page py-(--space-section-sm) lg:py-(--space-section)">
        <h2 className="max-w-xl text-2xl lg:text-3xl">{title}</h2>

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <li key={pillar.title}>
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[pillar.icon] ?? null}
              </svg>
              <h3 className="mt-4 font-sans text-base font-medium tracking-normal">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {pillar.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
