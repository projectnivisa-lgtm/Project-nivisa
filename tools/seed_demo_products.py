"""Build a demo catalogue on the client's photographs.

WHAT THIS IS, AND WHAT IT IS NOT
    The client sent 139 photographs in sixteen folders and nothing else - no
    names, no prices, no dimensions. tools/import_client_assets.py turned the
    folders into categories, which is all the folders honestly supported.

    This goes further and INVENTS product data, because a shop with an empty
    catalogue cannot be demonstrated or tested. Every name, price, dimension
    and line of copy below is made up. The photographs are the client's; the
    words and the numbers are not, and none of them should reach a customer.

    Everything it creates carries the SKU prefix NVD- so it can be found and
    removed in one statement, which is the point:

        delete from products where id in (
            select product_id from product_variants where sku like 'NVD-%');

    Re-running the script does exactly that first, so it is idempotent rather
    than cumulative.

WHY IT RUNS ON POSTGRES, NOT POSTGREST
    It writes products, variants and images together, and inserts a row that
    others reference by id. That wants a transaction, which PostgREST does not
    have - see docs/CPANEL-SUPABASE-HTTP.md. So this is run from a machine
    that can reach 5432, which is a laptop, not the cPanel box.

USAGE
    python tools/seed_demo_products.py --dry-run
    python tools/seed_demo_products.py

    Reads DATABASE_URL from apis/.env, like the other tools here.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from decimal import Decimal
from pathlib import Path

import asyncpg

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "tools" / "client-assets-manifest.json"

SKU_PREFIX = "NVD"

# First names used the way the original seed used them - "Anara Three-Seater
# Sofa" - so the demo reads like a catalogue rather than like fixture data.
NAMES = [
    "Anara", "Kavi", "Sindhu", "Nila", "Tara", "Meru", "Bela", "Ilaa",
    "Ravi", "Choti", "Aruna", "Vayu", "Chitra", "Danta", "Ekant", "Gauri",
    "Hemal", "Indira", "Jalaj", "Kiran", "Lavya", "Mira", "Nayan", "Ojas",
]

# Per subcategory: display noun, price band in whole rupees, a plausible
# footprint in mm (w, d, h), and the rooms it belongs to.
#
# The bands are the part most worth getting roughly right: a demo where a shoe
# rack costs more than a bed is a demo nobody trusts, and every screenshot
# taken from it has to be explained.
SPEC: dict[str, tuple[str, int, int, tuple[int, int, int], list[str]]] = {
    "tv-unit":               ("TV Unit",            18000,  62000, (1800, 400,  550), ["living"]),
    "display-unit":          ("Display Unit",       16000,  54000, (1000, 400, 1800), ["living"]),
    "crockery-unit":         ("Crockery Unit",      22000,  68000, (1200, 450, 1900), ["dining"]),
    "bar-unit":              ("Bar Unit",           19000,  58000, (1000, 450, 1850), ["living", "dining"]),
    "pooja-unit":            ("Pooja Unit",         14000,  46000, ( 750, 400, 1600), ["living"]),
    "dressing-unit":         ("Dressing Unit",      17000,  52000, ( 900, 400, 1750), ["bedroom"]),
    "book-shelf":            ("Book Shelf",          9000,  34000, ( 900, 320, 1800), ["study", "living"]),
    "shoe-rack":             ("Shoe Rack",           7500,  24000, ( 900, 350, 1100), ["living"]),
    "chest-of-drawers":      ("Chest of Drawers",   15000,  48000, ( 900, 450, 1050), ["bedroom"]),
    "beds":                  ("Bed",                34000, 118000, (1980, 1670, 950), ["bedroom"]),
    "bedside-table":         ("Bedside Table",       6500,  19000, ( 450, 400,  550), ["bedroom"]),
    "study-table":           ("Study Table",        12000,  42000, (1200, 600,  760), ["study"]),
    "kids-wardrobe":         ("Kids Wardrobe",      24000,  72000, (1200, 550, 1800), ["kids"]),
    "kids-study-table":      ("Kids Study Table",    9500,  28000, (1000, 550,  700), ["kids"]),
    "kids-chest-of-drawers": ("Kids Chest of Drawers", 12000, 34000, ( 750, 420,  900), ["kids"]),
    "kids-book-shelf":       ("Kids Book Shelf",     7500,  22000, ( 750, 300, 1200), ["kids"]),
}

TAGLINES = [
    "Solid ply carcass with a hand-finished veneer.",
    "Built for a flat that has to make its floor area count.",
    "Soft-close hardware throughout, rated to fifty thousand cycles.",
    "A quiet piece, meant to be lived with rather than looked at.",
    "Seasoned hardwood frame, joined rather than screwed.",
]

DESCRIPTION = (
    "<p>Demonstration copy. This product exists so the storefront can be "
    "shown with a full catalogue; the photograph is real and everything "
    "written about it is not.</p>"
)


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if not value:
        sys.exit(f"{name} is not set.")
    return value


def load_env() -> None:
    path = ROOT / "apis" / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def price_for(low: int, high: int, index: int, of: int) -> Decimal:
    """A price spread across the band, ending in 500 the way retail does.

    Deterministic rather than random: re-running produces the same catalogue,
    so a screenshot taken last week still matches the shop this week.
    """
    if of <= 1:
        value = (low + high) // 2
    else:
        value = low + (high - low) * index // (of - 1)
    return Decimal(round(value / 500) * 500)


def plan() -> list[dict]:
    """Decide the whole catalogue before touching the database."""
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    products: list[dict] = []
    name_at = 0

    for slug, urls in manifest.items():
        if slug not in SPEC:
            print(f"  skipping {slug}: no spec for it")
            continue
        noun, low, high, (w, d, h), rooms = SPEC[slug]

        # Up to four products per subcategory, each taking a share of that
        # folder's photographs. Four is enough to fill a grid without turning
        # sixteen categories into a catalogue nobody can scroll.
        count = min(4, len(urls))
        per = max(1, len(urls) // count)

        for i in range(count):
            first = NAMES[name_at % len(NAMES)]
            name_at += 1
            images = urls[i * per:(i + 1) * per] or [urls[i]]
            products.append({
                "category_slug": slug,
                "name": f"{first} {noun}",
                "slug": f"{first.lower()}-{slug}",
                "tagline": TAGLINES[name_at % len(TAGLINES)],
                "price": price_for(low, high, i, count),
                "dims": (w, d, h),
                "rooms": rooms,
                "images": images,
                "sku": f"{SKU_PREFIX}-{slug.upper()[:12]}-{i + 1}",
            })
    return products


async def run(dry_run: bool) -> int:
    url = env("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://").split("?")[0]
    products = plan()
    print(f"\n{len(products)} demo products across {len(SPEC)} subcategories")

    if dry_run:
        for p in products[:8]:
            print(f"  {p['name']:<32} Rs {p['price']:>9,}  {len(p['images'])} images")
        print(f"  ... and {max(0, len(products) - 8)} more")
        print("\nNothing written.")
        return 0

    conn = await asyncpg.connect(url, ssl="require", statement_cache_size=0)
    try:
        async with conn.transaction():
            categories = {
                r["slug"]: r["id"]
                for r in await conn.fetch("select id, slug from categories")
            }
            rooms = {r["slug"]: r["id"] for r in await conn.fetch("select id, slug from rooms")}
            brand = await conn.fetchval("select id from brands order by id limit 1")

            removed = await conn.fetchval(
                """with gone as (
                       delete from products where id in (
                           select product_id from product_variants where sku like $1)
                       returning 1)
                   select count(*) from gone""",
                f"{SKU_PREFIX}-%",
            )
            print(f"  removed {removed} products from a previous run")

            for p in products:
                product_id = await conn.fetchval(
                    """insert into products
                         (name, slug, tagline, description, category_id, brand_id,
                          status, assembly_required, warranty_months,
                          created_at, updated_at)
                       values ($1,$2,$3,$4,$5,$6,'active',true,24,now(),now())
                       returning id""",
                    p["name"], p["slug"], p["tagline"], DESCRIPTION,
                    categories[p["category_slug"]], brand,
                )

                w, d, h = p["dims"]
                await conn.execute(
                    """insert into product_variants
                         (product_id, sku, option_label, price, tax_rate,
                          stock_quantity, low_stock_threshold, backorder_allowed,
                          width_mm, depth_mm, height_mm, lead_time_days,
                          position, is_active, created_at, updated_at)
                       values ($1,$2,$3,$4,18.00,12,3,false,$5,$6,$7,7,0,true,now(),now())""",
                    product_id, p["sku"], "Walnut", p["price"], w, d, h,
                )

                for position, image_url in enumerate(p["images"]):
                    await conn.execute(
                        """insert into product_images
                             (product_id, url, alt_text, kind, position,
                              created_at, updated_at)
                           values ($1,$2,$3,'studio',$4,now(),now())""",
                        product_id, image_url, f"{p['name']} photographed in a studio",
                        position,
                    )

                for room_slug in p["rooms"]:
                    if room_slug in rooms:
                        await conn.execute(
                            "insert into product_rooms (product_id, room_id) values ($1,$2) "
                            "on conflict do nothing",
                            product_id, rooms[room_slug],
                        )

            print(f"  created {len(products)} products")
    finally:
        await conn.close()

    print("\nDone. The storefront has a catalogue.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="print the plan, write nothing")
    args = parser.parse_args()
    load_env()
    return asyncio.run(run(args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
