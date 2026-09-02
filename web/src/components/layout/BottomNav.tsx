"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";

/**
 * Mobile bottom navigation.
 *
 * Five destinations, thumb-reachable, with the safe-area inset respected so
 * the bar clears the home indicator on modern phones. Cart lives here rather
 * than in the header on mobile: it is the destination that matters most and
 * the one worst served by a 44px target in a top corner.
 *
 * Hidden on checkout — see the storefront layout for why.
 */

const ITEMS = [
  {
    label: "Home",
    href: "/",
    icon: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  },
  {
    label: "Shop",
    href: "/shop",
    icon: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </>
    ),
  },
  {
    label: "Saved",
    href: "/wishlist",
    icon: <path d="M12 20.5l-7.1-7a4.5 4.5 0 0 1 6.4-6.3l.7.7.7-.7a4.5 4.5 0 0 1 6.4 6.3z" />,
  },
  {
    label: "Cart",
    href: "/cart",
    icon: (
      <>
        <path d="M4 5h2l2.2 10.4a2 2 0 0 0 2 1.6h6.9a2 2 0 0 0 2-1.5L21 8H6.5" />
        <circle cx="10" cy="20" r="1.3" />
        <circle cx="18" cy="20" r="1.3" />
      </>
    ),
  },
  {
    label: "Account",
    href: "/account",
    icon: (
      <>
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
      </>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { cart } = useCart();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-canvas/97 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const badge = item.href === "/cart" ? cart.itemCount : 0;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem]",
                  isActive ? "text-ink" : "text-ink-muted",
                )}
              >
                <span className="relative">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={isActive ? 1.9 : 1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </svg>
                  {badge > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.5625rem] font-semibold leading-none text-on-accent tabular"
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
