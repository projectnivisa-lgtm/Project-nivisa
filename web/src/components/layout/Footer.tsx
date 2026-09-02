import Link from "next/link";
import { loadStore } from "@/lib/contentSource";

/**
 * Footer.
 *
 * Dark band, generous rhythm, and grouped by what a customer actually comes
 * here looking for: how to reach a human, what happens after they order, and
 * the legal pages. Not a sitemap dump — the mega-menu already carries the
 * catalogue, and repeating it here helps nobody.
 */

const COLUMNS = [
  {
    heading: "Shop",
    links: [
      { label: "All furniture", href: "/shop" },
      { label: "Shop by room", href: "/rooms" },
      { label: "Collections", href: "/collections" },
      { label: "New this season", href: "/shop?sort=newest" },
    ],
  },
  {
    heading: "After you order",
    links: [
      // Slugs match the pages the API seeds. Every one of these resolves;
      // a footer link to a 404 is the kind of thing nobody notices until a
      // customer is looking for a returns policy.
      { label: "Track your order", href: "/orders" },
      { label: "Delivery & assembly", href: "/pages/shipping-delivery" },
      { label: "Returns & refunds", href: "/pages/returns-refunds" },
      { label: "Warranty", href: "/pages/warranty" },
      { label: "Care guide", href: "/pages/care-guide" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Nivisa", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy policy", href: "/pages/privacy-policy" },
      { label: "Terms of use", href: "/pages/terms-of-use" },
    ],
  },
];

export async function Footer() {
  // Contact details come from the shop's own settings, so changing the phone
  // number is a dashboard edit rather than a release. Null renders nothing
  // rather than a placeholder: a footer with no number is a gap, one with a
  // made-up number is a customer calling nobody.
  const store = await loadStore();

  return (
    <footer className="mt-(--space-section) bg-surface-inverse text-ink-inverse">
      <div className="container-page py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          {/* `min-w-0` because a grid item defaults to `min-width: auto`, and
              the email field below reports its intrinsic 20-character width as
              a minimum however hard it is told to shrink. That floor made this
              column 332px wide inside a 320px phone, which is why every page
              on the site — the footer is on all of them — scrolled sideways on
              a small handset. */}
          <div className="min-w-0">
            <p className="font-display text-3xl font-semibold">Nivisa</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-lime-400">
              Furniture and home pieces made for how Indian homes are actually
              lived in — measured for real rooms, delivered assembled, and built
              to still be here in ten years.
            </p>

            <form
              className="mt-8 max-w-sm"
              // Newsletter has no backend endpoint yet; wiring it to a
              // non-existent route would fail silently at the worst moment.
              // Left inert with an honest label until one exists.
              aria-describedby="newsletter-note"
            >
              <label
                htmlFor="newsletter-email"
                className="text-2xs font-semibold uppercase tracking-[0.14em] text-lime-500"
              >
                New arrivals, once a month
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="newsletter-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11 min-w-0 flex-1 rounded-sm border border-lime-800 bg-lime-900 px-3 text-sm text-ink-inverse placeholder:text-lime-500 focus:border-accent"
                />
                <button
                  type="submit"
                  disabled
                  className="h-11 shrink-0 rounded-sm bg-lime-800 px-5 text-sm text-lime-500"
                >
                  Subscribe
                </button>
              </div>
              <p id="newsletter-note" className="mt-2 text-2xs text-lime-600">
                Coming soon — sign-up opens with our next release.
              </p>
            </form>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <h2 className="font-sans text-2xs font-semibold uppercase tracking-[0.14em] text-lime-500">
                  {column.heading}
                </h2>
                <ul className="mt-4 space-y-1">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="flex min-h-11 items-center text-sm text-lime-300 transition-colors duration-fast hover:text-ink-inverse"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {(store?.phone || store?.email || store?.address) && (
          <div className="mt-12 grid gap-6 border-t border-lime-800 pt-8 text-sm sm:grid-cols-3">
            {store.phone && (
              <div>
                <h2 className="font-sans text-2xs font-semibold uppercase tracking-[0.14em] text-lime-500">
                  Call
                </h2>
                <a
                  href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
                  className="mt-2 flex min-h-11 items-center tabular text-lime-300 transition-colors duration-fast hover:text-ink-inverse"
                >
                  {store.phone}
                </a>
              </div>
            )}
            {store.email && (
              <div>
                <h2 className="font-sans text-2xs font-semibold uppercase tracking-[0.14em] text-lime-500">
                  Email
                </h2>
                <a
                  href={`mailto:${store.email}`}
                  className="mt-2 flex min-h-11 items-center text-lime-300 transition-colors duration-fast hover:text-ink-inverse"
                >
                  {store.email}
                </a>
              </div>
            )}
            {store.address && (
              <div>
                <h2 className="font-sans text-2xs font-semibold uppercase tracking-[0.14em] text-lime-500">
                  Visit
                </h2>
                <address className="mt-2 not-italic leading-relaxed text-lime-300">
                  {store.address}
                </address>
              </div>
            )}
          </div>
        )}

        <div className="mt-14 flex flex-col gap-4 border-t border-lime-800 pt-8 text-2xs text-lime-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {store?.name ?? "Nivisa"}. All rights reserved.
          </p>
          <p>Mon–Sat, 9am–7pm</p>
        </div>
      </div>
    </footer>
  );
}
