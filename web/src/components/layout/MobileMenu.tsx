"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavSection } from "@/config/navigation";
import { useIsMounted } from "@/hooks/useIsMounted";
import { SearchBar } from "./SearchBar";

/**
 * Mobile navigation drawer.
 *
 * An accordion rather than a drill-down stack. Drill-downs look tidier but
 * cost a tap and an animation to discover what is inside a section, and the
 * back gesture then competes with browser back. An accordion shows structure
 * in place and keeps the browser's back button meaning "previous page".
 *
 * Focus is trapped while open and returned to the trigger on close, and the
 * body is locked so the page behind does not scroll under the drawer.
 *
 * Rendered through a portal to `document.body`, NOT in place inside the
 * header. The header carries `backdrop-blur`, and `backdrop-filter` makes an
 * element a containing block for `position: fixed` descendants — so rendered
 * in place, this drawer and its overlay were sized against the 64px header
 * box rather than the viewport. The portal is the fix, and the reason it
 * cannot be removed.
 */
export function MobileMenu({
  sections,
  isOpen,
  onClose,
}: {
  sections: NavSection[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const isMounted = useIsMounted();
  const [expanded, setExpanded] = useState<string | null>(sections[0]?.label ?? null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    // Captured now: by cleanup time React may have detached the node, and the
    // ref would read null just when the trap needs to release focus.
    const panel = panelRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Move focus into the drawer so the next Tab lands inside it rather than
    // continuing through the page underneath.
    panelRef.current?.querySelector<HTMLElement>("a, button, input")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;

      // Return focus to whatever opened the drawer. If that is gone — or was
      // never focused, which happens when the drawer is opened by script —
      // blur instead, so focus is not stranded inside a container that is
      // about to become aria-hidden.
      const target = previouslyFocused.current;
      if (target && target !== document.body && target.isConnected) {
        target.focus();
      } else if (panel?.contains(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
      }
    };
  }, [isOpen, onClose]);

  if (!isMounted) return null;

  return createPortal(
    <div
      className={cn("lg:hidden", !isOpen && "pointer-events-none")}
      aria-hidden={!isOpen}
    >
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-ink/40 transition-opacity duration-slow",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(88vw,22rem)] flex-col bg-canvas shadow-pop",
          "transition-transform duration-slow ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <span className="font-display text-xl font-semibold">Nivisa</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2 flex h-11 w-11 items-center justify-center"
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
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="border-b border-border p-5">
          <SearchBar />
        </div>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto p-5">
          <ul className="space-y-1">
            {sections.map((section) => {
              const hasPanel = section.groups.length > 0;
              const isExpanded = expanded === section.label;

              if (!hasPanel) {
                return (
                  <li key={section.label}>
                    <Link
                      href={section.href}
                      className="flex min-h-12 items-center text-base font-medium text-accent"
                    >
                      {section.label}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={section.label} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpanded(isExpanded ? null : section.label)}
                    className="flex min-h-12 w-full items-center justify-between text-base font-medium"
                  >
                    {section.label}
                    <svg
                      viewBox="0 0 24 24"
                      className={cn(
                        "h-4 w-4 text-ink-subtle transition-transform duration-fast",
                        isExpanded && "rotate-180",
                      )}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {isExpanded ? (
                    <div className="pb-3">
                      {section.groups.map((group) => (
                        <div key={group.label} className="mb-4 last:mb-0">
                          {/* Paragraph rather than heading — see MegaMenu. */}
                          <p
                            id={`m-nav-${group.label}`.toLowerCase().replace(/\s+/g, "-")}
                            className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle"
                          >
                            {group.label}
                          </p>
                          <ul
                            aria-labelledby={`m-nav-${group.label}`.toLowerCase().replace(/\s+/g, "-")}
                            className="mt-1"
                          >
                            {group.items.map((item) => (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  className="flex min-h-11 items-center text-sm text-ink-muted"
                                >
                                  {item.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-5">
          <Link
            href="/account"
            className="flex min-h-12 items-center justify-center rounded-sm bg-primary px-6 text-sm text-on-primary"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
