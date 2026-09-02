"""Move locally-stored uploads to Bunny, and repoint the database at them.

Switching `STORAGE_PROVIDER` changes where NEW uploads go. It does nothing
about what is already stored: rows written while storage was `local` hold
root-relative `/media/...` URLs, and those are served by the API only while
it is still the `local` provider. Flip to `bunny` without running this and
those images 404 - quietly, because a missing image is not an error anyone
gets paged about.

WHAT IT TOUCHES
    Every column in the schema that holds an uploaded file's URL:

        product_images.url          banners.image_url, mobile_image_url
        product_ar_assets.model_url, ios_model_url, poster_url
        categories.image_url        rooms.image_url
        collections.image_url       brands.logo_url

USAGE
    # dry run first - prints what would move, changes nothing
    python tools/migrate_media_to_bunny.py --media-root ./media --dry-run

    # then for real
    python tools/migrate_media_to_bunny.py --media-root ./media

    Files usually live in the Docker volume rather than the working tree.
    Copy them out first:

        docker compose cp api:/data/media ./media

    Connection and Bunny settings are read from the environment, the same
    names the API uses: DATABASE_URL, BUNNY_STORAGE_ZONE, BUNNY_ACCESS_KEY,
    BUNNY_STORAGE_HOST, BUNNY_PUBLIC_BASE_URL.

SAFETY
    The database is updated only after the upload for that row succeeds, one
    row at a time. Interrupt it and you get a partial migration where every
    row is either fully moved or untouched - never a URL pointing at a file
    that was never written. Run it again to finish.
"""
from __future__ import annotations

import argparse
import asyncio
import mimetypes
import os
import sys
from pathlib import Path

import asyncpg
import httpx

# Python's mimetypes table predates both 3D formats. `main.py` registers these
# at import so the API uploads them correctly; this script does not import the
# API, so it has to register them itself.
#
# It matters more than a tidy header: iOS AR Quick Look silently declines to
# open a USDZ that does not arrive as model/vnd.usdz+zip. The customer taps
# "View in your room" and gets a blank screen with nothing to explain it.
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("model/gltf+json", ".gltf")
mimetypes.add_type("model/vnd.usdz+zip", ".usdz")

# table, column pairs holding an uploaded URL.
COLUMNS: list[tuple[str, str]] = [
    ("product_images", "url"),
    ("product_ar_assets", "model_url"),
    ("product_ar_assets", "ios_model_url"),
    ("product_ar_assets", "poster_url"),
    ("banners", "image_url"),
    ("banners", "mobile_image_url"),
    ("categories", "image_url"),
    ("rooms", "image_url"),
    ("collections", "image_url"),
    ("brands", "logo_url"),
]


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if not value:
        sys.exit(f"{name} is not set. See the module docstring.")
    return value


async def upload(client: httpx.AsyncClient, host: str, zone: str, key: str,
                 path: str, data: bytes) -> None:
    response = await client.put(
        f"https://{host}/{zone}/{path}",
        content=data,
        headers={
            "AccessKey": key,
            "Content-Type": mimetypes.guess_type(path)[0] or "application/octet-stream",
        },
    )
    if response.status_code not in (200, 201):
        raise RuntimeError(f"HTTP {response.status_code} {response.text[:120]}")


async def run(media_root: Path, prefix: str, dry_run: bool) -> int:
    zone = env("BUNNY_STORAGE_ZONE")
    key = env("BUNNY_ACCESS_KEY")
    host = env("BUNNY_STORAGE_HOST", "storage.bunnycdn.com")
    public = env("BUNNY_PUBLIC_BASE_URL").rstrip("/")

    # The API's URL uses the SQLAlchemy driver prefix; asyncpg wants it plain.
    url = env("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
    url = url.split("?")[0]

    conn = await asyncpg.connect(url, ssl="require", statement_cache_size=0)
    moved = missing = failed = 0

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            for table, column in COLUMNS:
                rows = await conn.fetch(
                    f'select id, "{column}" as value from public."{table}" '
                    f'where "{column}" like $1', f"{prefix}/%"
                )
                if not rows:
                    continue
                print(f"\n{table}.{column}: {len(rows)} to move")

                for row in rows:
                    key_path = row["value"][len(prefix):].lstrip("/")
                    source = media_root / key_path

                    if not source.exists():
                        print(f"  missing on disk: {key_path}")
                        missing += 1
                        continue

                    target = f"{public}/{key_path}"
                    if dry_run:
                        print(f"  would move: {key_path}")
                        moved += 1
                        continue

                    try:
                        await upload(client, host, zone, key, key_path, source.read_bytes())
                    except Exception as exc:  # noqa: BLE001 - reported, then skipped
                        print(f"  upload failed: {key_path} -> {exc}")
                        failed += 1
                        continue

                    # Only now, once the bytes are definitely on the CDN.
                    await conn.execute(
                        f'update public."{table}" set "{column}" = $1 where id = $2',
                        target, row["id"],
                    )
                    print(f"  moved: {key_path}")
                    moved += 1
    finally:
        await conn.close()

    print(
        f"\n{'Would move' if dry_run else 'Moved'}: {moved}"
        f" | missing on disk: {missing} | failed: {failed}"
    )
    if missing:
        print(
            "Rows whose file is missing were left pointing at /media. They refer to\n"
            "files that were deleted, or to a media directory that is not the one\n"
            "given by --media-root."
        )
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--media-root", type=Path, required=True,
                        help="local copy of the media directory")
    parser.add_argument("--prefix", default="/media",
                        help="URL prefix the rows currently use (MEDIA_URL_PREFIX)")
    # Note: --dry-run does not call Bunny at all, so it proves the file list
    # and nothing about the upload. Run it to check WHAT moves; run the real
    # thing against one file to check that moving works.
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.media_root.is_dir():
        sys.exit(f"not a directory: {args.media_root}")
    return asyncio.run(run(args.media_root, args.prefix.rstrip("/"), args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
