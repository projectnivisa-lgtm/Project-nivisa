"""Dashboard, reports and the audit log.

Every figure here comes from an aggregate over real rows. Nothing is
estimated, and there is no placeholder metric: a dashboard that shows a
plausible-looking number nobody can trace is worse than a dashboard with one
fewer tile.
"""
import csv
import io
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import Date, cast, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import supabase
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require
from app.models.catalog import Product, ProductVariant, Review
from app.models.commerce import Order, OrderItem
from app.models.customer import Customer
from app.models.system import AuditLog
from app.schemas.common import Page
from app.services import admin_supabase

router = APIRouter(tags=["Admin · Insights"])

# Cancelled orders are excluded from every revenue figure. Counting money
# that was refunded or never taken makes a dashboard that disagrees with the
# bank.
REVENUE_FILTER = (Order.fulfilment_status != "cancelled", Order.payment_status.in_(("paid", "partially_refunded")))


def _window(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


@router.get("/dashboard")
async def dashboard(
    days: int = Query(30, ge=1, le=365),
    _: AdminPrincipal = Depends(require("dashboard.view")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        # One RPC, not eight queries. PostgREST has no SUM or GROUP BY, and
        # doing the arithmetic here would mean fetching every order over
        # HTTPS to add it up - see apis/sql/admin_dashboard.sql.
        return await supabase.rpc("nivisa_admin_dashboard", {"days": days})

    since = _window(days)
    previous_since = since - timedelta(days=days)

    async def revenue_between(start: datetime, end: datetime) -> float:
        value = await db.scalar(
            select(func.coalesce(func.sum(Order.grand_total), 0))
            .where(*REVENUE_FILTER, Order.created_at >= start, Order.created_at < end)
        )
        return float(value or 0)

    now = datetime.now(timezone.utc)
    revenue = await revenue_between(since, now)
    previous_revenue = await revenue_between(previous_since, since)

    order_count = await db.scalar(
        select(func.count(Order.id)).where(Order.created_at >= since, Order.fulfilment_status != "cancelled")
    ) or 0
    paid_count = await db.scalar(
        select(func.count(Order.id)).where(*REVENUE_FILTER, Order.created_at >= since)
    ) or 0
    new_customers = await db.scalar(
        select(func.count(Customer.id)).where(Customer.created_at >= since)
    ) or 0

    # Daily series for the chart, with gaps filled in Python. A day with no
    # orders must render as zero, not be missing - a line chart that skips
    # empty days misstates the slope.
    rows = (
        await db.execute(
            select(
                cast(Order.created_at, Date).label("day"),
                func.count(Order.id),
                func.coalesce(func.sum(Order.grand_total), 0),
            )
            .where(Order.created_at >= since, Order.fulfilment_status != "cancelled")
            .group_by("day").order_by("day")
        )
    ).all()
    by_day = {row[0]: (row[1], float(row[2])) for row in rows}
    series = []
    cursor = since.date()
    while cursor <= now.date():
        count, total = by_day.get(cursor, (0, 0.0))
        series.append({"date": cursor.isoformat(), "orders": count, "revenue": total})
        cursor += timedelta(days=1)

    queue = dict(
        (await db.execute(
            select(Order.fulfilment_status, func.count(Order.id))
            .where(Order.fulfilment_status.in_(("pending", "processing", "packed")))
            .group_by(Order.fulfilment_status)
        )).all()
    )

    low_stock = (
        await db.execute(
            select(Product.id, Product.name, ProductVariant.sku, ProductVariant.stock_quantity)
            .join(ProductVariant, ProductVariant.product_id == Product.id)
            .where(
                ProductVariant.is_active.is_(True),
                ProductVariant.backorder_allowed.is_(False),
                ProductVariant.stock_quantity <= ProductVariant.low_stock_threshold,
                Product.status == "active",
            )
            .order_by(ProductVariant.stock_quantity)
            .limit(10)
        )
    ).all()

    pending_reviews = await db.scalar(
        select(func.count(Review.id)).where(Review.status == "pending")
    ) or 0

    return {
        "window_days": days,
        "revenue": round(revenue, 2),
        "revenue_change_pct": (
            round((revenue - previous_revenue) / previous_revenue * 100, 1)
            if previous_revenue else None  # null, not 0: an infinite rise is not a number
        ),
        "orders": order_count,
        "paid_orders": paid_count,
        "average_order_value": round(revenue / paid_count, 2) if paid_count else 0,
        "new_customers": new_customers,
        "series": series,
        "queue": {
            "pending": queue.get("pending", 0),
            "processing": queue.get("processing", 0),
            "packed": queue.get("packed", 0),
        },
        "low_stock": [
            {"product_id": r[0], "product_name": r[1], "sku": r[2], "stock": r[3]}
            for r in low_stock
        ],
        "pending_reviews": pending_reviews,
    }


async def _sales_rows(db: AsyncSession, date_from: date, date_to: date, granularity: str) -> list[dict]:
    """Shared by the JSON report and the CSV export, so the download can
    never disagree with the table it was downloaded from."""
    start = datetime.combine(date_from, datetime.min.time(), timezone.utc)
    end = datetime.combine(date_to, datetime.max.time(), timezone.utc)
    bucket = func.date_trunc(granularity, Order.created_at).label("bucket")

    rows = (
        await db.execute(
            select(
                bucket,
                func.count(Order.id),
                func.coalesce(func.sum(Order.grand_total), 0),
                func.coalesce(func.sum(Order.discount_total), 0),
                func.coalesce(func.sum(Order.shipping_total), 0),
                func.coalesce(func.sum(Order.tax_total), 0),
            )
            .where(*REVENUE_FILTER, Order.created_at.between(start, end))
            .group_by("bucket").order_by("bucket")
        )
    ).all()

    return [
        {
            "period": row[0].date().isoformat(),
            "orders": row[1],
            "revenue": float(row[2]),
            "discount": float(row[3]),
            "shipping": float(row[4]),
            "tax": float(row[5]),
        }
        for row in rows
    ]


@router.get("/reports/sales")
async def sales_report(
    date_from: date,
    date_to: date,
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    _: AdminPrincipal = Depends(require("reports.view")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        rows = await supabase.rpc("nivisa_admin_sales", {
            "p_from": date_from.isoformat(), "p_to": date_to.isoformat(),
            "p_granularity": granularity,
        })
    else:
        rows = await _sales_rows(db, date_from, date_to, granularity)

    return {
        "granularity": granularity,
        "from": date_from.isoformat(),
        "to": date_to.isoformat(),
        "rows": rows,
    }


@router.get("/reports/top-products")
async def top_products(
    date_from: date,
    date_to: date,
    limit: int = Query(20, ge=1, le=100),
    _: AdminPrincipal = Depends(require("reports.view")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        return await supabase.rpc("nivisa_admin_top_products", {
            "p_from": date_from.isoformat(), "p_to": date_to.isoformat(),
            "p_limit": limit,
        })

    start = datetime.combine(date_from, datetime.min.time(), timezone.utc)
    end = datetime.combine(date_to, datetime.max.time(), timezone.utc)

    rows = (
        await db.execute(
            select(
                OrderItem.product_id,
                OrderItem.product_name,
                func.sum(OrderItem.quantity).label("units"),
                func.sum(OrderItem.line_total).label("revenue"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .where(*REVENUE_FILTER, Order.created_at.between(start, end))
            .group_by(OrderItem.product_id, OrderItem.product_name)
            .order_by(desc("revenue")).limit(limit)
        )
    ).all()

    return [
        {"product_id": r[0], "name": r[1], "units": int(r[2]), "revenue": float(r[3])}
        for r in rows
    ]


@router.get("/reports/top-customers")
async def top_customers(
    date_from: date,
    date_to: date,
    limit: int = Query(20, ge=1, le=100),
    _: AdminPrincipal = Depends(require("reports.view")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        return await supabase.rpc("nivisa_admin_top_customers", {
            "p_from": date_from.isoformat(), "p_to": date_to.isoformat(),
            "p_limit": limit,
        })

    start = datetime.combine(date_from, datetime.min.time(), timezone.utc)
    end = datetime.combine(date_to, datetime.max.time(), timezone.utc)

    rows = (
        await db.execute(
            select(
                Customer.id, Customer.name, Customer.phone,
                func.count(Order.id).label("orders"),
                func.coalesce(func.sum(Order.grand_total), 0).label("spend"),
            )
            .join(Order, Order.customer_id == Customer.id)
            .where(*REVENUE_FILTER, Order.created_at.between(start, end))
            .group_by(Customer.id).order_by(desc("spend")).limit(limit)
        )
    ).all()

    return [
        {"customer_id": r[0], "name": r[1], "phone": r[2], "orders": r[3], "spend": float(r[4])}
        for r in rows
    ]


@router.get("/reports/inventory")
async def inventory_report(
    _: AdminPrincipal = Depends(require("reports.view")),
    db: AsyncSession = Depends(get_db),
):
    """Stock on hand and what it is worth at cost.

    Valued at cost price where one is recorded; variants without a cost are
    counted separately rather than valued at zero, which would understate
    the holding and look like a smaller problem than it is.
    """
    if settings.DATA_BACKEND == "supabase":
        return await supabase.rpc("nivisa_admin_inventory")

    rows = (
        await db.execute(
            select(
                Product.id, Product.name, ProductVariant.sku,
                ProductVariant.stock_quantity, ProductVariant.cost_price, ProductVariant.price,
            )
            .join(ProductVariant, ProductVariant.product_id == Product.id)
            .where(Product.status != "archived", ProductVariant.is_active.is_(True))
            .order_by(Product.name)
        )
    ).all()

    valued = sum(float(r[4] or 0) * r[3] for r in rows if r[4] is not None)
    uncosted = sum(1 for r in rows if r[4] is None and r[3] > 0)

    return {
        "total_units": sum(r[3] for r in rows),
        "stock_value_at_cost": round(valued, 2),
        "variants_without_cost": uncosted,
        "rows": [
            {
                "product_id": r[0], "product_name": r[1], "sku": r[2],
                "stock": r[3],
                "cost_price": float(r[4]) if r[4] is not None else None,
                "price": float(r[5]),
            }
            for r in rows
        ],
    }


@router.get("/reports/sales.csv")
async def sales_csv(
    date_from: date,
    date_to: date,
    _: AdminPrincipal = Depends(require("reports.export")),
    db: AsyncSession = Depends(get_db),
):
    # The same rows the JSON report returns, by construction: the download
    # disagreeing with the table it was downloaded from is the one failure a
    # sales export must not have.
    if settings.DATA_BACKEND == "supabase":
        rows = await supabase.rpc("nivisa_admin_sales", {
            "p_from": date_from.isoformat(), "p_to": date_to.isoformat(),
            "p_granularity": "day",
        })
    else:
        rows = await _sales_rows(db, date_from, date_to, "day")

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Date", "Orders", "Revenue", "Discount", "Shipping", "Tax"])
    for row in rows:
        writer.writerow([
            row["period"], row["orders"], row["revenue"],
            row["discount"], row["shipping"], row["tax"],
        ])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="nivisa-sales-{date_from}-{date_to}.csv"'},
    )


@router.get("/audit-logs", response_model=Page[dict])
async def audit_logs(
    action: str | None = None,
    entity: str | None = None,
    actor_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: AdminPrincipal = Depends(require("audit.read")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        rows, total = await admin_supabase.audit_logs(
            action=action, entity=entity, actor_id=actor_id,
            date_from=date_from.isoformat() if date_from else None,
            # The day AFTER date_to, so the range covers all of the last day.
            date_to=(date_to + timedelta(days=1)).isoformat() if date_to else None,
            limit=limit, offset=offset,
        )
        return Page[dict](items=rows, total=total, limit=limit, offset=offset)

    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))
    conditions = []
    if action:
        conditions.append(AuditLog.action == action)
    if entity:
        conditions.append(AuditLog.entity == entity)
    if actor_id is not None:
        conditions.append(AuditLog.actor_id == actor_id)
    if date_from:
        conditions.append(AuditLog.created_at >= datetime.combine(date_from, datetime.min.time(), timezone.utc))
    if date_to:
        conditions.append(AuditLog.created_at <= datetime.combine(date_to, datetime.max.time(), timezone.utc))
    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)

    total = await db.scalar(count_query) or 0
    rows = (
        await db.execute(query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset))
    ).scalars().all()

    return Page[dict](
        items=[
            {
                "id": r.id,
                "created_at": r.created_at.isoformat(),
                "actor_id": r.actor_id,
                "actor_name": r.actor_name,
                "actor_email": r.actor_email,
                "action": r.action,
                "entity": r.entity,
                "entity_id": r.entity_id,
                "summary": r.summary,
                "changes": r.changes,
                "ip_address": r.ip_address,
                "status": r.status,
            }
            for r in rows
        ],
        total=total, limit=limit, offset=offset,
    )
