"""Turn the client's photograph folders into the category tree, on Bunny.

WHAT THE CLIENT GAVE US
    `assets/`, sixteen folders of photographs. The folder name is the only
    information in them: the files inside are `1.PNG`, `2.jpeg` and
    `WhatsApp Image 2026-08-17 at 1.49.48 PM.jpeg`. Nothing names a product,
    a price or a dimension, so this builds CATEGORIES and nothing else. No
    product rows are invented here - there is no data to invent them from.

THE TREE
    Five parents, sixteen children, by product type. Type rather than room,
    because `rooms` is already a separate dimension on a product and the
    storefront browses it at /rooms/<slug>; parents named for rooms would be
    a second navigation saying the same thing in different words.

    The client's folder names carry typos and inconsistent case - "study
    tabel", "shoes racks", "kid wardrobe". FOLDERS below maps each one to the
    name customers should see, so the shop is not spelled the way the
    handover was.

WHAT IT DOES
    1. Uploads every photograph to Bunny under catalog/<subcategory-slug>/.
       The key is the file's own content hash, so running this twice writes
       the same key twice rather than accumulating duplicates.
    2. Deletes the seeded demo categories. `products.category_id` is
       ON DELETE SET NULL, so the demo products survive uncategorised - they
       are not removed here.
    3. Inserts the tree, each subcategory carrying the first photograph from
       its folder as `image_url`, each parent carrying its first child's.
    4. Writes tools/client-assets-manifest.json: every uploaded URL, grouped
       by subcategory. 139 photographs go up and 21 become category images;
       the manifest is how the rest are found again when products are built,
       without a second upload.

USAGE
    # prints the tree and what would upload, changes nothing
    python tools/import_client_assets.py --dry-run

    # upload only, leave the database alone
    python tools/import_client_assets.py --skip-db

    # for real
    python tools/import_client_assets.py

    Settings are read from apis/.env, or from the environment if that file is
    absent - the same names the API uses: DATABASE_URL, BUNNY_STORAGE_ZONE,
    BUNNY_ACCESS_KEY, BUNNY_STORAGE_HOST, BUNNY_PUBLIC_BASE_URL.

SAFETY
    Every upload finishes before the database is touched, and the database
    work is one transaction. Interrupt it during the uploads and nothing has
    changed but Bunny holding files no row points at; run it again. Interrupt
    it during the transaction and the tree is rolled back whole.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import mimetypes
import os
import sys
from pathlib import Path

import asyncpg
import httpx

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
MANIFEST = ROOT / "tools" / "client-assets-manifest.json"

# Parent categories, in the order they should appear in the navigation.
PARENTS: list[tuple[str, str, str]] = [
    ("units-cabinets", "Units & Cabinets",
     "Wall units, cabinets and the pieces a room is arranged around."),
    ("storage-shelving", "Storage & Shelving",
     "Open shelving, racks and drawers."),
    ("beds-bedside", "Beds & Bedside",
     "Beds and the tables that stand beside them."),
    ("tables-desks", "Tables & Desks",
     "Surfaces to work at."),
    ("kids", "Kids",
     "Scaled for a child's room, in the same construction as the rest."),
]

# assets/ folder -> (subcategory slug, display name, parent slug).
#
# The keys are the client's spelling and must match the directory on disk
# exactly, including case. The names are ours.
FOLDERS: dict[str, tuple[str, str, str]] = {
    "Tv unit":             ("tv-unit", "TV Unit", "units-cabinets"),
    "display unit":        ("display-unit", "Display Unit", "units-cabinets"),
    "crockery unit":       ("crockery-unit", "Crockery Unit", "units-cabinets"),
    "bar unit":            ("bar-unit", "Bar Unit", "units-cabinets"),
    "pooja unit":          ("pooja-unit", "Pooja Unit", "units-cabinets"),
    "dressing unit":       ("dressing-unit", "Dressing Unit", "units-cabinets"),

    "book shelf":          ("book-shelf", "Book Shelf", "storage-shelving"),
    "shoes racks":         ("shoe-rack", "Shoe Rack", "storage-shelving"),
    "chest of drawer":     ("chest-of-drawers", "Chest of Drawers", "storage-shelving"),

    "BEDS":                ("beds", "Beds", "beds-bedside"),
    "bed side tabel":      ("bedside-table", "Bedside Table", "beds-bedside"),

    "study tabel":         ("study-table", "Study Table", "tables-desks"),

    "kid wardrobe":        ("kids-wardrobe", "Kids Wardrobe", "kids"),
    "kid study table":     ("kids-study-table", "Kids Study Table", "kids"),
    "kid chest of drawer": ("kids-chest-of-drawers", "Kids Chest of Drawers", "kids"),
    "kid book shelf":      ("kids-book-shelf", "Kids Book Shelf", "kids"),
}

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def load_env() -> None:
    """Read apis/.env into the environment, without overriding what is set.

    The deployment keeps its real credentials there and docker-compose sets
    the same names as variables. Anything already in the environment wins, so
    running this against a different database is a matter of exporting one
    variable rather than editing a file.
    """
    path = ROOT / "apis" / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        os.environ.setdefault(name.strip(), value.strip())


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if not value:
        sys.exit(f"{name} is not set. See the module docstring.")
    return value


def photographs(folder: Path) -> list[Path]:
    """Every image in a folder, ordered so a re-run picks the same cover.

    Sorted by lowercased name, which puts `1.PNG` before `10.PNG` only by
    luck; the order within a folder does not carry meaning, but it has to be
    STABLE, or `image_url` changes on every run and the CDN cache churns for
    no reason.
    """
    files = [
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES
    ]
    return sorted(files, key=lambda p: p.name.lower())


def key_for(slug: str, path: Path, data: bytes) -> str:
    """Storage key from the file's own content.

    Content-addressed rather than uuid-named, unlike the API's uploads: this
    script is run again whenever the client sends more photographs, and a
    random name would upload all 139 a second time and leave the first copies
    orphaned with nothing pointing at them.
    """
    digest = hashlib.sha256(data).hexdigest()[:16]
    return f"catalog/{slug}/{digest}{path.suffix.lower()}"


async def upload(client: httpx.AsyncClient, host: str, zone: str,
                 access_key: str, key: str, data: bytes) -> None:
    response = await client.put(
        f"https://{host}/{zone}/{key}",
        content=data,
        headers={
            "AccessKey": access_key,
            # Bunny ignores this and serves by its own extension table, but
            # it costs nothing and the file is not only ever read by Bunny.
            "Content-Type": mimetypes.guess_type(key)[0] or "application/octet-stream",
        },
    )
    if response.status_code not in (200, 201):
        raise RuntimeError(f"HTTP {response.status_code} {response.text[:120]}")


async def upload_folders(dry_run: bool) -> dict[str, list[str]]:
    """Upload every photograph. Returns subcategory slug -> public URLs."""
    zone = env("BUNNY_STORAGE_ZONE")
    access_key = env("BUNNY_ACCESS_KEY")
    host = env("BUNNY_STORAGE_HOST", "storage.bunnycdn.com").strip("/")
    public = env("BUNNY_PUBLIC_BASE_URL").rstrip("/")

    uploaded: dict[str, list[str]] = {}
    total = failed = 0

    async with httpx.AsyncClient(timeout=120.0) as client:
        for folder_name, (slug, display, _parent) in FOLDERS.items():
            folder = ASSETS / folder_name
            if not folder.is_dir():
                sys.exit(
                    f"assets/{folder_name} is missing. FOLDERS in this script "
                    f"must match the directories on disk exactly, case included."
                )

            files = photographs(folder)
            if not files:
                print(f"  {display}: no images, skipped")
                continue

            urls: list[str] = []
            for path in files:
                data = path.read_bytes()
                key = key_for(slug, path, data)
                if dry_run:
                    urls.append(f"{public}/{key}")
                    continue
                try:
                    await upload(client, host, zone, access_key, key, data)
                except Exception as exc:  # noqa: BLE001 - reported, then skipped
                    print(f"    FAILED {path.name}: {exc}")
                    failed += 1
                    continue
                urls.append(f"{public}/{key}")

            uploaded[slug] = urls
            total += len(urls)
            print(f"  {display:<24} {len(urls):>3} images")

    verb = "would upload" if dry_run else "uploaded"
    print(f"\n{verb} {total} photographs" + (f", {failed} failed" if failed else ""))
    if failed and not dry_run:
        sys.exit("Uploads failed. The database was not touched; fix and re-run.")
    return uploaded


def first_child_cover(parent_slug: str, uploaded: dict[str, list[str]]) -> str | None:
    """The first photograph belonging to a parent's first populated child.

    A parent shows one of its children's shots: these folders are all product
    photographs, so there is no separate image for the group, and an empty
    parent tile on the storefront reads as a broken one rather than an empty
    one. FOLDERS is ordered, so this is stable across runs.
    """
    for slug, _name, parent in FOLDERS.values():
        if parent == parent_slug and uploaded.get(slug):
            return uploaded[slug][0]
    return None


async def write_tree(conn: asyncpg.Connection, uploaded: dict[str, list[str]]) -> None:
    """Replace the categories with the client's tree, in one transaction."""
    async with conn.transaction():
        orphaned = await conn.fetchval(
            "select count(*) from products where category_id is not null"
        )
        removed = await conn.fetchval(
            "with gone as (delete from categories returning 1) select count(*) from gone"
        )
        print(f"  removed {removed} demo categories "
              f"({orphaned} products left uncategorised, not deleted)")

        parent_ids: dict[str, int] = {}
        for position, (slug, name, description) in enumerate(PARENTS):
            cover = first_child_cover(slug, uploaded)
            parent_ids[slug] = await conn.fetchval(
                "insert into categories (parent_id, name, slug, description, "
                "image_url, position, is_active, created_at, updated_at) "
                "values (null, $1, $2, $3, $4, $5, true, now(), now()) returning id",
                name, slug, description, cover, position,
            )
            print(f"  {name}")

        for position, (folder_name, (slug, name, parent_slug)) in enumerate(FOLDERS.items()):
            urls = uploaded.get(slug) or []
            await conn.execute(
                "insert into categories (parent_id, name, slug, description, "
                "image_url, position, is_active, created_at, updated_at) "
                "values ($1, $2, $3, null, $4, $5, true, now(), now())",
                parent_ids[parent_slug], name, slug,
                urls[0] if urls else None, position,
            )
            print(f"    {name:<24} {len(urls):>3} images")


async def run(dry_run: bool, skip_db: bool) -> int:
    print(f"Reading {ASSETS}\n")
    uploaded = await upload_folders(dry_run)

    MANIFEST.write_text(json.dumps(uploaded, indent=2) + "\n", encoding="utf-8")
    print(f"manifest: {MANIFEST.relative_to(ROOT)}")

    if dry_run or skip_db:
        print("\nDatabase not touched.")
        return 0

    url = env("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://").split("?")[0]
    conn = await asyncpg.connect(url, ssl="require", statement_cache_size=0)
    print()
    try:
        await write_tree(conn, uploaded)
    finally:
        await conn.close()

    print("\nDone. The dashboard's Categories screen shows the new tree.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true",
                        help="print what would happen; upload nothing, change nothing")
    parser.add_argument("--skip-db", action="store_true",
                        help="upload and write the manifest, but leave the database alone")
    args = parser.parse_args()

    load_env()
    return asyncio.run(run(args.dry_run, args.skip_db))


if __name__ == "__main__":
    raise SystemExit(main())
