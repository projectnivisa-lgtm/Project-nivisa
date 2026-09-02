import Link from "next/link";
import type { BannerBand as BannerBandData } from "@/lib/homeSource";
import { stockSrcSet } from "@/config/stockImages";

/**
 * A merchandised banner.
 *
 * The API has always sent this band and the dashboard has always been able to
 * schedule one, but the homepage had no case for it — so a banner added by a
 * merchandiser rendered as an empty div and looked, from the dashboard, like
 * the save had silently failed.
 *
 * Deliberately a plain `<picture>` rather than next/image: the banner is the
 * largest image on the page and the one most likely to be swapped for a
 * campaign at short notice, and the art direction between the wide and tall
 * crops is a different drawing, not the same file resized. `<picture>` lets
 * the browser pick before layout, and it does not care whether the file is an
 * SVG illustration today or a photograph next week.
 */
export function BannerBand({ banners }: { banners: BannerBandData["banners"] }) {
  return (
    <section className="py-(--space-section-sm) lg:py-(--space-section)">
      <div className="mx-auto max-w-(--container-page) px-(--space-gutter) lg:px-(--space-gutter-lg)">
        {banners.map((banner, index) => {
          const media = (
            <picture>
              {banner.mobile_image_url ? (
                <source
                  media="(max-width: 767px)"
                  srcSet={stockSrcSet(banner.mobile_image_url) ?? banner.mobile_image_url}
                  sizes="100vw"
                />
              ) : null}
              <img
                src={banner.image_url}
                srcSet={stockSrcSet(banner.image_url)}
                // Edge to edge inside the page container at every width.
                sizes="100vw"
                alt={banner.alt_text}
                /* The first banner is usually the largest thing above the
                   fold, so it is worth fetching early; later ones are not. */
                loading={index === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover"
              />
            </picture>
          );

          const body = (
            <div className="relative overflow-hidden rounded-sm bg-surface">
              <div className="aspect-4/3 w-full md:aspect-21/9">{media}</div>
              {/* The scrim stops around two-thirds up rather than covering the
                  whole frame. Over a full height it greyed out the artwork it
                  was meant to sit on, while still leaving the subtitle short of
                  contrast at the bottom — darkening everything and helping
                  nothing. */}
              {banner.title ? (
                <div className="absolute inset-0 flex flex-col justify-end gap-2 bg-linear-to-t from-ink/85 from-0% via-ink/45 via-30% to-transparent to-68% p-6 lg:p-10">
                  <h2 className="max-w-lg text-2xl text-canvas lg:text-3xl">{banner.title}</h2>
                  {banner.subtitle ? (
                    <p className="max-w-md text-sm leading-relaxed text-canvas/90">
                      {banner.subtitle}
                    </p>
                  ) : null}
                  {banner.cta_label ? (
                    <span className="mt-3 inline-flex min-h-11 w-fit items-center rounded-sm bg-canvas px-6 text-sm font-medium text-ink">
                      {banner.cta_label}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );

          // A banner with no link is an image, not a control — wrapping it in
          // an anchor to nowhere would put a pointer cursor on something that
          // does not respond.
          return banner.link_url ? (
            <Link
              key={index}
              href={banner.link_url}
              className="group mt-6 block first:mt-0"
              /* The banner's own copy already says where this goes; the CTA
                 label is the accessible name so it is not announced twice. */
              aria-label={banner.cta_label ?? banner.title}
            >
              {body}
            </Link>
          ) : (
            <div key={index} className="mt-6 first:mt-0">
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
