"""Customer records, addresses and order history."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import audit
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require
from app.models.commerce import Order
from app.models.customer import Customer
from app.schemas.commerce import OrderSummary
from app.schemas.common import Message, Page
from app.schemas.identity import AddressOut, CustomerAdminRow, CustomerOut

router = APIRouter(prefix="/customers", tags=["Admin · Customers"])


@router.get("", response_model=Page[CustomerAdminRow])
async def list_customers(
    q: str | None = Query(None, description="Name, phone or email"),
    is_active: bool | None = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: AdminPrincipal = Depends(require("customers.read")),
    db: AsyncSession = Depends(get_db),
):
    """Customers with their lifetime figures.

    The order count and spend come from one grouped subquery joined onto the
    page, not a query per row - a customer list is the screen most likely to
    be left open, and an N+1 here is 25 round trips every time it refreshes.
    Cancelled orders are excluded from spend: money that was never taken is
    not revenue, and a "top customer" list built on it is misleading.
    """
    stats = (
        select(
            Order.customer_id.label("customer_id"),
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.grand_total), 0).label("total_spend"),
            func.max(Order.created_at).label("last_order_at"),
        )
        .where(Order.fulfilment_status != "cancelled")
        .group_by(Order.customer_id)
        .subquery()
    )

    query = select(Customer, stats).outerjoin(stats, stats.c.customer_id == Customer.id)
    count_query = select(func.count(Customer.id))

    conditions = []
    if q:
        term = f"%{q.strip()}%"
        conditions.append(
            or_(Customer.name.ilike(term), Customer.phone.ilike(term), Customer.email.ilike(term))
        )
    if is_active is not None:
        conditions.append(Customer.is_active.is_(is_active))
    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)

    total = await db.scalar(count_query) or 0
    rows = (
        await db.execute(query.order_by(Customer.created_at.desc()).limit(limit).offset(offset))
    ).all()

    return Page[CustomerAdminRow](
        items=[
            CustomerAdminRow(
                id=row[0].id, name=row[0].name, phone=row[0].phone, email=row[0].email,
                is_active=row[0].is_active, created_at=row[0].created_at,
                order_count=row.order_count or 0,
                total_spend=float(row.total_spend or 0),
                last_order_at=row.last_order_at,
            )
            for row in rows
        ],
        total=total, limit=limit, offset=offset,
    )


@router.get("/{customer_id}")
async def get_customer(
    customer_id: int,
    _: AdminPrincipal = Depends(require("customers.read")),
    db: AsyncSession = Depends(get_db),
):
    customer = (
        await db.execute(
            select(Customer).options(selectinload(Customer.addresses)).where(Customer.id == customer_id)
        )
    ).scalars().first()
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That customer no longer exists.")

    orders = (
        await db.execute(
            select(Order).options(selectinload(Order.items))
            .where(Order.customer_id == customer_id)
            .order_by(Order.created_at.desc()).limit(50)
        )
    ).scalars().unique().all()

    return {
        "customer": CustomerOut.model_validate(customer).model_dump(),
        "addresses": [
            AddressOut.model_validate(a).model_dump()
            for a in customer.addresses if not a.is_archived
        ],
        "orders": [
            OrderSummary(
                id=o.id, order_number=o.order_number,
                fulfilment_status=o.fulfilment_status, payment_status=o.payment_status,
                grand_total=o.grand_total, currency=o.currency,
                item_count=sum(i.quantity for i in o.items),
                placed_at=o.placed_at, created_at=o.created_at,
            ).model_dump()
            for o in orders
        ],
    }


@router.post("/{customer_id}/status", response_model=Message)
async def set_active(
    customer_id: int,
    active: bool,
    request: Request,
    principal: AdminPrincipal = Depends(require("customers.write")),
    db: AsyncSession = Depends(get_db),
):
    customer = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalars().first()
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That customer no longer exists.")

    before = customer.is_active
    customer.is_active = active
    await audit.record(
        db, action="update", entity="customers", entity_id=customer.id,
        summary=f"{'Reactivated' if active else 'Suspended'} customer {customer.phone}",
        changes={"is_active": [before, active]}, principal=principal, request=request,
    )
    await db.commit()
    return Message(
        message=f"{customer.name or customer.phone} can {'sign in again' if active else 'no longer sign in'}."
    )
