"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/commerce/ProductImage";
import type { NavGroup, NavSection } from "@/config/navigation";

/**
 * Mega-menu panel.
 *
 * The panel is full-bleed, so its layout has to earn that width. Three of
 * them, picked by how much the section actually contains — a menu that lays
 * six rooms in one narrow column and leaves two thirds of a 1600px panel
 * blank reads as a rendering fault, not as restraint:
 *
 *  - **Several groups** — real columns with group labels. A furniture
 *    catalogue has too many entry points for a plain dropdown, and grouping is
 *    what lets a shopper scan for "Wardrobes" without reading forty links.
 *  - **One group, and every link has a picture** (Rooms, and Collections when
 *    materials are absent) — tiles across the width. A room is a place, and a
 *    photograph of one is a better target than the word "Bedroom".
 *  - **One group, no pictures** — the links spread across the width as a grid
 *    rather than stacking into a column beside empty space.
 *
 * The editorial card on the right gives merchandising somewhere to push a
 * collection without turning the menu into an advertisement.
 *
 * Opening is handled by the parent, which owns focus and dismissal.
 */
export function MegaMenu({
  section,
  isOpen,
  id,
}: {
  section: NavSection;
  isOpen: boolean;
  id: string;
}) {
  if (section.groups.length === 0) return null;

  // One group is the case that used to leave the panel mostly empty: the
  // items are what fills the width, so they are laid out across it instead of
  // being nested one column deep inside it.
  const single = section.groups.length === 1 ? section.groups[0] : null;
  const asTiles =
    single !== null && single.items.length >= 3 && single.items.every((i) => i.imageUrl);

  return (
    <div
      id={id}
      // Kept mounted and hidden so the browser can restore scroll and so the
      // panel does not re-layout on every open, which caused a visible jump.
      hidden={!isOpen}
      className={cn(
        "absolute inset-x-0 top-full z-30 border-t border-border bg-surface",
        "shadow-pop",
      )}
    >
      <div className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_auto]">
        {asTiles && single ? (
          <TileRow group={single} isOpen={isOpen} />
        ) : single ? (
          <SpreadList group={single} sectionLabel={section.label} />
        ) : (
        <div
          className={cn(
            "grid gap-x-10 gap-y-8",
            // Two groups get column-width tracks rather than half a panel
            // each: a 630px-wide column holding the word "Bestsellers" is the
            // same empty space, moved. The card beside them takes the rest.
            section.groups.length > 2
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : "sm:grid-cols-2 sm:[&>*]:max-w-xs",
          )}
        >
          {section.groups.map((group) => (
            <div key={group.label}>
              {/* A paragraph, not a heading. These label navigation groups;
                  as headings they would inject h3s into the document outline
                  ahead of the page's own h1, so a screen-reader user browsing
                  by heading would meet "Seating" before the page title. The
                  list is named by it instead. */}
              <p
                id={`nav-${section.label}-${group.label}`.toLowerCase().replace(/\s+/g, "-")}
                className="font-sans text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle"
              >
                {group.label}
              </p>
              <ul
                aria-labelledby={`nav-${section.label}-${group.label}`.toLowerCase().replace(/\s+/g, "-")}
                className="mt-4 space-y-1"
              >
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="-mx-2 block rounded-sm px-2 py-2 text-sm text-ink-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        )}

        {/* The trigger is a disclosure button, so the section landing page
            needs a route of its own from inside the panel. */}
        {section.feature ? (
          <Link
            href={section.feature.href}
            className="group hidden w-72 shrink-0 lg:block"
          >
            <ProductImage
              src={section.feature.imageUrl ?? null}
              alt={section.feature.title}
              art={section.feature.art}
              aspect="aspect-3/2"
              sizes="288px"
              // See the note on the tiles: lazy inside a hidden panel can
              // stick.
              priority={isOpen}
              className="transition-shadow duration-slow group-hover:shadow-card"
            />
            <p className="mt-3 text-2xs font-semibold uppercase tracking-[0.14em] text-accent">
              {section.feature.eyebrow}
            </p>
            <p className="mt-1.5 font-display text-lg leading-snug group-hover:text-accent">
              {section.feature.title}
            </p>
          </Link>
        ) : null}
      </div>

      <div className="border-t border-border">
        <div className="container-page py-4">
          <Link
            href={section.href}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
          >
            View everything in {section.label}
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Columns for a row of tiles.
 *
 * Tracks the item count rather than sitting at six, because a six-column grid
 * holding three tiles leaves the same empty half this layout exists to remove.
 * Written out in full so Tailwind can see the class names.
 */
const TILE_COLUMNS: Record<number, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

/**
 * A single group shown as pictures.
 *
 * The group label is dropped: with one group it repeats the menu item that was
 * just clicked, and the tiles are self-describing.
 */
function TileRow({ group, isOpen }: { group: NavGroup; isOpen: boolean }) {
  const columns = TILE_COLUMNS[Math.min(Math.max(group.items.length, 3), 6)];

  return (
    <ul className={cn("grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3", columns)}>
      {group.items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="group block">
            <ProductImage
              src={item.imageUrl}
              alt=""
              art={item.art ?? "decor"}
              aspect="aspect-4/3"
              // Eager, but only once the panel has been opened. The panel is
              // mounted and hidden from first paint, and a lazy image inside a
              // `hidden` subtree can sit in the load queue and never come out
              // of it when the subtree is revealed - six permanently blank
              // tiles. Tying it to `isOpen` costs nothing on a page nobody
              // opens the menu on.
              priority={isOpen}
              // The panel is at most a page wide and the tiles divide it, so
              // asking for a sixth of the viewport keeps a phone off the
              // full-size file.
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 16vw"
              className="transition-shadow duration-slow group-hover:shadow-card"
            />
            <p className="mt-3 text-sm font-medium transition-colors duration-fast group-hover:text-accent">
              {item.label}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * A single group with no pictures, spread across the panel.
 *
 * Same links as the column layout, laid out four-up so they use the width the
 * panel already takes instead of stacking beside nothing.
 */
function SpreadList({ group, sectionLabel }: { group: NavGroup; sectionLabel: string }) {
  const id = `nav-${sectionLabel}-${group.label}`.toLowerCase().replace(/\s+/g, "-");

  return (
    <div>
      {/* A paragraph, not a heading — see the note in the column layout. */}
      <p
        id={id}
        className="font-sans text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle"
      >
        {group.label}
      </p>
      <ul
        aria-labelledby={id}
        className="mt-4 grid gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-4"
      >
        {group.items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="-mx-2 block rounded-sm px-2 py-2 text-sm text-ink-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
