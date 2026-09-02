import Link from "next/link";

import { STOCK, stockSrcSet } from "@/config/stockImages";

/**
 * Homepage hero.
 *
 * An asymmetric split rather than a full-bleed photo with centred text over
 * it. Text laid over an image is the single most common contrast failure on
 * retail homepages — the copy passes on the mockup and fails on the shot that
 * replaces it. Beside the image instead, the copy is legible whatever
 * photograph lands there.
 *
 * The proposition is specific rather than aspirational. "Make space for
 * better living" says nothing a competitor could not say; a measurement and a
 * delivery promise say something a customer can act on.
 *
 * The `hero-compact` hook and the `hero-*` class names are read by a short
 * viewport rule in globals.css: under 720px of screen height the hero steps
 * down a type size and tightens its own rhythm, because banners and a two-row
 * header eat 200px before the hero starts and the buttons were landing below
 * the fold. The rule lives in CSS rather than here because Tailwind has no
 * height variant, and five arbitrary `[@media(height<=45rem)]:` prefixes would
 * be far harder to read than one commented block.
 */
interface Cta {
  label: string;
  href: string;
}

/**
 * Copy comes from the homepage band the dashboard edits. The defaults below
 * are what a shop that has not written its own yet gets — they are not a
 * second source of truth, only a floor, so the page is never headline-less.
 */
export function Hero({
  eyebrow = "Measured for Indian homes",
  title = "Furniture that fits the room you actually have.",
  lede,
  primaryCta = { label: "Shop all furniture", href: "/shop" },
  secondaryCta,
  stats = [],
}: {
  eyebrow?: string;
  title?: string;
  lede?: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  stats?: Array<{ value: string; label: string }>;
}) {
  return (
    <section className="hero-compact border-b border-border bg-canvas">
      <div className="container-page grid items-center gap-10 py-(--space-section-sm) lg:grid-cols-2 lg:items-stretch lg:gap-16 lg:py-(--space-section)">
        <div className="max-w-xl">
          {eyebrow ? (
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-5 text-4xl lg:text-5xl">{title}</h1>
          {lede ? (
            <p className="hero-lede mt-6 max-w-md text-lg leading-relaxed text-ink-muted">
              {lede}
            </p>
          ) : null}

          <div className="hero-actions mt-9 flex flex-wrap gap-3">
            {primaryCta ? (
              <Link
                href={primaryCta.href}
                className="inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
              >
                {primaryCta.label}
              </Link>
            ) : null}
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                className="inline-flex min-h-12 items-center rounded-sm border border-border-interactive px-7 text-sm font-medium transition-colors duration-fast hover:border-ink"
              >
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>

          {/* The stats band disappears entirely when unset, rather than
              collapsing to an empty rule the eye reads as a mistake. */}
          {stats.length > 0 ? (
          <dl className="hero-stats mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-7">
            {stats.map(({ value, label }) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block font-display text-xl font-semibold tabular">
                    {value}
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    {label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          ) : null}
        </div>

        {/* A furnished room, beside the proposition rather than under it.
            Stand-in photography (see `config/stockImages.ts`): it shows a
            room, not a Nivisa product, which is why nothing in the copy
            claims otherwise and the alt text describes the photograph.

            From `lg` the frame drops its ratio and takes the height of the
            text column beside it. Two reasons: a fixed ratio left the image
            shorter than the copy at every desktop width, so the split read as
            lopsided; and a ratio-driven frame could grow taller than the text
            and set the section height on its own, which is what pushed the
            hero past the fold on a short screen. Height now comes from the
            column that carries the proposition, and the image fills it.

            No layout shift either way — the height is settled by text layout,
            which happens before the image loads. Below `lg` the frame keeps
            `aspect-4/3`, because stacked it has no neighbour to take a height
            from. */}
        <div className="hero-media relative aspect-4/3 overflow-hidden rounded-sm bg-surface-sunken lg:aspect-auto lg:h-full">
          {/* Absolutely positioned so it contributes no intrinsic height:
              left in flow, the image's own ratio would set the row height
              instead of taking it. `object-cover` crops to whatever shape the
              text column ends up being.

              A plain <img> rather than next/image, for the same reason the
              product images use one — the hosts that serve this are
              configured per environment, and an unconfigured host makes
              next/image throw at request time. It is `eager` because it is
              the largest thing above the fold. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={STOCK.hero}
            srcSet={stockSrcSet(STOCK.hero)}
            // Half the page beside the copy on desktop, full width stacked.
            sizes="(max-width: 1024px) 100vw, 50vw"
            alt="A furnished living room: sofa, armchairs and a low table on a pale rug"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
