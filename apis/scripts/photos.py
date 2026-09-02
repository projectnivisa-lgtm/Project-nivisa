"""Placeholder photography, hotlinked from Unsplash.

WHAT THIS IS
    A stand-in, exactly like the drawings in `artwork.py`. Nothing here is a
    photograph of a Nivisa product, because there are no Nivisa products.
    It exists so the shop can be shown, demoed and design-reviewed looking
    like a furniture shop rather than a wireframe.

WHY IT IS NOT THE ONLY OPTION
    `artwork.py` draws SVG illustrations locally and was written precisely
    because a seed full of remote URLs breaks on a train, in CI, or behind an
    egress proxy: every card becomes a broken image. That is still true. So
    photographs are the default because they read better, and
    `--drawings` still gives the offline-safe catalogue. Neither is
    photography of a real product, and both are replaced piece by piece as
    real photography is uploaded through the dashboard.

LICENCE
    Unsplash images are free to use commercially, without permission or
    attribution, under the Unsplash Licence (https://unsplash.com/license).
    Hotlinking `images.unsplash.com` is the delivery Unsplash documents and
    intends. Attribution is not required; it is good manners, so the photo
    IDs stay legible in this file rather than being hidden behind a hash.

    The one thing the licence does not permit is redistributing the photos as
    a competing stock library, which is not what a furniture catalogue does.

EVERY ID BELOW WAS OPENED AND LOOKED AT before being written down, which is
the only way to be sure a URL that returns HTTP 200 is a sofa and not a
sunset.
"""
from __future__ import annotations

HOST = "images.unsplash.com"

# name -> Unsplash photo id, grouped by what the photograph actually shows.
PHOTOS: dict[str, str] = {
    # Seating
    "sofa_studio": "1555041469-a586c61ea9bc",      # green three-seater, plain wall
    "sofa_room": "1493663284031-b7e3aefcae8e",     # grey sofa, furnished room
    "sofa_detail": "1567016432779-094069958ea5",   # upholstery and cushion, close
    "chair_studio": "1567538096630-e0c55bd6374c",  # tufted chair, plain ground
    "chair_corner": "1550226891-ef816aed4a98",     # armchair, stool, side cabinet
    "chair_accent": "1586023492125-27b2c045efd7",  # yellow armchair, hall
    "chair_plain": "1592078615290-033ee584e267",   # moulded chair, flat ground
    "bench_studio": "1503602642458-232111445657",  # wooden stool, flat ground
    # Sleeping
    "bed_studio": "1631049307264-da0ec9d70304",    # upholstered bed, headboard
    "bedroom_room": "1615874959474-d609969a20ed",  # made bed, plants, daylight
    "bedroom_classic": "1505693416388-ac5ce068fe85",
    "bed_detail": "1592789705501-f9ae4278a9c9",    # cushions and throw, close
    "bed_side": "1522771739844-6a9f6d5f14af",      # bed and bedside table
    "bedroom_dark": "1617104678098-de229db51175",  # bed and bench, panelled wall
    "mattress_detail": "1584100936595-c0654b55a2e2",  # pillow, flat ground
    # Tables
    "dining_studio": "1617806118233-18e1de247200",  # laid dining table
    "dining_room": "1544457070-4cd773b4d71e",       # dining table, loft
    "table_small": "1517705008128-361805f42e86",    # side table and chair
    "table_round": "1519710164239-da123dc03ef4",    # round table, arc lamp
    # Storage
    "wardrobe": "1558997519-83ea9252edf8",          # two-door wardrobe
    "cabinet_slots": "1595428774223-ef52624120d2",  # pigeon-hole cabinet
    "shelf_wall": "1594026112284-02bb6f3352fe",     # floating shelves and console
    "books_shelf": "1526243741027-444d633d7365",    # filled bookshelves, close
    # Work
    "desk_studio": "1518455027359-f3f8164ba6bd",    # desk and chair, white room
    "desk_room": "1593062096033-9a26b09da705",      # wooden desk, warm light
    "desk_detail": "1533090161767-e6ffed986c88",    # desk lamp and clock, close
    # Lighting
    "lamp_studio": "1507473885765-e6ed057f782c",    # floor lamp, white wall
    "lamp_room": "1524758631624-e2822e304c36",      # arc lamp over seating
    "lamp_detail": "1513506003901-1e6a229e2d15",    # pendant shade, close
    # Rooms, for tiles and banners
    "living_wide": "1600210492486-724fe5c67fb0",
    "living_neutral": "1616486338812-3dadae4b4ace",
    "living_bright": "1560448204-e02f11c3d0e2",
    "living_formal": "1598928506311-c55ded91a20c",
    "entry_kitchen": "1600607686527-6fb886090705",
    "living_soft": "1631679706909-1844bbd07221",
    "dining_window": "1519643381401-22c77e60520e",
    # The only outdoor scene in this bank. Not furniture on a balcony - that
    # photograph does not exist in what could be checked by eye - but a terrace
    # reads as outdoors, which a living room with large windows never did.
    "outdoor_terrace": "1416331108676-a22ccb276e35",
}


def url(key: str, *, width: int, height: int) -> str:
    """A cropped, right-sized delivery URL for one photograph.

    Unsplash crops and resizes at the edge, so one photo id serves the card,
    the gallery and the banner without three files. Sizing here rather than in
    CSS is what keeps a 4000px original off a phone.
    """
    return (
        f"https://{HOST}/photo-{PHOTOS[key]}"
        f"?auto=format&fit=crop&w={width}&h={height}&q=80"
    )


def is_photo(candidate: str | None) -> bool:
    """True when this URL is one of these stand-ins, not somebody's upload."""
    return bool(candidate) and HOST in candidate


# Keyword -> (studio, lifestyle, detail). Matched against the product name,
# longest keyword first, so "coffee table" wins over "table" and "floor lamp"
# never falls through to the generic living-room shot.
PRODUCT_SETS: dict[str, tuple[str, str, str]] = {
    "sofa": ("sofa_studio", "sofa_room", "sofa_detail"),
    "settee": ("sofa_studio", "sofa_room", "sofa_detail"),
    "couch": ("sofa_studio", "sofa_room", "sofa_detail"),
    "mattress": ("bed_studio", "bedroom_dark", "mattress_detail"),
    "bed": ("bed_studio", "bedroom_room", "bed_detail"),
    "bookcase": ("shelf_wall", "living_neutral", "books_shelf"),
    "bookshelf": ("shelf_wall", "living_neutral", "books_shelf"),
    "shelf": ("shelf_wall", "living_neutral", "books_shelf"),
    "shelving": ("shelf_wall", "living_neutral", "books_shelf"),
    "bench": ("bench_studio", "living_soft", "table_small"),
    "stool": ("bench_studio", "living_soft", "table_small"),
    "armchair": ("chair_studio", "chair_corner", "chair_accent"),
    "lounge chair": ("chair_studio", "chair_corner", "chair_accent"),
    "recliner": ("chair_studio", "chair_corner", "chair_accent"),
    "chair": ("chair_studio", "chair_corner", "chair_accent"),
    "coffee table": ("table_small", "living_neutral", "table_round"),
    "side table": ("table_small", "living_neutral", "table_round"),
    "dining table": ("dining_studio", "dining_room", "table_round"),
    "table": ("dining_studio", "dining_room", "table_small"),
    "wardrobe": ("wardrobe", "bedroom_classic", "cabinet_slots"),
    "almirah": ("wardrobe", "bedroom_classic", "cabinet_slots"),
    "dresser": ("wardrobe", "bedroom_classic", "cabinet_slots"),
    "shoe": ("cabinet_slots", "entry_kitchen", "shelf_wall"),
    "sideboard": ("shelf_wall", "living_neutral", "cabinet_slots"),
    "cabinet": ("cabinet_slots", "living_neutral", "shelf_wall"),
    "desk": ("desk_studio", "desk_room", "desk_detail"),
    "study": ("desk_studio", "desk_room", "desk_detail"),
    "lamp": ("lamp_studio", "lamp_room", "lamp_detail"),
    "light": ("lamp_studio", "lamp_room", "lamp_detail"),
    "nightstand": ("bed_side", "bedroom_classic", "bed_detail"),
    "bedside": ("bed_side", "bedroom_classic", "bed_detail"),
}

DEFAULT_SET = ("living_neutral", "living_bright", "living_formal")

# Keyword -> one tile, for categories, rooms and collections.
TAXONOMY: dict[str, str] = {
    "living": "living_wide",
    "bedroom": "bedroom_classic",
    "sleep": "bed_studio",
    "dining": "dining_studio",
    "kitchen": "entry_kitchen",
    "entry": "entry_kitchen",
    "hallway": "entry_kitchen",
    "storage": "wardrobe",
    "wardrobe": "wardrobe",
    "study": "desk_studio",
    "office": "desk_studio",
    "work": "desk_studio",
    "kids": "table_round",
    "child": "table_round",
    "outdoor": "outdoor_terrace",
    "balcony": "outdoor_terrace",
    "garden": "outdoor_terrace",
    "seating": "chair_studio",
    "sofa": "sofa_studio",
    "chair": "chair_studio",
    "table": "dining_studio",
    "bed": "bed_studio",
    "light": "lamp_room",
    "lamp": "lamp_room",
    "decor": "shelf_wall",
    "new": "living_neutral",
    "sale": "living_formal",
}

TAXONOMY_DEFAULT = "living_neutral"


def _match(text: str, keys) -> str | None:
    """Longest keyword wins, so 'coffee table' beats 'table'."""
    lowered = text.lower()
    best: str | None = None
    for key in keys:
        if key in lowered and (best is None or len(key) > len(best)):
            best = key
    return best


# What the gallery shows, in order, and the shape each framing wants.
#
# All landscape, because furniture is. A sofa photographed straight on is a
# wide subject, and asking the CDN for a 4:5 crop of one returns the middle of
# it - cushions, no arms, no legs - which is the one thing a furniture card
# must not do. The frames that show these were squared up to match; see
# `ProductImage`. Detail is square because a close-up of a weave has no
# silhouette to lose.
FRAMINGS: dict[str, tuple[int, int]] = {
    "studio": (1600, 1200),
    "lifestyle": (1600, 1200),
    "detail": (1200, 1200),
}


def product_images(name: str) -> dict[str, str]:
    """Three framings for one product, keyed by the gallery's own names.

    The fourth framing the gallery shows - `dimension` - is deliberately absent.
    A measured drawing is information, not a photograph, and no stock library
    has one of a product that does not exist. The caller draws that one.
    """
    key = _match(name, PRODUCT_SETS)
    chosen = PRODUCT_SETS[key] if key else DEFAULT_SET
    return {
        framing: url(photo, width=size[0], height=size[1])
        for (framing, size), photo in zip(FRAMINGS.items(), chosen)
    }


def taxonomy_image(name: str) -> str:
    """One tile for a category, room or collection."""
    key = _match(name, TAXONOMY)
    return url(TAXONOMY[key] if key else TAXONOMY_DEFAULT, width=1200, height=900)


def banner_images() -> tuple[str, str]:
    """The wide hero and its mobile crop.

    Two different photographs rather than one squeezed: a 21:9 hero crops into
    nonsense on a phone, which is the same reason the drawn banner has two
    separate drawings.
    """
    return (
        url("living_wide", width=2400, height=1000),
        url("bedroom_room", width=1200, height=1500),
    )
