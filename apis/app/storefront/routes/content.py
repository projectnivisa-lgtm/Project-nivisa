"""Public content: pages, banners, homepage, product reviews."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.catalog import (
    Collection, CollectionProduct, Product, Review, Room,
)
from app.models.content import Banner, HomepageSection, Page as PageModel, Setting
from app.schemas.catalog import ProductCard, ReviewOut
from app.schemas.common import Page
from app.schemas.content import BannerOut, PageOut
from app.services import catalog as catalog_service

router = APIRouter(tags=["Shop · Content"])


@router.get("/store")
async def store_profile(db: AsyncSession = Depends(get_db)):
    """The shop's own details: name, phone, email, address.

    Served from the settings staff edit, so the footer and the contact page
    show the number that is actually answered rather than one hardcoded into
    two front ends and changed in neither.

    Only the public profile is exposed - the settings table also holds
    checkout and tax rules, which are nobody's business but the shop's.
    """
    from app.models.commerce import ShippingRate

    rows = {
        row.key: row.value
        for row in (
            await db.execute(
                select(Setting).where(Setting.key.in_(("store_profile", "storefront_content")))
            )
        ).scalars().all()
    }
    profile = rows.get("store_profile") or {}
    content = rows.get("storefront_content") or {}

    # The free-delivery threshold is DERIVED, not configured. It is the lowest
    # `free_above` across the live shipping zones, so the banner and the cart
    # quote the rule that will actually price the order. A second copy of the
    # number in a settings row is a copy that goes stale the day someone edits
    # a zone.
    threshold = await db.scalar(
        select(func.min(ShippingRate.free_above)).where(
            ShippingRate.is_active.is_(True), ShippingRate.free_above.isnot(None)
        )
    )

    return {
        "name": profile.get("name") or settings.STORE_NAME,
        "email": profile.get("email") or settings.STORE_EMAIL,
        "phone": profile.get("phone") or settings.STORE_PHONE,
        "address": profile.get("address") or None,
        "gstin": profile.get("gstin") or None,
        "free_delivery_above": float(threshold) if threshold is not None else None,
        # Null means "show no bar" rather than an empty one. A banner with no
        # message is a strip of colour nobody can explain.
        "announcement": content.get("announcement") or None,
    }


@router.get("/pages/{slug}", response_model=PageOut)
async def get_page(slug: str, db: AsyncSession = Depends(get_db)):
    row = (
        await db.execute(
            select(PageModel).where(PageModel.slug == slug, PageModel.is_published.is_(True))
        )
    ).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That page does not exist.")
    return PageOut.model_validate(row)


@router.get("/banners", response_model=list[BannerOut])
async def banners(
    placement: str = Query("home_hero"),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(Banner).where(
                Banner.placement == placement,
                Banner.is_active.is_(True),
                # A scheduled banner must not appear early or linger. Nulls
                # mean "no bound", which is why each side needs the is_(None).
                or_(Banner.starts_at.is_(None), Banner.starts_at <= now),
                or_(Banner.ends_at.is_(None), Banner.ends_at >= now),
            ).order_by(Banner.position)
        )
    ).scalars().all()
    return [BannerOut.model_validate(r) for r in rows]


@router.get("/homepage")
async def homepage(db: AsyncSession = Depends(get_db)):
    """The whole front page in one request.

    Each band is resolved server-side - a rail arrives with its products
    already in it. The alternative is one request per band, which on a
    ten-band homepage is ten round trips before anything renders.
    """
    sections = (
        await db.execute(
            select(HomepageSection)
            .where(HomepageSection.is_active.is_(True))
            .order_by(HomepageSection.position)
        )
    ).scalars().all()

    loaded = (
        selectinload(Product.variants), selectinload(Product.images),
        selectinload(Product.category), selectinload(Product.brand),
    )
    output = []

    for section in sections:
        band = {
            "kind": section.kind,
            "title": section.title,
            "subtitle": section.subtitle,
            "config": section.config,
        }

        if section.kind == "collection_rail":
            slug = (section.config or {}).get("collection_slug")
            limit = int((section.config or {}).get("limit", 8))
            rows = (
                await db.execute(
                    select(Product).options(*loaded)
                    .join(CollectionProduct, CollectionProduct.product_id == Product.id)
                    .join(Collection, Collection.id == CollectionProduct.collection_id)
                    .where(Collection.slug == slug, Product.status == "active")
                    .order_by(CollectionProduct.position).limit(limit)
                )
            ).scalars().unique().all()
            ratings = await catalog_service.rating_map(db, [p.id for p in rows])
            band["products"] = [catalog_service.to_card(p, ratings).model_dump() for p in rows]

        elif section.kind == "room_grid":
            rows = (
                await db.execute(
                    select(Room).where(Room.is_active.is_(True)).order_by(Room.position)
                )
            ).scalars().all()
            band["rooms"] = [
                {"id": r.id, "name": r.name, "slug": r.slug, "image_url": r.image_url}
                for r in rows
            ]

        elif section.kind == "banner":
            placement = (section.config or {}).get("placement", "home_hero")
            band["banners"] = [b.model_dump() for b in await banners(placement, db)]

        elif section.kind == "category_grid":
            from app.models.catalog import Category

            rows = (
                await db.execute(
                    select(Category)
                    .where(Category.is_active.is_(True), Category.parent_id.is_(None))
                    .order_by(Category.position, Category.name)
                )
            ).scalars().all()
            band["categories"] = [
                {"id": c.id, "name": c.name, "slug": c.slug, "image_url": c.image_url}
                for c in rows
            ]

        # hero, editorial and trust carry their whole content in `config`, so
        # they need no query - they are here to be listed and ordered like any
        # other band rather than living as hardcoded JSX the shop cannot edit.

        output.append(band)

    return {"sections": output}


@router.get("/products/{product_id}/reviews", response_model=Page[ReviewOut])
async def product_reviews(
    product_id: int,
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Approved reviews, plus the star distribution as an aggregate.

    The distribution is computed in SQL rather than by the client counting a
    fetched page - a client-side histogram silently describes only the first
    ten reviews.
    """
    conditions = (Review.product_id == product_id, Review.status == "approved")

    total = await db.scalar(select(func.count(Review.id)).where(*conditions)) or 0
    rows = (
        await db.execute(
            select(Review).where(*conditions)
            .order_by(Review.created_at.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()

    return Page[ReviewOut](
        items=[ReviewOut.model_validate(r) for r in rows],
        total=total, limit=limit, offset=offset,
    )


@router.get("/products/{product_id}/reviews/summary")
async def review_summary(product_id: int, db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(Review.rating, func.count(Review.id))
            .where(Review.product_id == product_id, Review.status == "approved")
            .group_by(Review.rating)
        )
    ).all()
    distribution = {str(star): 0 for star in range(1, 6)}
    total = 0
    weighted = 0
    for rating, count in rows:
        distribution[str(rating)] = count
        total += count
        weighted += rating * count
    return {
        "average": round(weighted / total, 2) if total else None,
        "count": total,
        "distribution": distribution,
    }


@router.post("/ar/events", status_code=status.HTTP_202_ACCEPTED)
async def record_ar_event(
    payload: dict,
    x_cart_token: str | None = Header(None, alias="X-Cart-Token"),
    db: AsyncSession = Depends(get_db),
):
    """Record that AR was opened, or that a cart add followed it.

    Anonymous and keyed on the browser's own cart token — this measures
    whether AR helps sell, which needs no identity attached to it. Unknown or
    malformed payloads are dropped silently and answered 202: analytics must
    never be able to fail a page, and a client that has to handle an error
    from a fire-and-forget beacon will end up ignoring it anyway.
    """
    from app.models.ar import ArEvent

    kind = payload.get("kind")
    product_id = payload.get("product_id")
    if kind not in ("opened", "added_to_cart") or not isinstance(product_id, int):
        return {"recorded": False}
    if not x_cart_token:
        # Without a session there is nothing to attribute, and counting these
        # would inflate "opened" beyond the sessions that actually exist.
        return {"recorded": False}

    exists = (await db.execute(select(Product.id).where(Product.id == product_id))).first()
    if not exists:
        return {"recorded": False}

    platform = payload.get("platform")
    db.add(
        ArEvent(
            product_id=product_id,
            kind=kind,
            session_token=x_cart_token[:64],
            platform=platform if platform in ("ios", "android", "desktop") else None,
        )
    )
    await db.commit()
    return {"recorded": True}
