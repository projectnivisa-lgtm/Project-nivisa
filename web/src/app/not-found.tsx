import Link from "next/link";
import { FALLBACK_ROOMS } from "@/config/navigation";

/**
 * 404.
 *
 * A retired product or a mistyped category is a routine event on a catalogue,
 * and the default framework page turns it into a dead end. This one does the
 * one useful thing: puts the customer back into the shop at the level they
 * were probably aiming for.
 *
 * Lives at the app root rather than inside the storefront group so it also
 * covers routes outside it — otherwise Next falls back to its own page.
 */
export default function NotFound() {
  return (
    <main id="main" className="container-page flex min-h-[70vh] flex-col justify-center py-20">
      <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">
        404
      </p>
      <h1 className="mt-4 max-w-2xl text-3xl lg:text-4xl">
        That page has moved out.
      </h1>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">
        The link may be out of date, or the piece it pointed to is no longer in
        the catalogue. Here is the way back in.
      </p>

      <div className="mt-9 flex flex-wrap gap-3">
        <Link
          href="/shop"
          className="inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Shop all furniture
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center rounded-sm border border-border-interactive px-7 text-sm font-medium transition-colors duration-fast hover:border-ink"
        >
          Back to home
        </Link>
      </div>

      <div className="mt-14 border-t border-border pt-8">
        <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          Or start with a room
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {FALLBACK_ROOMS.map((room) => (
            <li key={room.slug}>
              <Link
                href={room.href}
                className="inline-flex min-h-11 items-center rounded-sm border border-border bg-surface px-4 text-sm transition-colors duration-fast hover:border-ink"
              >
                {room.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
