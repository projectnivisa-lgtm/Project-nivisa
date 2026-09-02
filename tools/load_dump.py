"""Load a plain `pg_dump` file into a target Postgres, and verify the result.

Written for moving the local Docker catalogue into Supabase, but there is
nothing Supabase-specific in it: it takes a dump file and a connection string.

WHY NOT JUST `psql -f dump.sql`
    Because psql may not be installed on the machine that can reach the
    target. Supabase's direct host is IPv6-only, the Docker containers here
    have no IPv6 route, and the Windows host that does has no psql. This runs
    on asyncpg, which the project already depends on.

    The cost is that psql meta-commands do not exist here, so the two that
    pg_dump emits are handled explicitly below. Nothing else in a plain dump
    needs a client.

USAGE
    # 1. dump (plain SQL, INSERTs rather than COPY, no ownership)
    docker compose exec -T db pg_dump -U nivisa -d nivisa \\
        --schema=public --no-owner --no-acl --inserts --quote-all-identifiers \\
        > dump.sql

    # 2. load, then verify against the source counts
    python tools/load_dump.py dump.sql "postgresql://user:pw@host:5432/db"
    python tools/load_dump.py dump.sql "$URL" --verify source-counts.csv

SAFETY
    Refuses to run against a target whose `public` schema already has tables,
    unless `--force` is given. Loading a dump twice is how you get duplicate
    primary keys and a half-applied schema.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import re
import sys
from pathlib import Path

import asyncpg


def clean(sql: str) -> str:
    """Strip what only psql can execute.

    Two things appear in a modern plain dump that are not SQL:

      * `\\restrict` / `\\unrestrict` - psql 16.4+ wraps dumps in these to stop
        a hostile dump escaping into shell commands. They are meaningless to a
        driver, which cannot run shell commands in the first place.
      * `CREATE SCHEMA "public"` - every Postgres already has one, and a
        managed provider owns it. Recreating it is both unnecessary and, on
        Supabase, not permitted.
    """
    lines = [
        line for line in sql.splitlines()
        if not line.startswith("\\")
    ]
    body = "\n".join(lines)
    body = re.sub(r'CREATE SCHEMA "?public"?;', "", body)
    return body


async def load(dump: Path, url: str, force: bool, verify: Path | None) -> int:
    sql = clean(dump.read_text(encoding="utf-8"))

    conn = await asyncpg.connect(url, ssl="require", statement_cache_size=0)
    try:
        server = await conn.fetchval("select version()")
        print(f"  target: {server.split(',')[0]}")

        existing = await conn.fetchval(
            "select count(*) from information_schema.tables "
            "where table_schema='public' and table_type='BASE TABLE'"
        )
        if existing and not force:
            print(
                f"\n  Refusing to load: the target already has {existing} table(s) in\n"
                "  public. Loading a dump onto an existing schema leaves it half\n"
                "  applied. Drop them first, or pass --force if you know better."
            )
            return 1
        print(f"  tables in target before: {existing}")

        # One transaction: a dump that fails halfway leaves nothing behind.
        async with conn.transaction():
            await conn.execute(sql)

        loaded = await conn.fetchval(
            "select count(*) from information_schema.tables "
            "where table_schema='public' and table_type='BASE TABLE'"
        )
        print(f"  tables in target after:  {loaded}")

        if verify:
            print("\n  Verifying row counts against the source:")
            mismatches = 0
            with verify.open(encoding="utf-8") as handle:
                for row in csv.reader(handle):
                    if len(row) != 2 or not row[0]:
                        continue
                    table, expected = row[0].strip(), int(row[1])
                    actual = await conn.fetchval(f'select count(*) from public."{table}"')
                    flag = "" if actual == expected else "   <-- MISMATCH"
                    if actual != expected:
                        mismatches += 1
                    print(f"    {table:<26} {expected:>6} -> {actual:<6}{flag}")
            print(
                "\n  Every table matches." if not mismatches
                else f"\n  {mismatches} table(s) do not match."
            )
            return 1 if mismatches else 0
        return 0
    finally:
        await conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dump", type=Path)
    parser.add_argument("url", help="target connection string")
    parser.add_argument("--force", action="store_true", help="load onto a non-empty schema")
    parser.add_argument("--verify", type=Path, help="CSV of table,count from the source")
    args = parser.parse_args()

    if not args.dump.exists():
        sys.exit(f"no such dump: {args.dump}")
    return asyncio.run(load(args.dump, args.url, args.force, args.verify))


if __name__ == "__main__":
    raise SystemExit(main())
