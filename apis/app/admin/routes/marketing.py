"""Coupons, shipping rates and review moderation."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require
from app.models.catalog import Product, Review
from app.models.commerce import Coupon, ShippingRate
from app.schemas.catalog import ReviewModeration, ReviewOut
from app.schemas.commerce import CouponOut, CouponWrite, ShippingRateOut, ShippingRateWrite
from app.schemas.common import Message, Page

router = APIRouter(tags=["Admin · Marketing"])


# --- Coupons ----------------------------------------------------------------


@router.get("/coupons", response_model=list[CouponOut])
async def list_coupons(
    _: AdminPrincipal = Depends(require("coupons.read")),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))).scalars().all()
    return [CouponOut.model_validate(row) for row in rows]


@router.post("/coupons", response_model=CouponOut, status_code=status.HTTP_201_CREATED)
async def create_coupon(
    payload: CouponWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("coupons.write")),
    db: AsyncSession = Depends(get_db),
):
    code = payload.code.strip().upper()
    if (await db.execute(select(Coupon.id).where(func.upper(Coupon.code) == code))).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Coupon {code} already exists.")

    if payload.discount_type == "percent" and payload.discount_value > 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A percentage discount cannot exceed 100%.")
    if payload.starts_at and payload.ends_at and payload.ends_at <= payload.starts_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The end date must be after the start date.")

    row = Coupon(**{**payload.model_dump(), "code": code})
    db.add(row)
    await db.flush()
    await audit.record(
        db, action="create", entity="coupons", entity_id=row.id,
        summary=f"Created coupon {code}", principal=principal, request=request,
    )
    await db.commit()
    return CouponOut.model_validate(row)


@router.put("/coupons/{coupon_id}", response_model=CouponOut)
async def update_coupon(
    coupon_id: int,
    payload: CouponWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("coupons.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Coupon).where(Coupon.id == coupon_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That coupon no longer exists.")

    before = {"code": row.code, "discount_value": str(row.discount_value), "is_active": row.is_active}
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    row.code = payload.code.strip().upper()

    await audit.record(
        db, action="update", entity="coupons", entity_id=row.id,
        summary=f"Updated coupon {row.code}",
        changes=audit.diff(before, {
            "code": row.code, "discount_value": str(row.discount_value), "is_active": row.is_active,
        }),
        principal=principal, request=request,
    )
    await db.commit()
    return CouponOut.model_validate(row)


@router.delete("/coupons/{coupon_id}", response_model=Message)
async def deactivate_coupon(
    coupon_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("coupons.write")),
    db: AsyncSession = Depends(get_db),
):
    """Deactivates rather than deletes - redemption rows reference it, and
    they are how a past order's discount is explained."""
    row = (await db.execute(select(Coupon).where(Coupon.id == coupon_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That coupon no longer exists.")
    row.is_active = False
    await audit.record(
        db, action="deactivate", entity="coupons", entity_id=row.id,
        summary=f"Deactivated coupon {row.code}", principal=principal, request=request,
    )
    await db.commit()
    return Message(message=f"Coupon {row.code} is no longer accepted.")


# --- Shipping ---------------------------------------------------------------


@router.get("/shipping-rates", response_model=list[ShippingRateOut])
async def list_rates(
    _: AdminPrincipal = Depends(require("coupons.read")),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(select(ShippingRate).order_by(ShippingRate.position))).scalars().all()
    return [ShippingRateOut.model_validate(row) for row in rows]


@router.post("/shipping-rates", response_model=ShippingRateOut, status_code=status.HTTP_201_CREATED)
async def create_rate(
    payload: ShippingRateWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("settings.write")),
    db: AsyncSession = Depends(get_db),
):
    row = ShippingRate(**payload.model_dump())
    db.add(row)
    await db.flush()
    await audit.record(
        db, action="create", entity="shipping_rates", entity_id=row.id,
        summary=f"Created shipping rate {row.name}", principal=principal, request=request,
    )
    await db.commit()
    return ShippingRateOut.model_validate(row)


@router.put("/shipping-rates/{rate_id}", response_model=ShippingRateOut)
async def update_rate(
    rate_id: int,
    payload: ShippingRateWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("settings.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(ShippingRate).where(ShippingRate.id == rate_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That rate no longer exists.")
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    await audit.record(
        db, action="update", entity="shipping_rates", entity_id=row.id,
        summary=f"Updated shipping rate {row.name}", principal=principal, request=request,
    )
    await db.commit()
    return ShippingRateOut.model_validate(row)


@router.delete("/shipping-rates/{rate_id}", response_model=Message)
async def delete_rate(
    rate_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("settings.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(ShippingRate).where(ShippingRate.id == rate_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That rate no longer exists.")
    await audit.record(
        db, action="delete", entity="shipping_rates", entity_id=row.id,
        summary=f"Deleted shipping rate {row.name}", principal=principal, request=request,
    )
    await db.delete(row)
    await db.commit()
    return Message(message=f"{row.name} deleted.")


# --- Reviews ----------------------------------------------------------------


@router.get("/reviews", response_model=Page[ReviewOut])
async def list_reviews(
    status_filter: str | None = Query(None, alias="status"),
    product_id: int | None = None,
    rating: int | None = Query(None, ge=1, le=5),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: AdminPrincipal = Depends(require("reviews.moderate")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Review)
    count_query = select(func.count(Review.id))
    conditions = []
    if status_filter:
        conditions.append(Review.status == status_filter)
    if product_id is not None:
        conditions.append(Review.product_id == product_id)
    if rating is not None:
        conditions.append(Review.rating == rating)
    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)

    total = await db.scalar(count_query) or 0
    rows = (
        await db.execute(query.order_by(Review.created_at.desc()).limit(limit).offset(offset))
    ).scalars().all()
    return Page[ReviewOut](
        items=[ReviewOut.model_validate(r) for r in rows], total=total, limit=limit, offset=offset
    )


@router.put("/reviews/{review_id}", response_model=ReviewOut)
async def moderate_review(
    review_id: int,
    payload: ReviewModeration,
    request: Request,
    principal: AdminPrincipal = Depends(require("reviews.moderate")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Review).where(Review.id == review_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That review no longer exists.")

    before = row.status
    if payload.status is not None:
        row.status = payload.status
    if payload.staff_reply is not None:
        row.staff_reply = payload.staff_reply or None

    await audit.record(
        db, action="moderate", entity="reviews", entity_id=row.id,
        summary=f"Review on product {row.product_id}: {before} to {row.status}",
        principal=principal, request=request,
    )
    await db.commit()
    return ReviewOut.model_validate(row)


@router.delete("/reviews/{review_id}", response_model=Message)
async def delete_review(
    review_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("reviews.moderate")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Review).where(Review.id == review_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That review no longer exists.")
    await audit.record(
        db, action="delete", entity="reviews", entity_id=row.id,
        summary=f"Deleted a review on product {row.product_id}",
        principal=principal, request=request,
    )
    await db.delete(row)
    await db.commit()
    return Message(message="Review deleted.")
