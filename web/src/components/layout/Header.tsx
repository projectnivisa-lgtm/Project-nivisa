"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavSection } from "@/config/navigation";
import { MegaMenu } from "./MegaMenu";
import { SearchBar } from "./SearchBar";
import { MobileMenu } from "./MobileMenu";
import { useCart } from "@/hooks/useCart";

/**
 * Site header.
 *
 * Two rows on desktop — brand and utilities above, navigation below — so the
 * mega-menu has a clean edge to drop from and the logo is not competing with
 * eight category links for the same horizontal band.
 *
 * The mega-menu opens on hover for pointers and on click for everyone else.
 * Hover alone is not an interaction: it is unreachable by keyboard and does
 * not exist on touch. Both paths set the same state, and Escape closes.
 */
export function Header({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { cart } = useCart();
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close everything on navigation; a menu left open across a route change is
  // the most common way these become confusing. Adjusted during render rather
  // than in an effect — React re-runs this pass before painting, so the menu
  // never flashes open on the new page the way an effect would allow.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpenSection(null);
    setIsMobileOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenSection(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /** A short grace period so a diagonal mouse path to the panel does not close it. */
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpenSection(null), 120);
  }
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-border bg-canvas/95 backdrop-blur-sm"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
      // Tabbing out of the last panel link should close the panel behind you.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpenSection(null);
        }
      }}
    >
      {/* ------------------------------------------------------ Utility row */}
      <div className="container-page flex h-16 items-center gap-4 lg:h-20">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={isMobileOpen}
          className="-ml-2 flex h-11 w-11 items-center justify-center lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center font-display text-2xl font-semibold tracking-tight lg:text-[1.75rem]"
          aria-label="Nivisa — home"
        >
          Nivisa
        </Link>

        <SearchBar className="mx-auto hidden max-w-lg flex-1 lg:block" />

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <IconLink href="/account" label="Account" className="hidden sm:flex">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
          </IconLink>

          <IconLink href="/wishlist" label="Saved items">
            <path d="M12 20.5l-7.1-7a4.5 4.5 0 0 1 6.4-6.3l.7.7.7-.7a4.5 4.5 0 0 1 6.4 6.3z" />
          </IconLink>

          <IconLink
            href="/cart"
            label={`Cart, ${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}`}
            badge={cart.itemCount}
          >
            <path d="M4 5h2l2.2 10.4a2 2 0 0 0 2 1.6h6.9a2 2 0 0 0 2-1.5L21 8H6.5" />
            <circle cx="10" cy="20" r="1.3" />
            <circle cx="18" cy="20" r="1.3" />
          </IconLink>
        </div>
      </div>

      {/* --------------------------------------------------- Navigation row */}
      <nav
        aria-label="Main"
        className="hidden border-t border-border lg:block"
      >
        <div className="container-page">
          <ul className="flex items-center gap-1">
            {sections.map((section) => {
              const isOpen = openSection === section.label;
              const panelId = `megamenu-${section.label.toLowerCase()}`;
              const hasPanel = section.groups.length > 0;

              return (
                <li key={section.label}>
                  {hasPanel ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onMouseEnter={() => {
                        cancelClose();
                        setOpenSection(section.label);
                      }}
                      // No onFocus-to-open. Focus arrives before click, so
                      // opening here left the click handler toggling a panel
                      // that was already open — pressing Enter on a trigger
                      // opened and instantly closed it. Auto-opening on focus
                      // is also disorienting: a keyboard user tabbing past the
                      // nav would blow open four panels in a row. Enter opens,
                      // which is what a disclosure button is supposed to do.
                      onClick={() =>
                        setOpenSection((current) =>
                          current === section.label ? null : section.label,
                        )
                      }
                      className={cn(
                        "relative flex h-12 items-center px-3 text-sm transition-colors duration-fast",
                        "after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-ink after:transition-transform after:duration-fast",
                        isOpen
                          ? "text-ink after:scale-x-100"
                          : "text-ink-muted after:scale-x-0 hover:text-ink",
                      )}
                    >
                      {section.label}
                    </button>
                  ) : (
                    <Link
                      href={section.href}
                      onMouseEnter={() => setOpenSection(null)}
                      className="flex h-12 items-center px-3 text-sm text-accent transition-colors duration-fast hover:text-accent-hover"
                    >
                      {section.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {sections.map((section) => (
        <MegaMenu
          key={section.label}
          section={section}
          isOpen={openSection === section.label}
          id={`megamenu-${section.label.toLowerCase()}`}
        />
      ))}

      <MobileMenu
        sections={sections}
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      />
    </header>
  );
}

function IconLink({
  href,
  label,
  badge,
  children,
  className,
}: {
  href: string;
  label: string;
  badge?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-sm transition-colors duration-fast hover:bg-surface-sunken",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
      {badge && badge > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold leading-none text-on-accent tabular"
        >
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
