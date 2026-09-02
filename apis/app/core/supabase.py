"""Reaching the database over HTTPS, when the port is not available.

The cPanel deployment sits on a host that allows outbound 443 and refuses
5432 and 6543, so the Postgres wire protocol is not an option there. Supabase
publishes PostgREST at https://<ref>.supabase.co/rest/v1/, which is on 443,
and this is the client for it.

WHAT THIS IS NOT
    It is not a database driver and it is not a drop-in for SQLAlchemy. There
    are no transactions here: each call is one HTTP request, and PostgREST has
    no way to hold one open across several. Anything that has to be atomic
    across more than one row belongs in a Postgres function, called through
    `rpc()`, where the function body IS the transaction.

    Read paths port cleanly. Writes that span tables do not, and pretending
    otherwise is how stock ends up decremented for an order that was never
    created.

THE KEY
    service_role, which bypasses row-level security. That is required rather
    than lazy: RLS is enabled on all 36 tables with no policies, which denies
    everything, and that is the control keeping PostgREST shut to the public
    anon key. The API is the only thing that should read these tables.

    So the key is equivalent to full database access. It is read from the
    environment, never logged, and never sent anywhere but Supabase.

THE FAILURE MODE TO KNOW ABOUT
    A filter that matches nothing and a filter that is WRONG both return `[]`
    with a 200. There is no error to catch. A ported read with a mistake in it
    looks exactly like an empty catalogue, so `select_one` and callers that
    require rows should say so rather than trusting the shape.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("nivisa")

# PostgREST is not fast the way a local socket is - every query is a TLS round
# trip to another region. Long enough to absorb that, short enough that a
# hung request does not hold a worker forever.
TIMEOUT = httpx.Timeout(20.0, connect=10.0)


class SupabaseError(RuntimeError):
    """A PostgREST call that did not return what it was asked for."""

    def __init__(self, message: str, *, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


def _require_settings() -> tuple[str, str]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise SupabaseError(
            "DATA_BACKEND=supabase needs SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY. See docs/CPANEL-SUPABASE-HTTP.md."
        )
    return settings.SUPABASE_URL.rstrip("/"), settings.SUPABASE_SERVICE_ROLE_KEY


def _headers(key: str) -> dict[str, str]:
    # Both headers, with the same value. PostgREST authenticates on
    # Authorization; the Supabase gateway in front of it routes on apikey, and
    # omitting either gets you a 401 that says nothing about which.
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


async def _request(method: str, path: str, headers: dict[str, str] | None = None, **kwargs: Any) -> Any:
    base, key = _require_settings()
    url = f"{base}/rest/v1/{path.lstrip('/')}"
    merged = {**_headers(key), **(headers or {})}

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            response = await client.request(method, url, headers=merged, **kwargs)
        except httpx.HTTPError as exc:
            # The box could not reach Supabase at all. Distinct from a query
            # that came back empty, and the caller usually wants to know.
            raise SupabaseError(f"Could not reach Supabase: {exc}") from exc

    if response.status_code >= 400:
        # The body carries PostgREST's own message, which names the column or
        # the constraint. Worth surfacing - the status alone is not enough to
        # tell a bad filter from a missing grant.
        raise SupabaseError(
            f"{method} {path} failed: HTTP {response.status_code} {response.text[:300]}",
            status=response.status_code,
        )

    if not response.content:
        return None

    # parse_float=Decimal, and it is not optional.
    #
    # PostgREST serialises a numeric column as a bare JSON number, so a price
    # of 124000.00 arrives as the token `124000.00` and Python's json turns it
    # into the float 124000.0. Money in floats is how a total ends up a paisa
    # out and nobody can say which line did it. Decimal here means every
    # numeric - prices, tax rates, discounts, shipping - reaches the pricing
    # code in the same type it has in the database.
    return response.json(parse_float=Decimal)


async def select(
    table: str,
    *,
    columns: str = "*",
    order: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
    **filters: str,
) -> list[dict[str, Any]]:
    """Rows from a table.

    Filters are PostgREST's own syntax, passed through as given, so a caller
    writes `is_active="eq.true"` rather than learning a second dialect on top
    of the one PostgREST already has.
    """
    params: dict[str, str] = {"select": columns, **filters}
    if order:
        params["order"] = order
    if limit is not None:
        params["limit"] = str(limit)
    if offset is not None:
        params["offset"] = str(offset)

    rows = await _request("GET", table, params=params)
    return rows or []


async def select_one(table: str, **kwargs: Any) -> dict[str, Any] | None:
    rows = await select(table, limit=1, **kwargs)
    return rows[0] if rows else None


async def insert(table: str, data: dict[str, Any]) -> dict[str, Any]:
    """Insert one row and return it.

    `Prefer: return=representation` because the caller almost always needs the
    generated id, and asking for it back is one request where fetching it
    afterwards is two - and the second one has to guess how to find the row it
    just wrote.
    """
    rows = await _request(
        "POST", table, json=data, headers={"Prefer": "return=representation"}
    )
    if not rows:
        raise SupabaseError(f"INSERT into {table} returned no row")
    return rows[0]


async def rpc(function: str, payload: dict[str, Any] | None = None) -> Any:
    """Call a Postgres function.

    This is where anything transactional goes. A function body runs in a
    single transaction, so a write spanning several tables is atomic here in
    the way it cannot be across separate PostgREST calls.
    """
    return await _request("POST", f"rpc/{function}", json=payload or {})


async def health() -> tuple[bool, str]:
    """Whether PostgREST answers, for /api/v1/health/db.

    Asks for one id from a table that always has rows rather than hitting the
    root: the root replies even when the key is wrong for the tables, and a
    health check that passes while every query returns [] is worse than none.
    """
    try:
        await select("categories", columns="id", limit=1)
    except SupabaseError as exc:
        return False, str(exc)
    return True, "ok"
