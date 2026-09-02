"""The cart, over PostgREST.

The Supabase-backed half of app/services/cart.py, for the cPanel deployment
where the Postgres port is refused. See docs/CPANEL-SUPABASE-HTTP.md.

WHY THE CART CAN CROSS AND CHECKOUT CANNOT
    Everything here is either a read or a single-row write: find a cart, make
    one, change a line's quantity. None of it needs more than one row to
    change together, so the absence of transactions costs nothing.

    Checkout is the opposite - an order, its lines, an event, a redemption,
    stock on every variant and the cart emptied, all or nothing - and it is
    not ported here. It belongs in a Postgres function, where the body is the
    transaction.

WHAT IS SHARED WITH THE POSTGRES PATH
    All the arithmetic. `pricing.quote_with` does the pricing for both
    backends and only the two lookups differ, so a total cannot come out
    differently depending on which transport answered. The same goes for
    `pricing.select_rate` and `pricing.check_coupon`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from app.core import supabase
from app.core.config import settings
from app.schemas.commerce import CartItemOut, CartOut, CartTotals
from app.services import pricing

# Everything CartItemOut and the pricing need from a variant, plus the product
# and its images in the same request. PostgREST embeds across a foreign key,
# so this is one round trip rather than three - which matters here more than
# it did for the catalogue, because the cart is fetched on every page.
_VARIANT_SELECT = (
    "id,sku,option_label,price,tax_rate,stock_quantity,backorder_allowed,"
    "lead_time_days,products(id,name,slug,product_images(url,kind,position))"
)


def _as_object(row: dict[str, Any]) -> SimpleNamespace:
    """A PostgREST row that answers to attribute access.

    The shared pricing helpers reach for `.price`, `.free_above`,
    `.min_order_value` and so on, and were written against mapped classes.
    Wrapping is cheaper and far less error-prone than teaching them to accept
    both, and it keeps the "anything with these attributes" promise their
    docstrings make honest.
    """
    return SimpleNamespace(**row)


def _primary_image(product: dict[str, Any]) -> str | None:
    """A studio shot if there is one, otherwise the first image.

    The same rule as catalog.primary_image, on a dict. Ordering is applied
    here rather than trusted from the embed: PostgREST does not promise an
    order for embedded rows unless it is asked for one, and "the first image"
    silently meaning "whichever came back first" is how two deployments show
    different photographs for the same product.
    """
    images = sorted(
        product.get("product_images") or [],
        key=lambda i: (i.get("position") if i.get("position") is not None else 0, i.get("url") or ""),
    )
    if not images:
        return None
    studio = [i for i in images if i.get("kind") == "studio"]
    return (studio or images)[0].get("url")


async def get_or_create_cart(*, customer_id: int | None, session_token: str | None) -> dict[str, Any]:
    """This visitor's cart, made if it does not exist yet.

    Mirrors cart.get_or_create_cart, including that a customer's cart wins
    over a token's. The newest is taken when there is more than one, which is
    what `order=id.desc` does here and `Cart.id.desc()` does there.
    """
    if customer_id is not None:
        filters = {"customer_id": f"eq.{customer_id}"}
    elif session_token:
        filters = {"session_token": f"eq.{session_token}", "customer_id": "is.null"}
    else:
        raise ValueError("A cart needs either a signed-in customer or a session token.")

    rows = await supabase.select(
        "carts",
        columns="id,customer_id,session_token,coupon_code,cart_items(id,variant_id,quantity)",
        order="id.desc",
        limit=1,
        **filters,
    )
    if rows:
        return rows[0]

    now = datetime.now(timezone.utc).isoformat()
    created = await supabase.insert(
        "carts",
        {
            "customer_id": customer_id,
            "session_token": session_token,
            "created_at": now,
            "updated_at": now,
        },
    )
    # A cart created a moment ago has no lines. Set explicitly so callers can
    # read it without checking whether the embed was present - the same reason
    # the SQLAlchemy path passes items=[].
    created["cart_items"] = []
    return created


async def _load_variants(variant_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not variant_ids:
        return {}
    ids = ",".join(str(i) for i in variant_ids)
    rows = await supabase.select(
        "product_variants", columns=_VARIANT_SELECT, id=f"in.({ids})"
    )
    return {row["id"]: row for row in rows}


def _shipping_lookup(postal_code: str | None):
    """Build the shipping lookup for one request.

    A closure rather than a module-level function carrying the postcode on
    itself: this runs under asyncio and serves many visitors at once, so a
    value parked on the function object is shared mutable state between
    concurrent requests. One customer's postcode would decide another's
    delivery charge, intermittently, under load - the kind of bug that never
    reproduces on a developer's machine.
    """
    async def find_shipping(*, subtotal: Decimal) -> Decimal:
        rates = await supabase.select(
            "shipping_rates",
            columns="id,postcode_prefixes,free_above,rate,position,is_active",
            is_active="eq.true",
            order="position",
        )
        shipping, _rate = pricing.select_rate(
            [_as_object(r) for r in rates], subtotal=subtotal, postal_code=postal_code
        )
        return shipping

    return find_shipping


async def _resolve_coupon(code: str, *, subtotal: Decimal, customer_id: int | None):
    # ilike with no wildcards is case-insensitive equality, which is what
    # `func.lower(Coupon.code) == ...` does on the SQLAlchemy side.
    row = await supabase.select_one("coupons", columns="*", code=f"ilike.{code.strip()}")
    coupon = _as_object(row) if row else None
    if coupon is not None:
        # PostgREST returns timestamps as strings; the checks compare them to
        # an aware datetime, so they have to be parsed or every comparison
        # raises instead of rejecting.
        for field in ("starts_at", "ends_at"):
            value = getattr(coupon, field, None)
            if isinstance(value, str):
                setattr(coupon, field, datetime.fromisoformat(value))

    pricing.check_coupon(coupon, subtotal=subtotal, now=datetime.now(timezone.utc))

    if coupon.usage_limit_per_customer is not None and customer_id is not None:
        used = await supabase.select(
            "coupon_redemptions",
            columns="id",
            coupon_id=f"eq.{coupon.id}",
            customer_id=f"eq.{customer_id}",
        )
        pricing.check_per_customer_limit(coupon, used_by_customer=len(used))
    return coupon


async def serialise(cart: dict[str, Any], *, postal_code: str | None = None) -> CartOut:
    """The same CartOut the SQLAlchemy path returns."""
    lines = cart.get("cart_items") or []
    variants = await _load_variants([line["variant_id"] for line in lines])

    # A variant deleted out from under a cart leaves a dangling line. Drop it
    # rather than 500-ing the cart page.
    live = [line for line in lines if line["variant_id"] in variants]

    async def find_coupon(code: str, *, subtotal: Decimal):
        return await _resolve_coupon(code, subtotal=subtotal, customer_id=cart.get("customer_id"))

    priced = await pricing.quote_with(
        items=[(_as_object(variants[line["variant_id"]]), line["quantity"]) for line in live],
        coupon_code=cart.get("coupon_code"),
        find_coupon=find_coupon,
        find_shipping=_shipping_lookup(postal_code),
    )
    by_variant = {line.variant_id: line for line in priced.lines}

    items: list[CartItemOut] = []
    for line in live:
        variant = variants[line["variant_id"]]
        product = variant.get("products") or {}
        priced_line = by_variant[variant["id"]]
        backorder = bool(variant.get("backorder_allowed"))
        stock = variant.get("stock_quantity") or 0
        items.append(
            CartItemOut(
                id=line["id"],
                variant_id=variant["id"],
                product_id=product.get("id"),
                product_name=product.get("name"),
                product_slug=product.get("slug"),
                variant_label=variant.get("option_label"),
                sku=variant.get("sku"),
                image_url=_primary_image(product),
                unit_price=priced_line.unit_price,
                quantity=line["quantity"],
                line_total=priced_line.line_total,
                # ProductVariant.in_stock is a property, so it does not come
                # back from PostgREST and has to be recomputed from the two
                # columns it is derived from.
                in_stock=backorder or stock > 0,
                available_quantity=99 if backorder else stock,
                lead_time_days=variant.get("lead_time_days"),
            )
        )

    return CartOut(
        id=cart["id"],
        items=items,
        totals=CartTotals(
            subtotal=priced.subtotal,
            discount_total=priced.discount_total,
            shipping_total=priced.shipping_total,
            tax_total=priced.tax_total,
            grand_total=priced.grand_total,
            item_count=priced.item_count,
        ),
        coupon_code=None if priced.coupon_message else cart.get("coupon_code"),
        coupon_message=priced.coupon_message,
        currency=settings.CURRENCY,
    )
