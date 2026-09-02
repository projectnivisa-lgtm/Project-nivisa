"""Order desk: list, detail, fulfilment, dispatch, cancellation, refunds."""
import csv
import io
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import audit, supabase
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require, require_any
from app.models.commerce import FULFILMENT_FLOW, Order, OrderEvent
from app.models.customer import Customer
from app.schemas.commerce import (
    AdminOrderDetail,
    OrderCancel,
    OrderDispatch,
    OrderEventOut,
    OrderItemOut,
    OrderNote,
    OrderRefund,
    OrderStatusUpdate,
    OrderSummary,
)
from app.schemas.common import Page
from app.services import admin_supabase
from app.services import orders as order_service

router = APIRouter(prefix="/orders", tags=["Admin · Orders"])


async def _load(db: AsyncSession, order_id: int) -> Order:
    order = (
        await db.execute(
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.events), selectinload(Order.payments))
            .where(Order.id == order_id)
        )
    ).scalars().first()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That order no longer exists.")
    return order


def _detail(order: Order) -> AdminOrderDetail:
    customer = order.customer
    return AdminOrderDetail(
        **{
            **{k: v for k, v in order.__dict__.items() if not k.startswith("_")},
            "items": [OrderItemOut.model_validate(i) for i in order.items],
            "events": [OrderEventOut.model_validate(e) for e in order.events],
            "is_cancellable": order.is_cancellable_by_customer,
            "customer_name": customer.name if customer else None,
            "customer_phone": customer.phone if customer else None,
            "customer_email": customer.email if customer else None,
            "allowed_transitions": list(FULFILMENT_FLOW.get(order.fulfilment_status, ())),
        }
    )


def _filters(
    q: str | None, fulfilment: str | None, payment: str | None,
    date_from: date | None, date_to: date | None,
):
    conditions = []
    if q:
        term = f"%{q.strip()}%"
        conditions.append(or_(Order.order_number.ilike(term), Customer.phone.ilike(term), Customer.name.ilike(term)))
    if fulfilment:
        conditions.append(Order.fulfilment_status == fulfilment)
    if payment:
        conditions.append(Order.payment_status == payment)
    if date_from:
        conditions.append(Order.created_at >= datetime.combine(date_from, datetime.min.time(), timezone.utc))
    if date_to:
        conditions.append(Order.created_at <= datetime.combine(date_to, datetime.max.time(), timezone.utc))
    return conditions


@router.get("", response_model=Page[OrderSummary])
async def list_orders(
    q: str | None = None,
    fulfilment_status: str | None = None,
    payment_status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: AdminPrincipal = Depends(require("orders.read")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        return await supabase.rpc("nivisa_admin_orders", {
            "p_q": q, "p_fulfilment": fulfilment_status, "p_payment": payment_status,
            "p_date_from": date_from.isoformat() if date_from else None,
            "p_date_to": date_to.isoformat() if date_to else None,
            "p_limit": limit, "p_offset": offset,
        })

    conditions = _filters(q, fulfilment_status, payment_status, date_from, date_to)

    base = select(Order).outerjoin(Customer, Customer.id == Order.customer_id)
    count_query = select(func.count(Order.id)).outerjoin(Customer, Customer.id == Order.customer_id)
    if conditions:
        base = base.where(*conditions)
        count_query = count_query.where(*conditions)

    total = await db.scalar(count_query) or 0
    rows = (
        await db.execute(
            base.options(selectinload(Order.items))
            .order_by(Order.created_at.desc(), Order.id.desc()).limit(limit).offset(offset)
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


@router.get("/queues", response_model=dict)
async def queue_counts(
    _: AdminPrincipal = Depends(require("orders.read")),
    db: AsyncSession = Depends(get_db),
):
    """How many orders sit at each stage.

    The order desk's tabs are driven by this rather than by counting a
    fetched page, so a tab reading "Packed 12" is not silently capped at the
    page size.
    """
    if settings.DATA_BACKEND == "supabase":
        found = await supabase.rpc("nivisa_admin_order_queues")
        # Every stage present even at zero, as below: a tab that vanishes when
        # it empties is one nobody can find again when it fills.
        counts = {name: 0 for name in FULFILMENT_FLOW}
        counts.update(found or {})
        return counts

    rows = (
        await db.execute(select(Order.fulfilment_status, func.count(Order.id)).group_by(Order.fulfilment_status))
    ).all()
    counts = {status_name: 0 for status_name in FULFILMENT_FLOW}
    counts.update({row[0]: row[1] for row in rows})
    counts["awaiting_payment"] = await db.scalar(
        select(func.count(Order.id)).where(
            Order.payment_status == "pending", Order.fulfilment_status == "pending"
        )
    ) or 0
    return counts


@router.get("/export")
async def export_orders(
    q: str | None = None,
    fulfilment_status: str | None = None,
    payment_status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    _: AdminPrincipal = Depends(require_any("reports.export", "orders.read")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        rows = await admin_supabase.orders_for_export(
            q=q, fulfilment=fulfilment_status, payment=payment_status,
            date_from=date_from.isoformat() if date_from else None,
            date_to=(date_to + timedelta(days=1)).isoformat() if date_to else None,
        )
    else:
        conditions = _filters(q, fulfilment_status, payment_status, date_from, date_to)
        query = select(Order).outerjoin(Customer, Customer.id == Order.customer_id)
        if conditions:
            query = query.where(*conditions)
        rows = (
            await db.execute(query.order_by(Order.created_at.desc(), Order.id.desc()).limit(10_000))
        ).scalars().unique().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Order", "Placed", "Customer", "Phone", "Fulfilment", "Payment",
        "Subtotal", "Discount", "Shipping", "Tax", "Total", "Courier", "Tracking",
    ])
    for o in rows:
        writer.writerow([
            o.order_number,
            o.placed_at.isoformat() if o.placed_at else "",
            (o.customer.name if o.customer else "") or "",
            (o.customer.phone if o.customer else "") or "",
            o.fulfilment_status, o.payment_status,
            o.subtotal, o.discount_total, o.shipping_total, o.tax_total, o.grand_total,
            o.courier_name or "", o.tracking_number or "",
        ])
    buffer.seek(0)

    filename = f"nivisa-orders-{date.today():%Y-%m-%d}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{order_id}", response_model=AdminOrderDetail)
async def get_order(
    order_id: int,
    _: AdminPrincipal = Depends(require("orders.read")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        found = await admin_supabase.order_detail(order_id)
        if found is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That order no longer exists.")
        return _detail(found)

    return _detail(await _load(db, order_id))


@router.post("/{order_id}/status", response_model=AdminOrderDetail)
async def update_status(
    order_id: int,
    payload: OrderStatusUpdate,
    request: Request,
    principal: AdminPrincipal = Depends(require("orders.fulfil")),
    db: AsyncSession = Depends(get_db),
):
    order = await _load(db, order_id)
    if payload.status == "cancelled":
        # Cancellation has its own permission and its own restock decision;
        # routing it through the generic status endpoint would bypass both.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Use the cancel action to cancel an order."
        )

    before = order.fulfilment_status
    await order_service.transition(
        db, order, target=payload.status,
        staff_id=principal.user.id, staff_name=principal.user.name,
        note=payload.note, notify_customer=payload.notify_customer,
    )
    await audit.record(
        db, action="update", entity="orders", entity_id=order.id,
        summary=f"{order.order_number}: {before} to {payload.status}",
        changes={"fulfilment_status": [before, payload.status]},
        principal=principal, request=request,
    )
    await db.commit()
    return _detail(await _load(db, order_id))


@router.post("/{order_id}/dispatch", response_model=AdminOrderDetail)
async def dispatch(
    order_id: int,
    payload: OrderDispatch,
    request: Request,
    principal: AdminPrincipal = Depends(require("orders.fulfil")),
    db: AsyncSession = Depends(get_db),
):
    """Records the courier and moves the order to dispatched in one step.

    Two steps would let an order be marked dispatched with no tracking
    number, which is precisely the state a customer emails about.
    """
    order = await _load(db, order_id)
    if order.fulfilment_status != "packed":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "An order has to be packed before it can be dispatched.",
        )

    order.courier_name = payload.courier_name
    order.tracking_number = payload.tracking_number
    order.tracking_url = payload.tracking_url
    order.expected_delivery_date = payload.expected_delivery_date

    await order_service.transition(
        db, order, target="dispatched",
        staff_id=principal.user.id, staff_name=principal.user.name,
        note=f"Dispatched via {payload.courier_name}, tracking {payload.tracking_number}.",
    )
    await audit.record(
        db, action="dispatch", entity="orders", entity_id=order.id,
        summary=f"Dispatched {order.order_number} via {payload.courier_name}",
        principal=principal, request=request,
    )
    await db.commit()
    return _detail(await _load(db, order_id))


@router.post("/{order_id}/cancel", response_model=AdminOrderDetail)
async def cancel(
    order_id: int,
    payload: OrderCancel,
    request: Request,
    principal: AdminPrincipal = Depends(require("orders.cancel")),
    db: AsyncSession = Depends(get_db),
):
    order = await _load(db, order_id)
    await order_service.cancel_order(
        db, order, reason=payload.reason, restock=payload.restock,
        staff_id=principal.user.id, staff_name=principal.user.name,
    )
    await audit.record(
        db, action="cancel", entity="orders", entity_id=order.id,
        summary=f"Cancelled {order.order_number}: {payload.reason}",
        principal=principal, request=request,
    )
    await db.commit()
    return _detail(await _load(db, order_id))


@router.post("/{order_id}/refund", response_model=AdminOrderDetail)
async def refund(
    order_id: int,
    payload: OrderRefund,
    request: Request,
    principal: AdminPrincipal = Depends(require("orders.refund")),
    db: AsyncSession = Depends(get_db),
):
    """Records a refund against the order.

    Deliberately a record, not a gateway call: the money is moved in the
    payment provider's own console, and this makes the shop's books agree
    with it. Wiring the provider's refund API in is a change here alone -
    `PaymentProvider.refund` already exists for it.
    """
    order = await _load(db, order_id)
    await order_service.record_refund(
        db, order, amount=payload.amount, reason=payload.reason,
        staff_id=principal.user.id, staff_name=principal.user.name,
    )
    await audit.record(
        db, action="refund", entity="orders", entity_id=order.id,
        summary=f"Refunded {payload.amount} on {order.order_number}",
        principal=principal, request=request,
    )
    await db.commit()
    return _detail(await _load(db, order_id))


@router.post("/{order_id}/note", response_model=AdminOrderDetail)
async def add_note(
    order_id: int,
    payload: OrderNote,
    principal: AdminPrincipal = Depends(require("orders.read")),
    db: AsyncSession = Depends(get_db),
):
    """An internal note. Never shown to the customer."""
    order = await _load(db, order_id)
    order.staff_note = payload.note
    db.add(
        OrderEvent(
            order_id=order.id, kind="note", message=payload.note,
            staff_user_id=principal.user.id, staff_name=principal.user.name,
            customer_visible=False,
        )
    )
    await db.commit()
    return _detail(await _load(db, order_id))
