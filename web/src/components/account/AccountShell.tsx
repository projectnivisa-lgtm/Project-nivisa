"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

/**
 * Account area shell.
 *
 * A persistent side navigation on desktop, a horizontal scroll rail on mobile.
 * Not a drawer: the account section is small enough that hiding five links
 * behind a button costs more than it saves, and a visible rail also tells a
 * first-time visitor what the account area contains.
 *
 * Signed-out visitors get a sign-in prompt rather than a redirect. A redirect
 * loses the page they were trying to reach and, on a slow connection, flashes
 * an empty account area first.
 */

const LINKS = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wishlist", label: "Saved" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
];

export function AccountShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAuthenticated, customer, signOut } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="container-page py-20">
        <h1 className="text-3xl lg:text-4xl">Your account</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-muted">
          Sign in with your mobile number to see your orders, saved pieces and
          delivery addresses.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="mt-8 inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-8 lg:py-12">
      <header>
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">
          Your account
        </p>
        <h1 className="mt-2 text-3xl lg:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-prose text-ink-muted">{description}</p>
        ) : null}
      </header>

      <div className="mt-8 lg:grid lg:grid-cols-[14rem_1fr] lg:items-start lg:gap-12">
        <nav
          aria-label="Account"
          className="-mx-(--space-gutter) border-y border-border px-(--space-gutter) lg:mx-0 lg:border-0 lg:px-0"
        >
          <ul className="rail gap-1 py-2 lg:block lg:space-y-0.5 lg:overflow-visible lg:py-0">
            {LINKS.map((link) => {
              const isActive = link.exact
                ? pathname === link.href
                : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 text-sm transition-colors duration-fast lg:w-full",
                      isActive
                        ? "bg-surface-sunken font-medium text-ink"
                        : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="hidden border-t border-border pt-4 lg:mt-4 lg:block">
            <p className="px-3 text-xs text-ink-muted tabular">
              +91 {customer?.phone}
            </p>
            <button
              type="button"
              onClick={signOut}
              className="mt-1 flex min-h-11 w-full items-center rounded-sm px-3 text-sm text-ink-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-destructive"
            >
              Sign out
            </button>
          </div>
        </nav>

        <div className="mt-8 min-w-0 lg:mt-0">{children}</div>
      </div>

      {/* Sign-out is in the sidebar on desktop; on mobile it goes at the end,
          where a destructive action cannot be hit by accident while scanning
          the nav rail. */}
      <div className="mt-14 border-t border-border pt-6 lg:hidden">
        <p className="text-xs text-ink-muted tabular">+91 {customer?.phone}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-2 min-h-11 text-sm text-destructive underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
