/**
 * Navigation types, and a fallback menu.
 *
 * The live menu is built from the catalogue by `lib/navigationSource.ts` —
 * categories, rooms, collections and materials all exist as real, filterable
 * taxonomies now, so the shop's shape is what it actually contains rather
 * than a list maintained by hand.
 *
 * What remains here is the type contract, the placeholder-art mapping, and a
 * small static fallback used only when the catalogue cannot be reached. The
 * fallback exists so a site with a sick API still has a header someone can
 * navigate with; it is deliberately tiny, and every href in it works without
 * any catalogue data.
 */

export interface NavLeaf {
  label: string;
  href: string;
  /** Backend category id, when this maps to a real one. */
  categoryId: string | null;
  /**
   * Set only where the taxonomy behind this link has a picture of its own.
   * A section whose links all carry one is shown as tiles rather than as a
   * list; see `MegaMenu`. Absent is normal — a material filter has no image.
   */
  imageUrl?: string | null;
  /** Line art for the tile, until the taxonomy has a picture. */
  art?: ArtKey;
}

export interface NavGroup {
  label: string;
  items: NavLeaf[];
}

export interface NavColumnFeature {
  /** Editorial card pinned to the right of a mega-menu panel. */
  eyebrow: string;
  title: string;
  href: string;
  /** Category key the placeholder artwork is drawn from. */
  art: ArtKey;
  /** The collection's own picture, when it has one. */
  imageUrl?: string | null;
}

export interface NavSection {
  label: string;
  href: string;
  groups: NavGroup[];
  feature?: NavColumnFeature;
}

/** Keys for the line-art placeholder set in `components/commerce/ProductImage`. */
export type ArtKey =
  | "sofa"
  | "bed"
  | "wardrobe"
  | "table"
  | "chair"
  | "storage"
  | "mattress"
  | "decor"
  | "lighting"
  | "study"
  | "outdoor"
  | "kids";

export interface RoomLink {
  slug: string;
  label: string;
  href: string;
  imageUrl?: string | null;
  art: ArtKey;
}

/**
 * Placeholder line art, by room slug.
 *
 * Used until a room has its own photograph. Unknown slugs fall back to a
 * neutral mark rather than to a sofa, which would be wrong for five of the
 * six rooms.
 */
const ROOM_ART: Record<string, ArtKey> = {
  living: "sofa",
  "living-room": "sofa",
  bedroom: "bed",
  dining: "table",
  "dining-room": "table",
  study: "study",
  kids: "kids",
  outdoor: "outdoor",
};

export function artForSlug(slug: string): ArtKey {
  return ROOM_ART[slug] ?? "decor";
}

/**
 * Placeholder line art, by category slug.
 *
 * Matched on the words a furniture category actually uses rather than on an
 * exact slug, so "sofas", "dining-tables" and "bedside-tables" all find
 * something. Without this every category tile renders the same mark, and five
 * identical icons in a row read as a broken image rather than as a
 * placeholder.
 *
 * Only used until a category has its own photograph, which the dashboard can
 * set on any of them.
 */
const CATEGORY_ART: Array<[RegExp, ArtKey]> = [
  [/sofa|seating|armchair|recliner|bench|couch/i, "sofa"],
  [/bed|mattress|headboard/i, "bed"],
  [/wardrobe|almirah/i, "wardrobe"],
  [/table|desk/i, "table"],
  [/chair|stool/i, "chair"],
  [/storage|shelf|shelving|bookcase|sideboard|chest|cabinet/i, "storage"],
  [/light|lamp|pendant/i, "lighting"],
  [/study|office/i, "study"],
  [/outdoor|balcony|garden|patio/i, "outdoor"],
  [/kid|child|nursery/i, "kids"],
];

export function artForCategory(slugOrName: string): ArtKey {
  for (const [pattern, art] of CATEGORY_ART) {
    if (pattern.test(slugOrName)) return art;
  }
  return "decor";
}

/** Used only when the catalogue is unreachable. See the note at the top. */
export const FALLBACK_ROOMS: RoomLink[] = [
  { slug: "living", label: "Living Room", href: "/rooms/living", art: "sofa" },
  { slug: "bedroom", label: "Bedroom", href: "/rooms/bedroom", art: "bed" },
  { slug: "dining", label: "Dining Room", href: "/rooms/dining", art: "table" },
  { slug: "study", label: "Study & Office", href: "/rooms/study", art: "study" },
  { slug: "kids", label: "Kids", href: "/rooms/kids", art: "kids" },
  { slug: "outdoor", label: "Balcony & Outdoor", href: "/rooms/outdoor", art: "outdoor" },
];

export const FALLBACK_NAV: NavSection[] = [
  {
    label: "Shop",
    href: "/shop",
    groups: [
      {
        label: "Browse",
        items: [
          { label: "All furniture", href: "/shop", categoryId: null },
          { label: "New this season", href: "/shop?sort=newest", categoryId: null },
        ],
      },
    ],
  },
  { label: "Rooms", href: "/rooms", groups: [] },
  { label: "Collections", href: "/collections", groups: [] },
];

/** Mobile bottom navigation. Five items maximum — a sixth is a menu, not a tab. */
export const BOTTOM_NAV = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Shop", href: "/shop", icon: "grid" },
  { label: "Search", href: "/search", icon: "search" },
  { label: "Saved", href: "/wishlist", icon: "heart" },
  { label: "Account", href: "/account", icon: "user" },
] as const;
