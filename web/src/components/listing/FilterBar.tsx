"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useIsMounted } from "@/hooks/useIsMounted";
import { FilterControls } from "./FilterControls";
import { SortSelect } from "./SortSelect";
import type { Category } from "@/api/catalog";
import type { ProductFilters } from "@/types/product";

/**
 * Mobile filter and sort bar.
 *
 * Sticky, because on a phone the controls are otherwise stranded above a grid
 * the customer has already scrolled past — and "scroll back up to change your
 * mind" is where narrowing gets abandoned. It sticks below the header rather
 * than at the bottom so it does not collide with the bottom navigation.
 *
 * The count of applied filters sits on the button. Without it the drawer is
 * the only way to find out what is currently narrowing the results, which is
 * exactly the information needed to decide whether to open it.
 *
 * Portalled for the same reason as the mobile menu: the sticky header carries
 * `backdrop-blur`, which would otherwise become the containing block for the
 * fixed drawer. See components/layout/MobileMenu.tsx.
 */
export function FilterBar({
  filters,
  categories,
  activeCount,
  total,
}: {
  filters: ProductFilters;
  categories: Category[];
  activeCount: number;
  total: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isMounted = useIsMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    // Captured now, for the same reason as `panel`: by cleanup time React may
    // have detached the node and the ref would read null just when focus needs
    // returning to the button that opened this.
    const trigger = triggerRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLElement>("button, input, summary")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, summary, [tabindex]:not([tabindex="-1"])',
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
      trigger?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <div className="sticky top-16 z-30 -mx-(--space-gutter) border-y border-border bg-canvas/97 px-(--space-gutter) py-2.5 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-3">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen(true)}
            aria-expanded={isOpen}
            // Without this the count badge concatenates into the accessible
            // name and the button announces as "Filter 1", which reads as a
            // label rather than a quantity.
            aria-label={
              activeCount > 0
                ? `Filter, ${activeCount} applied`
                : "Filter products"
            }
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm border border-border-interactive text-sm transition-colors duration-fast hover:border-ink"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filter
            {activeCount > 0 ? (
              <span
                aria-hidden="true"
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.625rem] font-semibold text-on-primary tabular"
              >
                {activeCount}
              </span>
            ) : null}
          </button>

          <div className="flex-1">
            <SortSelect value={filters.sort ?? "newest"} />
          </div>
        </div>
      </div>

      {isMounted && isOpen
        ? createPortal(
            <div className="lg:hidden">
              <div
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 z-50 bg-ink/40"
              />
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filter products"
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-lg bg-canvas",
                  "shadow-sheet",
                )}
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="font-sans text-base font-medium tracking-normal">
                    Filter
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close filters"
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

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <FilterControls
                    filters={filters}
                    categories={categories}
                    onNavigate={() => setIsOpen(false)}
                  />
                </div>

                <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="min-h-12 w-full rounded-sm bg-primary text-sm font-medium text-on-primary"
                  >
                    {/* The count is the point of this button: it confirms the
                        filter did something before the drawer closes over the
                        grid that would otherwise show it. */}
                    Show {total} {total === 1 ? "piece" : "pieces"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
