"""Check the two stand-in photo banks have not drifted apart.

There are two, and there has to be: the API seed writes rows into a database
from `apis/scripts/photos.py`, while the storefront's demo content is a
build-time constant in `web/src/`. Neither side can import the other - they are
different languages, and the two Docker build contexts do not overlap - so the
banks are kept in step by hand.

By hand is fine as long as drift is visible. This makes it visible: every
photo id the storefront uses must also be known to the API bank, so a
photograph added to one side and forgotten on the other fails here rather than
showing up as a product whose card and gallery disagree.

    python tools/check_photo_banks.py

Exits non-zero on drift, so it can go in front of a release if that is ever
worth doing. It checks ids only - which framing each side crops to is a
per-surface decision and deliberately not shared.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

API_BANK = ROOT / "apis" / "scripts" / "photos.py"
WEB_BANKS = (
    ROOT / "web" / "src" / "lib" / "demo" / "photos.ts",
    ROOT / "web" / "src" / "config" / "stockImages.ts",
)

# Unsplash ids look like `1555041469-a586c61ea9bc`: a timestamp, a dash, and
# twelve hex-ish characters.
ID = re.compile(r'"(\d{10,13}-[a-z0-9]{12})"')


def ids(path: Path) -> set[str]:
    if not path.exists():
        sys.exit(f"missing: {path.relative_to(ROOT)}")
    return set(ID.findall(path.read_text(encoding="utf-8")))


def main() -> int:
    api = ids(API_BANK)
    web: set[str] = set()
    for path in WEB_BANKS:
        web |= ids(path)

    print(f"  api bank: {len(api)} photos")
    print(f"  web bank: {len(web)} photos")

    unknown = sorted(web - api)
    if unknown:
        print("\nUsed by the storefront but absent from the API bank:")
        for photo in unknown:
            print(f"  {photo}")
        print(
            "\nAdd them to apis/scripts/photos.py, or the seeded catalogue and the\n"
            "demo catalogue will show different photographs for the same piece."
        )
        return 1

    # Not a failure: the API bank carries tiles and banners the storefront's
    # demo content has no use for.
    spare = len(api - web)
    print(f"  {spare} in the API bank only (tiles and banners) - expected")
    print("\nBanks agree.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
