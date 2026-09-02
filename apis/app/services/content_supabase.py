"""Store profile and editable pages, over PostgREST.

The Supabase-backed half of app/storefront/routes/content.py, for the cPanel
deployment where the Postgres port is refused. Same answers, different
transport. See docs/CPANEL-SUPABASE-HTTP.md.

These two endpoints are small but they are on the hot path: the storefront
asks for /store on every page to render the footer and the announcement bar,
so while it 500s the header and footer are wrong everywhere at once.
"""
from __future__ import annotations

from typing import Any

from app.core import supabase
from app.core.config import settings


async def store_profile() -> dict[str, Any]:
    """The shop's public details, plus the derived free-delivery threshold."""
    rows = await supabase.select(
        "settings",
        columns="key,value",
        key="in.(store_profile,storefront_content)",
    )
    values = {row["key"]: (row.get("value") or {}) for row in rows}
    profile = values.get("store_profile") or {}
    content = values.get("storefront_content") or {}

    # The threshold is DERIVED - the lowest `free_above` across live shipping
    # zones - so the banner quotes the rule that will actually price the
    # order. PostgREST has no min(), so the equivalent is to sort ascending
    # and take one, which the index on the column serves just as well.
    #
    # `free_above=not.is.null` is not decoration: nulls sort first ascending
    # in Postgres, so without it the answer is null every time there is a zone
    # that does not offer free delivery.
    cheapest = await supabase.select(
        "shipping_rates",
        columns="free_above",
        is_active="eq.true",
        free_above="not.is.null",
        order="free_above.asc",
        limit=1,
    )
    threshold = cheapest[0]["free_above"] if cheapest else None

    return {
        "name": profile.get("name") or settings.STORE_NAME,
        "email": profile.get("email") or settings.STORE_EMAIL,
        "phone": profile.get("phone") or settings.STORE_PHONE,
        "address": profile.get("address") or None,
        "gstin": profile.get("gstin") or None,
        "free_delivery_above": float(threshold) if threshold is not None else None,
        # Null means "show no bar" rather than an empty one. A banner with no
        # message is a strip of colour nobody can explain.
        "announcement": content.get("announcement") or None,
    }


async def get_page(slug: str) -> dict[str, Any] | None:
    """One published page, or None so the route can raise its own 404.

    Returning None rather than raising keeps the 404 in the route, where the
    Postgres version raises it too - a service that raised HTTP exceptions
    would put the transport in charge of the status code.
    """
    return await supabase.select_one(
        "pages",
        # Every field PageOut requires, named explicitly. PostgREST returns
        # exactly what is asked for, so a column omitted here is not a smaller
        # payload - it is a validation error at the far end of the request,
        # which is how `is_system` was missed the first time.
        columns=(
            "id,slug,title,body,meta_title,meta_description,"
            "is_published,is_system,updated_at"
        ),
        slug=f"eq.{slug}",
        is_published="eq.true",
    )
