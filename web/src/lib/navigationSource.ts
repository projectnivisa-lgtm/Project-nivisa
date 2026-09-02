import { catalogApi, type Category } from "@/api/catalog";
import type { NavSection, RoomLink } from "@/config/navigation";
import { FALLBACK_NAV, FALLBACK_ROOMS, artForCategory, artForSlug } from "@/config/navigation";

/**
 * The shop's navigation, built from the catalogue.
 *
 * This used to be a hardcoded file, because the backend had no room taxonomy
 * and no category slugs — so every product-type link resolved to a search
 * rather than a filter, and the room list was a frontend invention that no
 * query could honour. Both exist now, so the menu is what the catalogue
 * actually contains: add a category in the dashboard and it appears here.
 *
 * Two rules it keeps from the hardcoded version:
 *
 *  - **Every href must lead somewhere with results in it.** Categories and
 *    rooms are only listed if they exist; a collection is only listed if it
 *    has products. A menu item that opens an empty grid is worse than one
 *    that is not there.
 *  - **The header must always render.** If the catalogue cannot be reached,
 *    a small static fallback is used rather than a site with no navigation.
 */

export interface Navigation {
  sections: NavSection[];
  rooms: RoomLink[];
}

export async function loadNavigation(): Promise<Navigation> {
  try {
    const [categories, rooms, collections, filters] = await Promise.all([
      catalogApi.getCategories(),
      catalogApi.getRooms(),
      catalogApi.getCollections(),
      catalogApi.getFilterOptions(),
    ]);

    const roomLinks: RoomLink[] = rooms.map((room) => ({
      slug: room.slug,
      label: room.name,
      href: `/rooms/${room.slug}`,
      imageUrl: room.imageUrl,
      art: artForSlug(room.slug),
    }));

    // Only collections that have something in them. An empty rail in the menu
    // is a promise the grid cannot keep.
    const stocked = collections.filter((c) => c.productCount > 0);

    const materials = filters.attributes.material ?? [];

    // The card that fills the right of a mega-menu panel. Drawn from the
    // catalogue rather than hardcoded, and omitted when there is nothing to
    // put in it: the panel slot has always existed, nothing ever filled it,
    // and the result was a full-width panel with a column of links in one
    // corner. Featured first, then whichever stocked collection is largest -
    // a card is only worth the space if it leads somewhere with depth.
    const promoted =
      stocked.find((c) => c.isFeatured) ??
      [...stocked].sort((a, b) => b.productCount - a.productCount)[0];

    const feature = promoted
      ? {
          eyebrow: "Collection",
          title: promoted.name,
          href: `/collection/${promoted.slug}`,
          art: artForCategory(promoted.slug),
          imageUrl: promoted.imageUrl,
        }
      : undefined;

    const sections: NavSection[] = [
      {
        label: "Shop",
        href: "/shop",
        // Same card as Collections. Shop's groups wrap to a ragged second row
        // whatever the catalogue holds, and a card pinned right gives the
        // panel an edge to end on instead of trailing off into the margin.
        feature,
        groups: categories
          .filter((c) => c.productCount > 0 || (c.children ?? []).length > 0)
          .map((category) => ({
            label: category.name,
            items: (category.children ?? [])
              .filter((child) => child.productCount > 0)
              .map((child) => ({
                label: child.name,
                href: `/category/${child.slug}`,
                categoryId: child.id,
              })),
          }))
          .filter((group) => group.items.length > 0),
      },
      {
        label: "Rooms",
        href: "/rooms",
        groups: [
          {
            label: "Shop by room",
            items: roomLinks.map((room) => ({
              label: room.label,
              href: room.href,
              categoryId: null,
              imageUrl: room.imageUrl,
              art: room.art,
            })),
          },
        ],
      },
      {
        label: "Collections",
        href: "/collections",
        feature,
        groups: [
          ...(stocked.length
            ? [
                {
                  label: "Curated",
                  items: stocked.map((collection) => ({
                    label: collection.name,
                    href: `/collection/${collection.slug}`,
                    categoryId: null,
                    imageUrl: collection.imageUrl,
                    art: artForCategory(collection.slug),
                  })),
                },
              ]
            : []),
          ...(materials.length
            ? [
                {
                  label: "By material",
                  items: materials.map((material) => ({
                    // A real filter now, not a search that happens to match
                    // the word. `/shop?material=solid-teak` narrows the grid;
                    // `/search?q=teak` only found products with "teak" in
                    // their prose.
                    label: material.name,
                    href: `/shop?material=${material.slug}`,
                    categoryId: null,
                  })),
                },
              ]
            : []),
        ],
      },
    ].filter((section) => section.groups.length > 0 || section.href === "/shop");

    // A catalogue with nothing in it would produce a menu of empty panels.
    if (sections.length === 0 || roomLinks.length === 0) {
      return { sections: FALLBACK_NAV, rooms: FALLBACK_ROOMS };
    }

    return { sections, rooms: roomLinks };
  } catch {
    return { sections: FALLBACK_NAV, rooms: FALLBACK_ROOMS };
  }
}

/** Categories flattened to slug/name, for the sitemap and 404 page. */
export async function loadCategorySlugs(): Promise<Array<{ slug: string; name: string }>> {
  try {
    const out: Array<{ slug: string; name: string }> = [];
    const walk = (nodes: Category[]) => {
      for (const node of nodes) {
        out.push({ slug: node.slug, name: node.name });
        walk(node.children ?? []);
      }
    };
    walk(await catalogApi.getCategories());
    return out;
  } catch {
    return [];
  }
}
