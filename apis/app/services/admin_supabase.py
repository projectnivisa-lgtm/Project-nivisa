"""Admin list screens, over PostgREST.

The straightforward half of the admin API: the screens that are a table read
from one table, ordered, sometimes filtered, sometimes paged. Those port
almost mechanically, because PostgREST does exactly that well.

WHAT IS NOT HERE
    Anything that aggregates across tables - the product list, the customer
    list with lifetime spend, the order list, the reports - lives in a
    Postgres function under apis/sql/ and is called through rpc(). PostgREST
    has no SUM and no GROUP BY, and faking them by fetching every row to add
    it up in Python is a screen that works on seed data and falls over on a
    real catalogue.

COUNTS ON SMALL TABLES
    The category and collection screens show a product count per row. Those
    tables have dozens of rows, not thousands, and the admin screen always
    wants the whole shape, so the counting is done here over one extra fetch
    rather than in SQL. The same trick would be wrong for the product list,
    which is why that one is a function.
"""
from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from typing import Any

from app.core import supabase
from app.schemas.catalog import (
    AttributeOut,
    CategoryTree,
    CollectionOut,
    ReviewOut,
)
from app.schemas.commerce import CouponOut, ShippingRateOut
from app.schemas.common import Page
from app.schemas.content import BannerOut, HomepageSectionOut, PageOut, SettingOut
from app.schemas.identity import RoleOut

# Products in any state but archived count towards a category's total, which
# is what the taxonomy screen shows: a draft product still occupies the
# category as far as a merchandiser reorganising the tree is concerned.
_COUNTABLE = "neq.archived"


async def _product_counts_by_category() -> dict[int, int]:
    rows = await supabase.select("products", columns="category_id", status=_COUNTABLE)
    counts: dict[int, int] = {}
    for row in rows:
        key = row.get("category_id")
        if key is not None:
            counts[key] = counts.get(key, 0) + 1
    return counts


async def category_tree() -> list[CategoryTree]:
    """The whole tree with product counts.

    Unlike the storefront's version this includes INACTIVE categories: the
    admin screen is where someone reactivates one, and a tree that hides them
    offers no way back.
    """
    rows = await supabase.select(
        "categories",
        columns="id,parent_id,name,slug,description,image_url,position,is_active",
        order="position,name",
    )
    counts = await _product_counts_by_category()

    nodes = {
        row["id"]: CategoryTree.model_validate(
            {**row, "children": [], "product_count": counts.get(row["id"], 0)}
        )
        for row in rows
    }
    roots: list[CategoryTree] = []
    for row in rows:
        parent = nodes.get(row["parent_id"]) if row["parent_id"] else None
        (parent.children if parent else roots).append(nodes[row["id"]])
    return roots


async def collections() -> list[CollectionOut]:
    rows = await supabase.select("collections", order="position,name")
    members = await supabase.select("collection_products", columns="collection_id")
    counts: dict[int, int] = {}
    for row in members:
        key = row["collection_id"]
        counts[key] = counts.get(key, 0) + 1
    return [
        CollectionOut.model_validate({**row, "product_count": counts.get(row["id"], 0)})
        for row in rows
    ]


async def attributes(kind: str | None) -> list[AttributeOut]:
    filters = {"kind": f"eq.{kind}"} if kind else {}
    rows = await supabase.select(
        "attributes", order="kind,position,name", **filters
    )
    return [AttributeOut.model_validate(row) for row in rows]


async def roles() -> list[RoleOut]:
    rows = await supabase.select("roles", order="is_system.desc,name")
    staff = await supabase.select("staff_users", columns="role_id")
    counts: dict[int, int] = {}
    for row in staff:
        key = row.get("role_id")
        if key is not None:
            counts[key] = counts.get(key, 0) + 1
    return [
        RoleOut.model_validate({**row, "staff_count": counts.get(row["id"], 0)})
        for row in rows
    ]


async def coupons() -> list[CouponOut]:
    rows = await supabase.select("coupons", order="created_at.desc")
    return [CouponOut.model_validate(row) for row in rows]


async def shipping_rates() -> list[ShippingRateOut]:
    rows = await supabase.select("shipping_rates", order="position")
    return [ShippingRateOut.model_validate(row) for row in rows]


async def reviews(
    *, status: str | None, product_id: int | None, rating: int | None,
    limit: int, offset: int,
) -> Page[ReviewOut]:
    filters: dict[str, str] = {}
    if status:
        filters["status"] = f"eq.{status}"
    if product_id is not None:
        filters["product_id"] = f"eq.{product_id}"
    if rating is not None:
        filters["rating"] = f"eq.{rating}"

    rows, total = await supabase.select_page(
        "reviews", order="created_at.desc", limit=limit, offset=offset, **filters
    )
    return Page[ReviewOut](
        items=[ReviewOut.model_validate(r) for r in rows],
        total=total, limit=limit, offset=offset,
    )


async def pages() -> list[PageOut]:
    rows = await supabase.select("pages", order="is_system.desc,title")
    return [PageOut.model_validate(row) for row in rows]


async def page(slug: str) -> dict[str, Any] | None:
    return await supabase.select_one("pages", slug=f"eq.{slug}")


async def banners(placement: str | None) -> list[BannerOut]:
    filters = {"placement": f"eq.{placement}"} if placement else {}
    rows = await supabase.select("banners", order="placement,position", **filters)
    return [BannerOut.model_validate(row) for row in rows]


async def homepage_sections() -> list[HomepageSectionOut]:
    rows = await supabase.select("homepage_sections", order="position")
    return [HomepageSectionOut.model_validate(row) for row in rows]


async def settings_rows() -> list[SettingOut]:
    rows = await supabase.select("settings", order="group,key")
    return [SettingOut.model_validate(row) for row in rows]


async def staff(
    *, q: str | None, role_id: int | None, is_active: bool | None,
    limit: int, offset: int,
) -> tuple[list[dict[str, Any]], int]:
    """Staff rows and the total, left as dicts for the route to shape.

    The route builds StaffOut itself because it also resolves each row's role,
    and duplicating that here would be two places to change when the row grows
    a field.
    """
    filters: dict[str, str] = {}
    if q:
        term = q.strip()
        # PostgREST's `or` takes its own comma-separated syntax; `*` is its
        # wildcard rather than SQL's `%`.
        filters["or"] = f"(name.ilike.*{term}*,email.ilike.*{term}*)"
    if role_id is not None:
        filters["role_id"] = f"eq.{role_id}"
    if is_active is not None:
        filters["is_active"] = f"eq.{str(is_active).lower()}"

    return await supabase.select_page(
        "staff_users",
        columns="id,name,email,phone,role_id,is_active,last_login_at,"
                "must_change_password,created_at,roles(id,slug,name)",
        order="name",
        limit=limit,
        offset=offset,
        **filters,
    )


async def audit_logs(
    *, action: str | None, entity: str | None, actor_id: int | None,
    date_from: str | None, date_to: str | None, limit: int, offset: int,
) -> tuple[list[dict[str, Any]], int]:
    """Audit rows and the total.

    The date bounds are inclusive of the whole end day: `lt` the day after,
    rather than `lte` the day itself, which would stop at midnight and hide
    everything that happened during the last day of the range.
    """
    filters: dict[str, str] = {}
    if action:
        filters["action"] = f"eq.{action}"
    if entity:
        filters["entity"] = f"eq.{entity}"
    if actor_id is not None:
        filters["actor_id"] = f"eq.{actor_id}"
    if date_from:
        filters["created_at"] = f"gte.{date_from}"
    if date_to:
        # Two conditions on one column need PostgREST's `and`, because a dict
        # cannot carry the same key twice.
        lower = f"created_at.gte.{date_from}," if date_from else ""
        filters.pop("created_at", None)
        filters["and"] = f"({lower}created_at.lt.{date_to})"

    # Named explicitly, not `select *`. The endpoint exposes twelve fields and
    # the table has more - user_agent and response_status among them - so a
    # wildcard here would quietly widen what the audit screen discloses.
    rows, total = await supabase.select_page(
        "audit_logs",
        columns="id,created_at,actor_id,actor_name,actor_email,action,"
                "entity,entity_id,summary,changes,ip_address,status",
        order="created_at.desc,id.desc",
        limit=limit, offset=offset, **filters,
    )
    return rows, total


async def customer_detail(customer_id: int) -> dict[str, Any] | None:
    """One customer, their live addresses and their recent orders.

    Archived addresses are filtered out here rather than fetched and dropped,
    which the SQLAlchemy version does in Python only because the relationship
    was already loaded.
    """
    customer = await supabase.select_one("customers", id=f"eq.{customer_id}")
    if customer is None:
        return None

    addresses = await supabase.select(
        "addresses", customer_id=f"eq.{customer_id}",
        is_archived="eq.false",
        # Matches Customer.addresses' order_by: default first, then id.
        order="is_default.desc,id",
    )
    orders = await supabase.select(
        "orders",
        columns="id,order_number,fulfilment_status,payment_status,grand_total,"
                "currency,placed_at,created_at,order_items(quantity)",
        customer_id=f"eq.{customer_id}",
        order="created_at.desc,id.desc",
        limit=50,
    )
    return {"customer": customer, "addresses": addresses, "orders": orders}


# Everything catalog.to_admin_detail reaches for, with the relations embedded.
_PRODUCT_DETAIL_SELECT = (
    "*,"
    "product_variants(*),"
    "product_images(*),"
    "categories(*),"
    "brands(*),"
    "product_rooms(rooms(*)),"
    "product_attributes(attributes(*))"
)


def _product_as_object(row: dict[str, Any]) -> SimpleNamespace:
    """A PostgREST product shaped like the mapped one.

    catalog.to_admin_detail is forty lines of mapping shared with the
    storefront, and it reads its input by attribute - `product.variants`,
    `v.is_active`, `v.__dict__`. Wrapping the row lets that code run unchanged
    rather than existing twice, which is the difference between one definition
    of a product's shape and two that drift.

    PostgREST names an embed after the table, and a many-to-many arrives
    wrapped in its join row, so both are unwrapped here to the names the
    mappers expect.
    """
    def variant(v: dict[str, Any]) -> SimpleNamespace:
        obj = SimpleNamespace(**v)
        # in_stock is a property on the mapped class, so it does not exist in
        # the row and has to be recomputed from the two columns behind it.
        obj.in_stock = bool(v.get("backorder_allowed")) or (v.get("stock_quantity") or 0) > 0
        return obj

    variants = sorted(
        (variant(v) for v in row.get("product_variants") or []),
        key=lambda v: (v.position if v.position is not None else 0, v.id),
    )
    images = sorted(
        (SimpleNamespace(**i) for i in row.get("product_images") or []),
        key=lambda i: (i.position if i.position is not None else 0, i.id),
    )

    product = SimpleNamespace(**{
        k: v for k, v in row.items()
        if k not in ("product_variants", "product_images", "categories", "brands",
                     "product_rooms", "product_attributes")
    })
    product.variants = variants
    product.images = images
    product.category = SimpleNamespace(**row["categories"]) if row.get("categories") else None
    product.brand = SimpleNamespace(**row["brands"]) if row.get("brands") else None
    product.rooms = [
        SimpleNamespace(**link["rooms"])
        for link in (row.get("product_rooms") or []) if link.get("rooms")
    ]
    product.attributes = [
        SimpleNamespace(**link["attributes"])
        for link in (row.get("product_attributes") or []) if link.get("attributes")
    ]
    return product


async def product_detail(product_id: int) -> SimpleNamespace | None:
    row = await supabase.select_one(
        "products", columns=_PRODUCT_DETAIL_SELECT, id=f"eq.{product_id}"
    )
    return _product_as_object(row) if row else None


async def order_detail(order_id: int) -> SimpleNamespace | None:
    """One order, wrapped so app.admin.routes.orders._detail runs unchanged.

    Item and event ordering matches the relationships they stand in for -
    items by id, events by created_at - so the invoice reads the same on both
    backends.
    """
    row = await supabase.select_one(
        "orders",
        columns="*,order_items(*),order_events(*),customers(id,name,phone,email)",
        id=f"eq.{order_id}",
    )
    if row is None:
        return None

    order = SimpleNamespace(**{
        k: v for k, v in row.items()
        if k not in ("order_items", "order_events", "customers")
    })
    order.items = [
        SimpleNamespace(**i)
        for i in sorted(row.get("order_items") or [], key=lambda i: i["id"])
    ]
    order.events = [
        SimpleNamespace(**e)
        for e in sorted(row.get("order_events") or [],
                        key=lambda e: (e.get("created_at") or "", e["id"]))
    ]
    order.customer = SimpleNamespace(**row["customers"]) if row.get("customers") else None
    # A property on the mapped class, so absent from the row.
    order.is_cancellable_by_customer = (
        row.get("payment_status") == "pending"
        and row.get("fulfilment_status") in ("pending", "processing")
    )
    return order


async def orders_for_export(
    *, q: str | None, fulfilment: str | None, payment: str | None,
    date_from: str | None, date_to: str | None,
) -> list[SimpleNamespace]:
    """Every matching order for the CSV, with its customer.

    Capped at the same 10,000 as the SQLAlchemy version. An export that
    silently stops is worse than one that refuses, but matching the existing
    behaviour matters more here than improving it.
    """
    filters: dict[str, str] = {}
    if fulfilment:
        filters["fulfilment_status"] = f"eq.{fulfilment}"
    if payment:
        filters["payment_status"] = f"eq.{payment}"
    conditions = []
    if date_from:
        conditions.append(f"created_at.gte.{date_from}")
    if date_to:
        conditions.append(f"created_at.lt.{date_to}")
    if conditions:
        filters["and"] = "(" + ",".join(conditions) + ")"
    if q:
        filters["or"] = (
            f"(order_number.ilike.*{q}*,"
            f"customers.name.ilike.*{q}*,customers.phone.ilike.*{q}*)"
        )

    rows = await supabase.select(
        "orders",
        columns="*,customers(name,phone)",
        order="created_at.desc,id.desc",
        limit=10_000,
        **filters,
    )
    out = []
    for row in rows:
        order = SimpleNamespace(**{k: v for k, v in row.items() if k != "customers"})
        order.customer = SimpleNamespace(**row["customers"]) if row.get("customers") else None
        # PostgREST hands back timestamps as strings, and the CSV writer calls
        # .isoformat() on this one. Parsed here rather than special-cased at
        # the call site, so the object behaves like the mapped row it stands
        # in for.
        if isinstance(order.placed_at, str):
            order.placed_at = datetime.fromisoformat(order.placed_at)
        out.append(order)
    return out
