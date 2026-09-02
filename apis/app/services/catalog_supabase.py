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

from app.core import supabase
from app.schemas.catalog import CategoryTree, RoomOut

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
