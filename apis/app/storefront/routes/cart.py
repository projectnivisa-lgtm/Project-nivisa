"""The cart. Works signed out via an X-Cart-Token header."""
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import get_optional_customer
from app.models.catalog import ProductVariant
from app.models.commerce import CartItem
from app.models.customer import Customer
from app.schemas.commerce import CartItemIn, CartItemQuantity, CartOut, CouponApply
from app.schemas.common import Message
from app.services import cart as cart_service
from app.services import cart_supabase
from app.services.pricing import CouponError, resolve_coupon

router = APIRouter(prefix="/cart", tags=["Shop · Cart"])


async def _resolve(
    db: AsyncSession, customer: Customer | None, token: str | None, response: Response
):
    """Find (or start) this visitor's cart.

    A signed-out visitor gets a token minted here and returned in a response
    header rather than a cookie: the storefront and the API are separate
    origins, and a third-party cookie is blocked by default in every current
    browser.
    """
    if customer is None and not token:
        token = secrets.token_urlsafe(24)
        response.headers["X-Cart-Token"] = token
    cart = await cart_service.get_or_create_cart(
        db, customer_id=customer.id if customer else None, session_token=token
    )
    return cart, token


@router.get("", response_model=CartOut)
async def view_cart(
    response: Response,
    postal_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    customer: Customer | None = Depends(get_optional_customer),
    x_cart_token: str | None = Header(None, alias="X-Cart-Token"),
):
    if settings.DATA_BACKEND == "supabase":
        token = x_cart_token
        if customer is None and not token:
            token = secrets.token_urlsafe(24)
            response.headers["X-Cart-Token"] = token
        sb_cart = await cart_supabase.get_or_create_cart(
            customer_id=customer.id if customer else None, session_token=token
        )
        return await cart_supabase.serialise(sb_cart, postal_code=postal_code)

    cart, _ = await _resolve(db, customer, x_cart_token, response)
    payload = await cart_service.serialise(db, cart, postal_code=postal_code)
    await db.commit()
    return payload


@router.post("/items", response_model=CartOut)
async def add_item(
    payload: CartItemIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
    customer: Customer | None = Depends(get_optional_customer),
    x_cart_token: str | None = Header(None, alias="X-Cart-Token"),
):
    variant = (
        await db.execute(select(ProductVariant).where(ProductVariant.id == payload.variant_id))
    ).scalars().first()
    if variant is None or not variant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That option is no longer available.")

    cart, _ = await _resolve(db, customer, x_cart_token, response)
    existing = (
        await db.execute(
            select(CartItem).where(CartItem.cart_id == cart.id, CartItem.variant_id == variant.id)
        )
    ).scalars().first()

    wanted = (existing.quantity if existing else 0) + payload.quantity
    if not variant.backorder_allowed and wanted > variant.stock_quantity:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Only {variant.stock_quantity} available."
            if variant.stock_quantity else "That piece is out of stock.",
        )

    if existing:
        existing.quantity = wanted
    else:
        db.add(CartItem(cart_id=cart.id, variant_id=variant.id, quantity=payload.quantity))

    await db.flush()
    await db.refresh(cart, ["items"])
    result = await cart_service.serialise(db, cart)
    await db.commit()
    return result


@router.put("/items/{item_id}", response_model=CartOut)
async def update_item(
    item_id: int,
    payload: CartItemQuantity,
    response: Response,
    db: AsyncSession = Depends(get_db),
    customer: Customer | None = Depends(get_optional_customer),
    x_cart_token: str | None = Header(None, alias="X-Cart-Token"),
):
    cart, _ = await _resolve(db, customer, x_cart_token, response)
    item = (
        await db.execute(select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id))
    ).scalars().first()
    # Scoped to this cart, so an id from someone else's cart is a 404 rather
    # than an edit of a stranger's basket.
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That item is not in your cart.")

    variant = (
        await db.execute(select(ProductVariant).where(ProductVariant.id == item.variant_id))
    ).scalars().first()
    if variant and not variant.backorder_allowed and payload.quantity > variant.stock_quantity:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Only {variant.stock_quantity} available.")

    item.quantity = payload.quantity
    await db.flush()
    await db.refresh(cart, ["items"])
    result = await cart_service.serialise(db, cart)
    await db.commit()
    return result


@router.delete("/items/{item_id}", response_model=CartOut)
async def remove_item(
    item_id: int,
    response: Response,
    db: AsyncSession = Depends(get_db),
    customer: Customer | None = Depends(get_optional_customer),
    x_cart_token: str | None = Header(None, alias="X-Cart-Token"),
):
    cart, _ = await _resolve(db, customer, x_cart_token, response)
    item = (
        await db.execute(select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id))
    ).scalars().first()
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That item is not in your cart.")
    await db.delete(item)
    await db.flush()
    await db.refresh(cart, ["items"])
    result = await cart_service.serialise(db, cart)
    await db.commit()
    return result


@router.post("/coupon", response_model=CartOut)
async def apply_coupon(
    payload: CouponApply,
    response: Response,
    db: AsyncSession = Depends(get_db),
    customer: Customer | None = Depends(get_optional_customer),
    x_cart_token: str | None = Header(None, alias="X-Cart-Token"),
):
    """Applies the code and returns the repriced cart.

    Returning the whole cart rather than an acknowledgement is deliberate:
    the discount must never be computed on the client, and a client that has
    to re-fetch to learn the new total will show a stale one in between.
    """
    cart, _ = await _resolve(db, customer, x_cart_token, response)
    priced = await cart_service.serialise(db, cart)

    try:
        coupon = await resolve_coupon(
            db, payload.code, subtotal=priced.totals.subtotal, customer_id=cart.customer_id
        )
    except CouponError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))

    cart.coupon_code = coupon.code
    await db.flush()
    result = await cart_service.serialise(db, cart)
    await db.commit()
    return result


@router.delete("/coupon", response_model=CartOut)
async def remove_coupon(
    response: Response,
    db: AsyncSession = Depends(get_db),
    customer: Customer | None = Depends(get_optional_customer),
    x_cart_token: str | None = Header(None, alias="X-Cart-Token"),
):
    cart, _ = await _resolve(db, customer, x_cart_token, response)
    cart.coupon_code = None
    await db.flush()
    result = await cart_service.serialise(db, cart)
    await db.commit()
    return result


@router.delete("", response_model=Message)
async def clear_cart(
    response: Response,
    db: AsyncSession = Depends(get_db),
    customer: Customer | None = Depends(get_optional_customer),
    x_cart_token: str | None = Header(None, alias="X-Cart-Token"),
):
    cart, _ = await _resolve(db, customer, x_cart_token, response)
    for item in list(cart.items):
        await db.delete(item)
    cart.coupon_code = None
    await db.commit()
    return Message(message="Cart emptied.")
