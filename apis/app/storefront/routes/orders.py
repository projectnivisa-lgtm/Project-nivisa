"""Checkout, payment and the customer's own orders."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import get_current_customer
from app.models.commerce import Order, OrderItem, Payment
from app.models.customer import Address, Customer
from app.providers.payments import get_payment_provider
from app.schemas.commerce import (
    CheckoutRequest, OrderCancel, OrderDetail, OrderItemOut, OrderSummary,
    PaymentSessionOut,
)
from app.schemas.common import Page
from app.services import cart as cart_service
from app.services import orders as order_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/orders", tags=["Shop · Orders"])


def _detail(order: Order) -> OrderDetail:
    return OrderDetail(
        **{
            **{k: v for k, v in order.__dict__.items() if not k.startswith("_")},
            "items": [OrderItemOut.model_validate(i) for i in order.items],
            "is_cancellable": order.is_cancellable_by_customer,
        }
    )


async def _own_order(db: AsyncSession, customer: Customer, order_number: str) -> Order:
    order = (
        await db.execute(
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.payments))
            .where(Order.order_number == order_number, Order.customer_id == customer.id)
        )
    ).scalars().first()
    # Scoped by customer_id, so another customer's order number is a 404
    # rather than a readable order. Order numbers are guessable by design.
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We could not find that order.")
    return order


@router.post("", response_model=OrderDetail, status_code=status.HTTP_201_CREATED)
async def checkout(
    payload: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    shipping = (
        await db.execute(
            select(Address).where(
                Address.id == payload.shipping_address_id,
                Address.customer_id == customer.id,
                Address.is_archived.is_(False),
            )
        )
    ).scalars().first()
    if shipping is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a delivery address.")

    billing = None
    if payload.billing_address_id:
        billing = (
            await db.execute(
                select(Address).where(
                    Address.id == payload.billing_address_id, Address.customer_id == customer.id
                )
            )
        ).scalars().first()

    cart = await cart_service.get_or_create_cart(db, customer_id=customer.id, session_token=None)
    order = await order_service.place_order(
        db, customer=customer, cart=cart,
        shipping_address=shipping, billing_address=billing,
        customer_note=payload.customer_note,
    )
    await db.commit()
    return _detail(await order_service.load_order(db, order.id))


@router.post("/{order_number}/pay", response_model=PaymentSessionOut)
async def start_payment(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    """Creates a payment session and returns where to send the browser.

    A POST that returns a URL, rather than a GET the browser follows with a
    token in the query string. A session token in a URL ends up in browser
    history, in the Referer sent to the gateway, and in every proxy log
    between here and there.
    """
    order = await _own_order(db, customer, order_number)
    if order.payment_status == "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "This order is already paid.")
    if order.fulfilment_status == "cancelled":
        raise HTTPException(status.HTTP_409_CONFLICT, "This order was cancelled.")

    provider = get_payment_provider()
    session = await provider.create_session(
        order_number=order.order_number, amount=order.grand_total, customer_phone=customer.phone,
    )
    db.add(
        Payment(
            order_id=order.id, provider=session.provider, provider_reference=session.reference,
            amount=order.grand_total, status="initiated",
        )
    )
    await db.commit()
    return PaymentSessionOut(
        order_number=order.order_number, reference=session.reference,
        redirect_url=session.redirect_url, provider=session.provider,
    )


@router.get("/{order_number}", response_model=OrderDetail)
async def get_order(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    """Reading an order is also what confirms payment.

    A gateway returns the browser with no outcome in the URL, so for an
    unpaid order with a payment in flight this re-checks with the provider
    server-to-server and self-heals. The client therefore needs one call
    after the redirect, not a polling loop.
    """
    order = await _own_order(db, customer, order_number)

    if order.payment_status == "pending":
        in_flight = next((p for p in order.payments if p.status == "initiated"), None)
        if in_flight and in_flight.provider_reference:
            try:
                result = await get_payment_provider().verify(
                    reference=in_flight.provider_reference, order_number=order.order_number
                )
            except Exception:
                # A gateway that is down must not stop a customer reading
                # their own order.
                logger.exception("Payment verification failed for %s", order.order_number)
            else:
                in_flight.raw_response = result.raw
                if result.succeeded:
                    in_flight.status = "succeeded"
                    in_flight.method = result.method
                    await order_service.mark_paid(
                        db, order, reference=result.reference, method=result.method
                    )
                    await db.commit()
                    await db.refresh(order)
                elif result.failure_reason:
                    # A reported failure. No reason means the gateway has not
                    # decided yet - the customer may still be on the payment
                    # screen, and marking the order failed underneath them
                    # would strand a payment that is about to succeed.
                    in_flight.status = "failed"
                    in_flight.failure_reason = result.failure_reason
                    order.payment_status = "failed"
                    await db.commit()
                    await db.refresh(order)

    return _detail(order)


@router.get("", response_model=Page[OrderSummary])
async def my_orders(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    total = await db.scalar(
        select(func.count(Order.id)).where(Order.customer_id == customer.id)
    ) or 0
    rows = (
        await db.execute(
            select(Order).options(selectinload(Order.items))
            .where(Order.customer_id == customer.id)
            .order_by(Order.created_at.desc()).limit(limit).offset(offset)
        )
    ).scalars().unique().all()

    return Page[OrderSummary](
        items=[
            OrderSummary(
                id=o.id, order_number=o.order_number,
                fulfilment_status=o.fulfilment_status, payment_status=o.payment_status,
                grand_total=o.grand_total, currency=o.currency,
                item_count=sum(i.quantity for i in o.items),
                placed_at=o.placed_at, created_at=o.created_at,
            )
            for o in rows
        ],
        total=total, limit=limit, offset=offset,
    )


@router.post("/{order_number}/cancel", response_model=OrderDetail)
async def cancel_own_order(
    order_number: str,
    payload: OrderCancel,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    order = await _own_order(db, customer, order_number)
    if not order.is_cancellable_by_customer:
        # A paid order is cancelled by staff so the refund is handled
        # deliberately rather than as a side effect of a button.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This order can no longer be cancelled here. Please contact us and we will help.",
        )
    await order_service.cancel_order(db, order, reason=payload.reason, restock=True)
    await db.commit()
    return _detail(await order_service.load_order(db, order.id))
