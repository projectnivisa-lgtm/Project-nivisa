"""Apply a .sql file to the database.

The SQL under apis/sql/ defines the Postgres functions the HTTPS backend calls
through PostgREST. Creating a function is DDL, which PostgREST does not do, so
this has to run over a real connection - from a machine that can reach 5432,
which is a laptop rather than the cPanel box.

USAGE
    python tools/apply_sql.py apis/sql/admin_dashboard.sql
    python tools/apply_sql.py apis/sql/*.sql

Reads DATABASE_URL from apis/.env, like the other tools here. The whole file
runs in one transaction, so a syntax error near the end leaves nothing behind
half-applied.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import asyncpg

ROOT = Path(__file__).resolve().parent.parent


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


async def run(paths: list[Path]) -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set. See the module docstring.")
    url = url.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]

    conn = await asyncpg.connect(url, ssl="require", statement_cache_size=0)
    try:
        for path in paths:
            if not path.exists():
                sys.exit(f"{path} does not exist.")
            async with conn.transaction():
                await conn.execute(path.read_text(encoding="utf-8"))
            # Printed as given rather than relative to ROOT: an absolute
            # path from outside the repo is legal and relative_to() raises on
            # it, which turned a successful apply into a traceback.
            print(f"  applied {path}")
    finally:
        await conn.close()
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit("Usage: python tools/apply_sql.py <file.sql> [more.sql ...]")
    load_env()
    return asyncio.run(run([Path(a) for a in sys.argv[1:]]))


if __name__ == "__main__":
    raise SystemExit(main())
