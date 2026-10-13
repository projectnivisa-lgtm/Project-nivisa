"""Widen the demo catalogue: every category, every room, every price band.

`seed.py` creates ten products, one per category, so most filters on the shop
(a parent category, a price band, the Outdoor room) come back empty in a demo.
This adds stand-in products until every top-level category has something in
each of the shop's five price bands and every room has pieces in it.

Idempotent: a product whose slug already exists is skipped, so it is safe to
run again. Images are attached afterwards by `scripts.seed_media`.

    python -m scripts.seed_demo_more && python -m scripts.seed_media
"""
import asyncio
from decimal import Decimal

from sqlalchemy import select

from app.core.database import SessionLocal, engine
from app.core.slug import slugify
from app.models import (
    Attribute, Brand, Category, Collection, CollectionProduct, Product,
    ProductAttribute, ProductRoom, ProductVariant, Room,
)

# name, category, brand, price, compare-at, stock, (w, d, h) mm, rooms,
# seats, warranty months, attributes, tagline, collections
CATALOGUE = [
    # --- Seating
    ("Kosi Two-Seater Sofa", "Sofas", "Nivisa Studio", "68000", "76000", 6, (1680, 860, 790),
     ["Living"], 2, 60, [("material", "Solid Teak"), ("upholstery", "Linen"), ("colour", "Sand")],
     "A compact sofa for flats where every centimetre is spoken for.", ["Small Spaces"]),
    ("Ganga Sectional Sofa", "Sofas", "Coromandel Works", "185000", "210000", 2, (2900, 1700, 800),
     ["Living"], 5, 60, [("material", "Solid Sheesham"), ("upholstery", "Boucle"), ("colour", "Ink")],
     "An L-shaped sectional that seats the whole family for a match.", ["Best Sellers"]),
    ("Veda Accent Armchair", "Armchairs", "Nivisa Studio", "24500", None, 10, (760, 780, 820),
     ["Living", "Bedroom"], 1, 36, [("upholstery", "Cotton Weave"), ("colour", "Ochre")],
     "A small-footprint armchair in a warm ochre weave.", ["Small Spaces"]),
    ("Leela Recliner Armchair", "Armchairs", "Coromandel Works", "108000", "120000", 3, (900, 950, 1020),
     ["Living"], 1, 60, [("upholstery", "Full-grain Leather"), ("colour", "Terracotta")],
     "Full-grain leather that reclines in one smooth, silent movement.", []),
    ("Patio Rattan Lounge Chair", "Armchairs", "Teak & Twine", "21000", "24000", 12, (780, 820, 860),
     ["Outdoor"], 1, 24, [("material", "Rattan"), ("finish", "Natural Oil")],
     "Weather-treated rattan for a balcony or a covered terrace.", ["The Teak Edit"]),
    ("Sutra Dining Chair", "Dining Chairs", "Nivisa Studio", "8900", None, 24, (450, 520, 820),
     ["Dining"], 1, 24, [("material", "Solid Sheesham"), ("finish", "Walnut Stain")],
     "A sturdy everyday dining chair, sold singly.", []),
    ("Asha Cane Dining Chair", "Dining Chairs", "Teak & Twine", "14500", "16500", 16, (470, 530, 830),
     ["Dining"], 1, 36, [("material", "Solid Teak"), ("style", "Mid-century")],
     "Hand-woven cane back on a solid teak frame.", ["The Teak Edit"]),
    ("Monsoon Garden Chair", "Dining Chairs", "Coromandel Works", "6500", None, 30, (520, 560, 800),
     ["Outdoor"], 1, 12, [("material", "Powder-coated Steel"), ("colour", "Verdigris")],
     "Powder-coated steel that shrugs off a monsoon.", []),
    ("Ritu Entryway Bench", "Benches", "Nivisa Studio", "18500", None, 9, (1100, 380, 460),
     ["Living"], 2, 36, [("material", "Mango Wood"), ("finish", "Natural Oil")],
     "A place to sit and take your shoes off by the door.", ["Small Spaces"]),
    ("Terrace Teak Bench", "Benches", "Teak & Twine", "32000", "36000", 5, (1500, 450, 450),
     ["Outdoor"], 3, 60, [("material", "Solid Teak"), ("finish", "Natural Oil")],
     "Oiled teak that greys gracefully in the sun.", ["The Teak Edit"]),
    ("Pebble Kids Stool", "Benches", "Nivisa Studio", "4900", None, 40, (320, 320, 300),
     ["Kids"], 1, 12, [("material", "Mango Wood"), ("colour", "Terracotta")],
     "Rounded edges and a height made for small people.", []),
    # --- Tables
    ("Kaveri Four-Seater Dining Table", "Dining Tables", "Nivisa Studio", "46000", "52000", 7, (1300, 800, 760),
     ["Dining"], 4, 60, [("material", "Mango Wood"), ("finish", "Honey Lacquer")],
     "A four-seat table sized for a city dining corner.", ["Small Spaces"]),
    ("Raja Marble Dining Table", "Dining Tables", "Coromandel Works", "165000", None, 2, (2400, 1000, 760),
     ["Dining"], 8, 120, [("material", "Marble"), ("style", "Contemporary")],
     "Eight seats around a single slab of white marble.", []),
    ("Balcony Bistro Table", "Dining Tables", "Coromandel Works", "9500", None, 15, (600, 600, 740),
     ["Outdoor"], 2, 12, [("material", "Powder-coated Steel"), ("colour", "Ink")],
     "A round two-seater for morning chai on the balcony.", ["Small Spaces"]),
    ("Oval Teak Coffee Table", "Coffee Tables", "Teak & Twine", "27500", "31000", 8, (1100, 600, 400),
     ["Living"], None, 60, [("material", "Solid Teak"), ("finish", "Natural Oil")],
     "Soft oval corners, so nobody's shin finds them.", ["The Teak Edit"]),
    ("Ira Nesting Coffee Table", "Coffee Tables", "Nivisa Studio", "8200", None, 20, (700, 500, 420),
     ["Living"], None, 24, [("material", "Mango Wood"), ("style", "Minimal")],
     "Two tables that tuck into one when guests leave.", ["Small Spaces"]),
    ("Bindu Side Table", "Side Tables", "Nivisa Studio", "6900", None, 25, (450, 450, 550),
     ["Living", "Bedroom"], None, 24, [("material", "Solid Sheesham"), ("finish", "Walnut Stain")],
     "A drum-shaped side table with a lipped top.", []),
    ("Garden Side Table", "Side Tables", "Coromandel Works", "7800", None, 18, (420, 420, 500),
     ["Outdoor"], None, 12, [("material", "Powder-coated Steel"), ("colour", "Verdigris")],
     "Somewhere to put a glass down in the garden.", []),
    ("Doodle Kids Activity Table", "Side Tables", "Nivisa Studio", "9200", None, 12, (800, 600, 500),
     ["Kids"], None, 24, [("material", "Mango Wood"), ("colour", "Ochre")],
     "A low table for drawing, building and spilling.", []),
    ("Chhota Kids Study Desk", "Desks", "Nivisa Studio", "16000", "18500", 10, (900, 550, 600),
     ["Kids", "Study"], None, 36, [("material", "Mango Wood"), ("colour", "Sand")],
     "A desk with a slanted reading top that grows with them.", []),
    ("Arjun Executive Desk", "Desks", "Coromandel Works", "112000", None, 3, (1800, 850, 760),
     ["Study"], None, 84, [("material", "Solid Teak"), ("finish", "Walnut Stain")],
     "A broad teak desk with a leather writing inlay.", ["The Teak Edit"]),
    # --- Storage
    ("Sita Two-Door Wardrobe", "Wardrobes", "Nivisa Studio", "58000", "64000", 6, (1000, 580, 2000),
     ["Bedroom"], None, 60, [("material", "Mango Wood"), ("finish", "Whitewash")],
     "Hanging space, four shelves and a locker drawer.", []),
    ("Maharani Four-Door Wardrobe", "Wardrobes", "Coromandel Works", "145000", None, 2, (2000, 600, 2150),
     ["Bedroom"], None, 120, [("material", "Solid Sheesham"), ("finish", "Honey Lacquer")],
     "A full wall of storage with a mirrored centre door.", []),
    ("Tiny Tots Wardrobe", "Wardrobes", "Nivisa Studio", "22000", None, 8, (800, 500, 1400),
     ["Kids"], None, 36, [("material", "Mango Wood"), ("colour", "Sand")],
     "A child-height wardrobe they can open themselves.", []),
    ("Lata Compact Sideboard", "Sideboards", "Teak & Twine", "38000", "42000", 7, (1200, 400, 760),
     ["Dining", "Living"], None, 60, [("material", "Solid Teak"), ("style", "Mid-century")],
     "Two doors and two drawers for a smaller dining room.", ["Small Spaces"]),
    ("Nook Wall Shelf", "Bookcases", "Nivisa Studio", "4500", None, 35, (800, 220, 300),
     ["Study", "Living"], None, 12, [("material", "Mango Wood"), ("style", "Minimal")],
     "A single floating shelf for the books you are reading now.", ["Small Spaces"]),
    ("Kahani Kids Bookshelf", "Bookcases", "Nivisa Studio", "9800", None, 14, (700, 300, 900),
     ["Kids"], None, 24, [("material", "Mango Wood"), ("colour", "Terracotta")],
     "Front-facing shelves so picture books show their covers.", []),
    ("Gita Chest of Drawers", "Chests", "Nivisa Studio", "29000", None, 9, (900, 450, 950),
     ["Bedroom"], None, 60, [("material", "Solid Sheesham"), ("finish", "Walnut Stain")],
     "Five soft-close drawers on full-extension runners.", []),
    ("Heirloom Storage Chest", "Chests", "Coromandel Works", "72000", "80000", 3, (1200, 550, 600),
     ["Bedroom", "Living"], None, 120, [("material", "Solid Teak"), ("style", "Rustic")],
     "A brass-cornered trunk built to be handed down.", ["The Teak Edit"]),
    ("Jodi Shoe Cabinet", "Chests", "Nivisa Studio", "11500", None, 16, (800, 320, 1000),
     ["Living"], None, 24, [("material", "Mango Wood"), ("finish", "Whitewash")],
     "Tilt-out bins that hold sixteen pairs by the door.", ["Small Spaces"]),
    # --- Beds
    ("Sapna Kids Single Bed", "Bed Frames", "Nivisa Studio", "26000", "29000", 6, (1000, 2000, 800),
     ["Kids"], None, 60, [("material", "Mango Wood"), ("colour", "Sand")],
     "A single bed with a guard rail that comes off later.", []),
    ("Shanti Storage Bed", "Bed Frames", "Coromandel Works", "138000", "152000", 3, (1950, 2150, 1050),
     ["Bedroom"], None, 120, [("material", "Solid Sheesham"), ("upholstery", "Linen")],
     "A king bed with hydraulic lift-up storage underneath.", ["Best Sellers"]),
    ("Bunai Cane Headboard", "Headboards", "Teak & Twine", "9500", None, 12, (1600, 60, 1100),
     ["Bedroom"], None, 24, [("material", "Rattan"), ("style", "Rustic")],
     "A cane headboard that fixes to the wall behind any bed.", []),
    ("Narm Padded Headboard", "Headboards", "Nivisa Studio", "18000", "21000", 9, (1650, 80, 1200),
     ["Bedroom"], None, 36, [("upholstery", "Boucle"), ("colour", "Sand")],
     "Channel-stitched boucle, soft enough to lean on and read.", []),
    # --- Lighting
    ("Chandra Arc Floor Lamp", "Floor Lamps", "Coromandel Works", "28500", None, 8, (400, 1500, 1900),
     ["Living"], None, 24, [("material", "Powder-coated Steel"), ("colour", "Ink")],
     "An arc that reaches over the sofa from the corner.", []),
    ("Garden Lantern Floor Lamp", "Floor Lamps", "Teak & Twine", "8800", None, 20, (300, 300, 1100),
     ["Outdoor"], None, 12, [("material", "Solid Teak"), ("finish", "Natural Oil")],
     "A teak lantern for the terrace, weather-sealed.", []),
    ("Diya Table Lamp", "Table Lamps", "Nivisa Studio", "3900", None, 40, (200, 200, 380),
     ["Bedroom", "Study"], None, 12, [("material", "Powder-coated Steel"), ("colour", "Ochre")],
     "A small bedside lamp with a warm, dimmable glow.", ["Small Spaces"]),
    ("Peetal Brass Table Lamp", "Table Lamps", "Coromandel Works", "12500", "14000", 14, (300, 300, 550),
     ["Living", "Study"], None, 24, [("material", "Powder-coated Steel"), ("style", "Contemporary")],
     "Spun brass base, pleated linen shade.", []),
    ("Bunai Rattan Pendant", "Pendants", "Teak & Twine", "7500", None, 22, (450, 450, 350),
     ["Dining", "Living"], None, 12, [("material", "Rattan"), ("style", "Rustic")],
     "A hand-woven rattan shade that throws patterned light.", []),
    ("Tamra Copper Dome Pendant", "Pendants", "Coromandel Works", "54000", None, 5, (600, 600, 450),
     ["Dining"], None, 36, [("material", "Powder-coated Steel"), ("colour", "Terracotta")],
     "A hammered copper dome to hang over the dining table.", []),
    ("Mahal Crystal Chandelier", "Pendants", "Coromandel Works", "115000", "130000", 2, (900, 900, 1000),
     ["Dining", "Living"], None, 60, [("material", "Powder-coated Steel"), ("style", "Contemporary")],
     "Three tiers of hand-cut crystal for a double-height room.", []),
]


def _sku(name: str, index: int) -> str:
    letters = "".join(w[0] for w in name.upper().split() if w[0].isalpha())[:4]
    return f"DMO-{letters}-{index:03d}"


async def main() -> None:
    async with SessionLocal() as session:
        categories = {c.name: c for c in (await session.execute(select(Category))).scalars()}
        rooms = {r.name: r for r in (await session.execute(select(Room))).scalars()}
        brands = {b.name: b for b in (await session.execute(select(Brand))).scalars()}
        attributes = {
            (a.kind, a.name): a for a in (await session.execute(select(Attribute))).scalars()
        }
        collections = {c.name: c for c in (await session.execute(select(Collection))).scalars()}
        existing = set((await session.execute(select(Product.slug))).scalars())

        added = 0
        for index, (
            name, category, brand, price, compare, stock, (w, d, h), room_names,
            seats, warranty, attrs, tagline, collection_names,
        ) in enumerate(CATALOGUE, start=1):
            slug = slugify(name)
            if slug in existing:
                continue
            assembly = w * d > 600_000
            product = Product(
                name=name, slug=slug, tagline=tagline,
                description="\n\n".join([
                    tagline,
                    "Made to order in our Bengaluru workshop. Every piece is finished by hand, "
                    "so the grain and tone vary a little from one to the next.",
                ]),
                category_id=categories[category].id,
                brand_id=brands[brand].id,
                status="active",
                assembly_required=assembly,
                assembly_note="Two-person assembly, roughly 30 minutes." if assembly else None,
                warranty_months=warranty,
                care_instructions="Dust with a dry cloth. Keep out of direct sun and away from damp walls.",
                seating_capacity=seats,
                specifications=[
                    {"label": "Origin", "value": "Bengaluru, India"},
                    {"label": "Lead time", "value": "2 to 4 weeks"},
                ],
                meta_title=f"{name} | Nivisa",
                meta_description=tagline,
            )
            session.add(product)
            await session.flush()

            session.add(ProductVariant(
                product_id=product.id, sku=_sku(name, index), option_label=None,
                price=Decimal(price),
                compare_at_price=Decimal(compare) if compare else None,
                cost_price=Decimal(price) * Decimal("0.55"),
                tax_rate=Decimal("18.00"),
                stock_quantity=stock, low_stock_threshold=3,
                width_mm=w, depth_mm=d, height_mm=h,
                lead_time_days=21, position=0,
            ))
            for room in room_names:
                session.add(ProductRoom(product_id=product.id, room_id=rooms[room].id))
            for key in attrs:
                if key in attributes:
                    session.add(ProductAttribute(product_id=product.id, attribute_id=attributes[key].id))
            for collection in collection_names:
                if collection in collections:
                    session.add(CollectionProduct(
                        collection_id=collections[collection].id,
                        product_id=product.id, position=100 + index,
                    ))
            added += 1

        await session.commit()
    print(f"  {added} demo product(s) added, {len(CATALOGUE) - added} already present")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
