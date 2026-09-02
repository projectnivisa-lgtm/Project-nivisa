"""Turn on row-level security for every table in `public`.

WHY THIS IS NOT OPTIONAL ON SUPABASE
    Supabase puts PostgREST in front of the database and publishes it at
    `https://<ref>.supabase.co/rest/v1/`. Any table in `public` is an endpoint
    there, reachable with the project's anon key - and the anon key is public
    by design: it ships inside browser bundles and mobile apps.

    Row-level security is the only thing standing between that endpoint and
    the data. Without it, `GET /rest/v1/staff_users?select=email,password_hash`
    returns exactly what it says, to anyone.

    This was verified against this project before the script was written. It
    returned three staff password hashes and the full customer table, and an
    INSERT was accepted (it failed on a NOT NULL constraint, not on
    permission). RLS was enabled on zero of thirty-six tables.

NO POLICIES, DELIBERATELY
    RLS with no policy denies everything to every role that is subject to it,
    which is the correct answer here: this backend talks to Postgres directly
    with asyncpg and never goes through PostgREST. Nothing legitimate reads
    these tables through the REST API, so nothing needs a policy.

    The API is unaffected because it connects as `postgres`, which owns these
    tables and carries BYPASSRLS. Confirmed before running: bypassrls = true,
    owner of 36 of 36 tables.

    If you later use supabase-js for something - realtime, a public form -
    write a policy for that table then, scoped to that case. Adding policies is
    a deliberate act; having none is the safe default.

    `FORCE ROW LEVEL SECURITY` is *not* set. Forcing it would subject the owner
    to the policies too, and with no policies that locks the application out of
    its own database.

USAGE
    python tools/enable_rls.py "postgresql://postgres:PW@db.REF.supabase.co:5432/postgres"
    python tools/enable_rls.py "$URL" --dry-run

Safe to re-run: enabling RLS on a table that already has it is a no-op.
"""
from __future__ import annotations

import argparse
import asyncio
import sys

import asyncpg


async def run(url: str, dry_run: bool) -> int:
    conn = await asyncpg.connect(url, ssl="require", statement_cache_size=0)
    try:
        me = await conn.fetchrow(
            "select current_user as name, rolbypassrls from pg_roles where rolname = current_user"
        )
        print(f"  connected as {me['name']} (bypassrls={me['rolbypassrls']})")
        if not me["rolbypassrls"]:
            owns_all = await conn.fetchval(
                "select count(*) = 0 from pg_tables "
                "where schemaname='public' and tableowner <> current_user"
            )
            if not owns_all:
                print(
                    "\n  This role neither bypasses RLS nor owns every table. Enabling\n"
                    "  RLS from here could lock the application out of tables it does\n"
                    "  not own. Connect as the owner (usually `postgres`) instead."
                )
                return 1

        rows = await conn.fetch(
            "select tablename, rowsecurity from pg_tables "
            "where schemaname = 'public' order by tablename"
        )
        todo = [r["tablename"] for r in rows if not r["rowsecurity"]]
        done = [r["tablename"] for r in rows if r["rowsecurity"]]

        print(f"  tables in public: {len(rows)}")
        print(f"  already protected: {len(done)}")
        print(f"  to enable: {len(todo)}")

        if not todo:
            print("\n  Nothing to do.")
            return 0

        for table in todo:
            if dry_run:
                print(f"    would enable: {table}")
                continue
            # Identifier comes from pg_tables, not from user input, but it is
            # quoted anyway - a table named "order" is legal and would
            # otherwise be a syntax error.
            await conn.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
            print(f"    enabled: {table}")

        if dry_run:
            print("\n  Dry run - nothing changed.")
            return 0

        remaining = await conn.fetchval(
            "select count(*) from pg_tables where schemaname='public' and not rowsecurity"
        )
        policies = await conn.fetchval(
            "select count(*) from pg_policies where schemaname='public'"
        )
        print(f"\n  Unprotected tables remaining: {remaining}")
        print(f"  Policies defined: {policies} (none is correct for this stack)")
        return 0 if remaining == 0 else 1
    finally:
        await conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="connection string for the table owner")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.url.startswith("postgres"):
        sys.exit("expected a postgresql:// connection string")
    return asyncio.run(run(args.url, args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
