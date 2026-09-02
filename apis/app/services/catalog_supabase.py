"""Catalogue reads over PostgREST.

The Supabase-backed half of the storefront catalogue, used when
DATA_BACKEND=supabase because the cPanel box cannot open a Postgres port. The
SQLAlchemy versions in app/storefront/routes/catalog.py stay exactly as they
are and remain the default; this is a second implementation of the same
answers, not a replacement.

WHY BOTH, RATHER THAN ONE THAT BRANCHES INSIDE
    Two backends with genuinely different shapes - one has joins and the other
    has HTTP requests - do not interleave into a single function without that
    function becoming harder to read than either. Kept apart, each is
    obviously correct on its own terms, and the two can be run against the
    same database and compared, which is the only way to port this with any
    confidence.

WHAT TO WATCH FOR
    PostgREST answers a wrong filter the same way it answers a filter that
    matched nothing: 200, and `[]`. There is no exception to catch. So an
    error here does not look like an error, it looks like an empty shop -
    which is why the callers below distinguish "no rows" from "no such
    column" where they can, and why every ported read wants a test that
    asserts rows come back rather than merely that nothing raised.
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from app.core import supabase
from app.schemas.catalog import CategoryTree, ProductCard, RoomOut

# Matches _VISIBLE in the SQLAlchemy routes. Written out rather than imported
# because that one is a SQLAlchemy expression, and the two must be changed
# together - if a second status ever counts as visible, it changes here too.
VISIBLE_STATUS = "active"


async def category_tree() -> list[CategoryTree]:
    """The nested category tree, with a product count on each node.

    Two requests, not one per category. PostgREST has no GROUP BY, so the
    counting is done here: every visible product's category_id comes back in
    one request and is tallied in memory. That is a few hundred integers for
    this catalogue. A per-category count would be twenty-one HTTPS round trips
    for one page, which is the shape of slowness that gets blamed on the
    network rather than on the query.
    """
    rows = await supabase.select(
        "categories",
        columns="id,parent_id,name,slug,description,image_url,position,is_active",
        is_active="eq.true",
        order="position,name",
    )

    product_rows = await supabase.select(
        "products",
        columns="category_id",
        status=f"eq.{VISIBLE_STATUS}",
    )
    counts: dict[int, int] = {}
    for row in product_rows:
        category_id = row.get("category_id")
        if category_id is not None:
            counts[category_id] = counts.get(category_id, 0) + 1

    nodes = {
        row["id"]: CategoryTree.model_validate(
            {**row, "children": [], "product_count": counts.get(row["id"], 0)}
        )
        for row in rows
    }

    roots: list[CategoryTree] = []
    for row in rows:
        parent = nodes.get(row["parent_id"]) if row["parent_id"] else None
        # A child whose parent is inactive has no parent in `nodes` and would
        # vanish entirely if it were simply skipped. It is promoted to a root
        # instead, which is what the SQLAlchemy version does too - `nodes.get`
        # returning None there falls through to the same branch.
        (parent.children if parent else roots).append(nodes[row["id"]])
    return roots


async def rooms() -> list[RoomOut]:
    rows = await supabase.select(
        "rooms",
        columns="id,name,slug,description,image_url,position,is_active",
        is_active="eq.true",
        order="position,name",
    )
    return [RoomOut.model_validate(row) for row in rows]


# Everything catalog.to_card reaches for. Ordering of the embeds is applied in
# Python: PostgREST does not promise an order for embedded rows, and "the first
# image" silently meaning "whichever arrived first" is how the same product
# shows a different photograph on two deployments.
_CARD_SELECT = (
    "id,name,slug,tagline,status,seating_capacity,created_at,"
    "category_id,brand_id,"
    "product_variants(*),product_images(*),categories(*),brands(*)"
)


def product_as_object(row: dict[str, Any]) -> SimpleNamespace:
    """A PostgREST product shaped like the mapped one.

    catalog.to_card builds twenty fields and is shared with every other
    listing; wrapping the row lets it run unchanged rather than being written
    a second time in SQL, where the two would drift.
    """
    def variant(v: dict[str, Any]) -> SimpleNamespace:
        obj = SimpleNamespace(**v)
        # A property on the mapped class, so not a column.
        obj.in_stock = bool(v.get("backorder_allowed")) or (v.get("stock_quantity") or 0) > 0
        return obj

    product = SimpleNamespace(**{
        k: v for k, v in row.items()
        if k not in ("product_variants", "product_images", "categories", "brands")
    })
    product.variants = sorted(
        (variant(v) for v in row.get("product_variants") or []),
        key=lambda v: (v.position if v.position is not None else 0, v.id),
    )
    product.images = sorted(
        (SimpleNamespace(**i) for i in row.get("product_images") or []),
        key=lambda i: (i.position if i.position is not None else 0, i.id),
    )
    product.category = SimpleNamespace(**row["categories"]) if row.get("categories") else None
    product.brand = SimpleNamespace(**row["brands"]) if row.get("brands") else None
    return product


async def products_by_id(ids: list[int]) -> dict[int, SimpleNamespace]:
    if not ids:
        return {}
    rows = await supabase.select(
        "products", columns=_CARD_SELECT,
        id="in.(" + ",".join(str(i) for i in ids) + ")",
    )
    return {row["id"]: product_as_object(row) for row in rows}


async def product_cards(ids: list[int], ratings: dict[int, tuple[float, int]]) -> list[ProductCard]:
    """Cards for a page of ids, IN THE ORDER GIVEN.

    The `in.(...)` filter returns rows in whatever order the database likes,
    so the ordering the function worked out has to be reapplied here - dropping
    it would quietly ignore the customer's sort.
    """
    from app.services import catalog as catalog_service

    found = await products_by_id(ids)
    return [
        catalog_service.to_card(found[i], ratings)
        for i in ids if i in found
    ]


# The detail view needs everything the card does, plus the rooms and attributes
# a product belongs to and the fields only a product page shows.
_DETAIL_SELECT = (
    "*,product_variants(*),product_images(*),categories(*),brands(*),"
    "product_rooms(rooms(*)),product_attributes(attributes(*))"
)


async def product_detail(slug: str) -> SimpleNamespace | None:
    """One visible product by slug, or None so the route can 404.

    `status=eq.active` is applied here, not left to the caller: a draft or
    archived product reaching a customer is a leak, and the safest place for
    that rule is the query rather than a check someone can forget.
    """
    row = await supabase.select_one(
        "products", columns=_DETAIL_SELECT,
        slug=f"eq.{slug}", status=f"eq.{VISIBLE_STATUS}",
    )
    if row is None:
        return None

    product = product_as_object({
        k: v for k, v in row.items()
        if k not in ("product_rooms", "product_attributes")
    })
    product.rooms = [
        SimpleNamespace(**link["rooms"])
        for link in (row.get("product_rooms") or []) if link.get("rooms")
    ]
    product.attributes = [
        SimpleNamespace(**link["attributes"])
        for link in (row.get("product_attributes") or []) if link.get("attributes")
    ]
    return product


async def ratings_for(product_ids: list[int]) -> dict[int, tuple[float, int]]:
    """Approved-review averages, matching catalog.rating_map.

    Aggregated in the application because PostgREST has no GROUP BY. A product
    page asks for one product, so this is a handful of rows; the listing gets
    its ratings from the SQL function instead, where the page could be
    twenty-four products at once.
    """
    if not product_ids:
        return {}
    rows = await supabase.select(
        "reviews", columns="product_id,rating",
        product_id="in.(" + ",".join(str(i) for i in product_ids) + ")",
        status="eq.approved",
    )
    buckets: dict[int, list[float]] = {}
    for row in rows:
        buckets.setdefault(row["product_id"], []).append(float(row["rating"]))
    return {
        pid: (round(sum(vals) / len(vals), 2), len(vals))
        for pid, vals in buckets.items()
    }


async def ar_asset_for(product_id: int) -> SimpleNamespace | None:
    row = await supabase.select_one("product_ar_assets", product_id=f"eq.{product_id}")
    if row is None:
        return None
    asset = SimpleNamespace(**row)
    # A property on the mapped class, so not a column.
    asset.has_any_model = bool(row.get("model_url") or row.get("ios_model_url"))
    return asset


async def collections(featured_only: bool) -> list[dict[str, Any]]:
    filters = {"is_featured": "eq.true"} if featured_only else {}
    return await supabase.select(
        "collections", is_active="eq.true", order="position,name", **filters
    )
