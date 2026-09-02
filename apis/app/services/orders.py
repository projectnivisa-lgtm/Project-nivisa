"""Checkout, stock movement and the fulfilment ladder."""
import logging
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.catalog import InventoryMovement, Product, ProductVariant
from app.models.commerce import (
    FULFILMENT_FLOW, Cart, CartItem, Coupon, CouponRedemption, Order, OrderEvent,
    OrderItem,
)
from app.models.customer import Address, Customer
from app.services import catalog as catalog_service
from app.services.cart import load_variants
from app.services.pricing import money, quote

logger = logging.getLogger(__name__)


async def next_order_number(db: AsyncSession) -> str:
    """NIV-<year>-<zero-padded sequence>.

    Derived from a per-year count rather than the primary key, so the number
    does not leak how many orders the shop has ever taken, and restarts
    cleanly each January.
    """
    year = datetime.now(timezone.utc).year
    prefix = f"NIV-{year}-"
    highest = await db.scalar(
        select(func.max(Order.order_number)).where(Order.order_number.like(f"{prefix}%"))
    )
    sequence = int(highest.rsplit("-", 1)[1]) + 1 if highest else 1
    return f"{prefix}{sequence:06d}"


async def adjust_stock(
    db: AsyncSession,
    variant: ProductVariant,
    *,
    delta: int,
    reason: str,
    order_id: int | None = None,
    staff_user_id: int | None = None,
    note: str | None = None,
) -> None:
    """Move stock and record why, in one place.

    Every caller goes through here so `inventory_movements` is a complete
    ledger; a direct write to `stock_quantity` anywhere else would leave a
    balance nobody can reconcile.
    """
    variant.stock_quantity = max(0, variant.stock_quantity + delta)
    db.add(
        InventoryMovement(
            variant_id=variant.id,
            delta=delta,
            balance_after=variant.stock_quantity,
            reason=reason,
            order_id=order_id,
            staff_user_id=staff_user_id,
            note=note,
        )
    )


def address_snapshot(address: Address) -> dict:
    return {
        "full_name": address.full_name,
        "phone": address.phone,
        "line1": address.line1,
        "line2": address.line2,
        "landmark": address.landmark,
        "city": address.city,
        "state": address.state,
        "postal_code": address.postal_code,
        "country": address.country,
    }


async def place_order(
    db: AsyncSession,
    *,
    customer: Customer,
    cart: Cart,
    shipping_address: Address,
    billing_address: Address | None,
    customer_note: str | None,
) -> Order:
    """Turn a cart into an unpaid order.

    Stock is reserved here, at order creation, not at payment. An order that
    exists but is never paid is recoverable - it expires or is cancelled and
    the stock comes back. Overselling the last piece of a made-to-order sofa
    while a customer sits on a payment screen is not.
    """
    if not cart.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your cart is empty.")

    variants = await load_variants(db, [i.variant_id for i in cart.items])

    for item in cart.items:
        variant = variants.get(item.variant_id)
        if variant is None or not variant.is_active:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "One of the pieces in your cart is no longer available. Please review your cart.",
            )
        if not variant.backorder_allowed and variant.stock_quantity < item.quantity:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Only {variant.stock_quantity} of {variant.product.name} left. Please adjust the quantity.",
            )

    priced = await quote(
        db,
        items=[(variants[i.variant_id], i.quantity) for i in cart.items],
        coupon_code=cart.coupon_code,
        customer_id=customer.id,
        postal_code=shipping_address.postal_code,
    )

    order = Order(
        order_number=await next_order_number(db),
        customer_id=customer.id,
        fulfilment_status="pending",
        payment_status="pending",
        subtotal=priced.subtotal,
        discount_total=priced.discount_total,
        shipping_total=priced.shipping_total,
        tax_total=priced.tax_total,
        grand_total=priced.grand_total,
        currency=settings.CURRENCY,
        coupon_code=priced.coupon_code,
        shipping_address=address_snapshot(shipping_address),
        billing_address=address_snapshot(billing_address) if billing_address else None,
        customer_note=customer_note,
        placed_at=datetime.now(timezone.utc),
    )
    db.add(order)
    await db.flush()

    by_variant = {line.variant_id: line for line in priced.lines}
    for item in cart.items:
        variant = variants[item.variant_id]
        product = variant.product
        line = by_variant[variant.id]
        primary = catalog_service.primary_image(product)
        db.add(
            OrderItem(
                order_id=order.id,
                variant_id=variant.id,
                product_id=product.id,
                product_name=product.name,
                variant_label=variant.option_label,
                sku=variant.sku,
                image_url=primary.url if primary else None,
                unit_price=line.unit_price,
                quantity=item.quantity,
                discount_amount=line.discount_amount,
                tax_rate=line.tax_rate,
                tax_amount=line.tax_amount,
                line_total=line.line_total,
            )
        )
        await adjust_stock(
            db, variant, delta=-item.quantity, reason="sale", order_id=order.id,
            note=f"Order {order.order_number}",
        )

    if priced.coupon_code:
        coupon = (
            await db.execute(select(Coupon).where(Coupon.code == priced.coupon_code))
        ).scalars().first()
        if coupon:
            coupon.used_count += 1
            db.add(
                CouponRedemption(
                    coupon_id=coupon.id,
                    customer_id=customer.id,
                    order_id=order.id,
                    amount=priced.discount_total,
                )
            )

    db.add(
        OrderEvent(
            order_id=order.id, kind="status", message="Order placed.",
            to_value="pending", customer_visible=True,
        )
    )

    # The cart is emptied, not deleted: the row is the customer's one open
    # cart and recreating it on the next add is a needless round trip.
    for item in list(cart.items):
        await db.delete(item)
    cart.coupon_code = None

    await db.flush()
    return order


async def load_order(db: AsyncSession, order_id: int) -> Order | None:
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.events), selectinload(Order.payments))
        .where(Order.id == order_id)
    )
    return result.scalars().first()


async def mark_paid(db: AsyncSession, order: Order, *, reference: str, method: str | None) -> None:
    if order.payment_status == "paid":
        return  # a gateway that calls back twice must not double-record
    order.payment_status = "paid"
    order.paid_at = datetime.now(timezone.utc)
    if order.fulfilment_status == "pending":
        order.fulfilment_status = "processing"
    db.add(
        OrderEvent(
            order_id=order.id, kind="payment",
            message=f"Payment received ({method or 'online'}), reference {reference}.",
            to_value="paid", customer_visible=True,
        )
    )


def can_transition(current: str, target: str) -> bool:
    return target in FULFILMENT_FLOW.get(current, ())


async def transition(
    db: AsyncSession,
    order: Order,
    *,
    target: str,
    staff_id: int | None,
    staff_name: str | None,
    note: str | None = None,
    notify_customer: bool = True,
) -> None:
    """Advance an order one legal step.

    The flow table is the only authority. Refusing an illegal jump here -
    rather than trusting the dashboard to only offer legal buttons - is what
    stops a stale browser tab from marking an already-cancelled order
    dispatched.
    """
    current = order.fulfilment_status
    if current == target:
        return
    if not can_transition(current, target):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"An order that is {current} cannot become {target}.",
        )

    order.fulfilment_status = target
    now = datetime.now(timezone.utc)
    if target == "dispatched":
        order.dispatched_at = now
    elif target == "delivered":
        order.delivered_at = now
    elif target == "cancelled":
        order.cancelled_at = now

    db.add(
        OrderEvent(
            order_id=order.id, kind="status",
            message=note or f"Marked {target}.",
            from_value=current, to_value=target,
            staff_user_id=staff_id, staff_name=staff_name,
            customer_visible=notify_customer,
        )
    )


async def cancel_order(
    db: AsyncSession,
    order: Order,
    *,
    reason: str,
    restock: bool,
    staff_id: int | None = None,
    staff_name: str | None = None,
) -> None:
    if order.fulfilment_status in ("cancelled", "returned"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This order is already closed.")
    if order.fulfilment_status in ("dispatched", "delivered"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This order has already left the warehouse. Record a return instead.",
        )

    order.fulfilment_status = "cancelled"
    order.cancelled_at = datetime.now(timezone.utc)
    order.cancellation_reason = reason

    if restock:
        variants = await load_variants(db, [i.variant_id for i in order.items if i.variant_id])
        for item in order.items:
            variant = variants.get(item.variant_id) if item.variant_id else None
            if variant:
                await adjust_stock(
                    db, variant, delta=item.quantity, reason="cancellation",
                    order_id=order.id, staff_user_id=staff_id,
                    note=f"Cancelled {order.order_number}",
                )

    db.add(
        OrderEvent(
            order_id=order.id, kind="status", message=f"Cancelled: {reason}",
            from_value=order.fulfilment_status, to_value="cancelled",
            staff_user_id=staff_id, staff_name=staff_name, customer_visible=True,
        )
    )


async def record_refund(
    db: AsyncSession,
    order: Order,
    *,
    amount: Decimal,
    reason: str,
    staff_id: int | None,
    staff_name: str | None,
) -> None:
    if order.payment_status not in ("paid", "partially_refunded"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a paid order can be refunded.")

    outstanding = money(order.grand_total - order.refunded_total)
    if amount > outstanding:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"At most {outstanding} is left to refund on this order.",
        )

    order.refunded_total = money(order.refunded_total + amount)
    order.payment_status = "refunded" if order.refunded_total >= order.grand_total else "partially_refunded"

    db.add(
        OrderEvent(
            order_id=order.id, kind="payment",
            message=f"Refunded {amount}: {reason}",
            to_value=order.payment_status,
            staff_user_id=staff_id, staff_name=staff_name, customer_visible=True,
        )
    )
