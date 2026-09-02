"""Cart reads and writes."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.catalog import Product, ProductVariant
from app.models.commerce import Cart, CartItem
from app.schemas.commerce import CartItemOut, CartOut, CartTotals
from app.services import catalog as catalog_service
from app.services.pricing import quote


async def get_or_create_cart(
    db: AsyncSession, *, customer_id: int | None, session_token: str | None
) -> Cart:
    query = select(Cart).options(selectinload(Cart.items))
    if customer_id is not None:
        query = query.where(Cart.customer_id == customer_id)
    elif session_token:
        query = query.where(Cart.session_token == session_token, Cart.customer_id.is_(None))
    else:
        raise ValueError("A cart needs either a signed-in customer or a session token.")

    cart = (await db.execute(query.order_by(Cart.id.desc()))).scalars().first()
    if cart is None:
        # Assigned empty so SQLAlchemy treats the collection as loaded, the
        # same reason create_product does it. lazy="selectin" is a strategy
        # for a row that was QUERIED; this one is constructed, so after the
        # flush `items` is unloaded and serialise's first read of it emits a
        # lazy load, which raises MissingGreenlet under asyncio.
        #
        # Empty is also the truth for a cart created a line ago. The branch
        # above was always fine, which is what hid this: it needs a visitor
        # with no cart yet, and the storefront asks for the cart on every
        # page, so it was a 500 on the first page load of every new session.
        cart = Cart(customer_id=customer_id, session_token=session_token, items=[])
        db.add(cart)
        await db.flush()
    return cart


async def merge_guest_cart(db: AsyncSession, *, customer_id: int, session_token: str) -> None:
    """Fold an anonymous cart into the customer's on sign-in.

    Quantities are summed rather than replaced: someone who added a chair
    before signing in and had two already meant to have three, and silently
    dropping either side is the version they will notice.
    """
    guest = (
        await db.execute(
            select(Cart)
            .options(selectinload(Cart.items))
            .where(Cart.session_token == session_token, Cart.customer_id.is_(None))
        )
    ).scalars().first()
    if guest is None or not guest.items:
        return

    owned = await get_or_create_cart(db, customer_id=customer_id, session_token=None)
    existing = {item.variant_id: item for item in owned.items}

    for item in guest.items:
        if item.variant_id in existing:
            existing[item.variant_id].quantity = min(99, existing[item.variant_id].quantity + item.quantity)
        else:
            db.add(CartItem(cart_id=owned.id, variant_id=item.variant_id, quantity=item.quantity))

    owned.coupon_code = owned.coupon_code or guest.coupon_code
    await db.delete(guest)
    await db.flush()


async def load_variants(db: AsyncSession, variant_ids: list[int]) -> dict[int, ProductVariant]:
    if not variant_ids:
        return {}
    result = await db.execute(
        select(ProductVariant)
        .options(selectinload(ProductVariant.product).selectinload(Product.images))
        .where(ProductVariant.id.in_(variant_ids))
    )
    return {v.id: v for v in result.scalars().all()}


async def serialise(db: AsyncSession, cart: Cart, *, postal_code: str | None = None) -> CartOut:
    variants = await load_variants(db, [i.variant_id for i in cart.items])

    # A variant deleted out from under a cart leaves a dangling line. Drop it
    # rather than 500-ing the cart page.
    live_items = [i for i in cart.items if i.variant_id in variants]

    priced = await quote(
        db,
        items=[(variants[i.variant_id], i.quantity) for i in live_items],
        coupon_code=cart.coupon_code,
        customer_id=cart.customer_id,
        postal_code=postal_code,
    )
    by_variant = {line.variant_id: line for line in priced.lines}

    items: list[CartItemOut] = []
    for item in live_items:
        variant = variants[item.variant_id]
        product = variant.product
        line = by_variant[variant.id]
        primary = catalog_service.primary_image(product)
        items.append(
            CartItemOut(
                id=item.id,
                variant_id=variant.id,
                product_id=product.id,
                product_name=product.name,
                product_slug=product.slug,
                variant_label=variant.option_label,
                sku=variant.sku,
                image_url=primary.url if primary else None,
                unit_price=line.unit_price,
                quantity=item.quantity,
                line_total=line.line_total,
                in_stock=variant.in_stock,
                available_quantity=99 if variant.backorder_allowed else variant.stock_quantity,
                lead_time_days=variant.lead_time_days,
            )
        )

    # The coupon is cleared from the cart once it has stopped being valid, so
    # the customer is not shown a code that will fail again at checkout.
    if cart.coupon_code and priced.coupon_message:
        cart.coupon_code = None

    return CartOut(
        id=cart.id,
        items=items,
        totals=CartTotals(
            subtotal=priced.subtotal,
            discount_total=priced.discount_total,
            shipping_total=priced.shipping_total,
            tax_total=priced.tax_total,
            grand_total=priced.grand_total,
            item_count=priced.item_count,
        ),
        coupon_code=priced.coupon_code,
        coupon_message=priced.coupon_message,
        currency=settings.CURRENCY,
    )
