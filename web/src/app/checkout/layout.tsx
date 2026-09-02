import type { Metadata } from "next";
import Link from "next/link";

/**
 * Checkout shell.
 *
 * Deliberately outside the storefront layout: no mega-menu, no bottom
 * navigation, no footer sitemap. Every link out of a checkout is an
 * opportunity to abandon a nearly-complete order, so the only navigation here
 * is back to the cart and the logo home.
 *
 * The trust line is in the chrome rather than buried beside the pay button —
 * it is doing its work while the customer is typing an address, not after.
 */
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border">
        <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-20">
          <Link
            href="/"
            className="flex min-h-11 items-center font-display text-2xl font-semibold tracking-tight"
          >
            Nivisa
          </Link>

          <p className="hidden items-center gap-2 text-xs text-ink-muted sm:flex">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-success"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Secure checkout
          </p>

          <Link
            href="/cart"
            className="flex min-h-11 items-center text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Back to cart
          </Link>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="border-t border-border">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 py-6 text-2xs text-ink-muted">
          <p>© {new Date().getFullYear()} Nivisa</p>
          <p>Questions? Call +91 80 2216 1900, Mon–Sat 9am–7pm</p>
        </div>
      </footer>
    </div>
  );
}
