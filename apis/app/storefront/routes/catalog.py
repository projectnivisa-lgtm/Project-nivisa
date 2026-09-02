"""The public catalogue: browse, filter, search, product detail."""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import supabase
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import get_optional_customer
from app.models.catalog import (
    Attribute,
    Brand,
    Category,
    Collection,
    CollectionProduct,
    Product,
    ProductAttribute,
    ProductRoom,
    ProductVariant,
    RecentlyViewed,
    Review,
    Room,
)
from app.models.customer import Customer
from app.schemas.catalog import (
    AttributeOut,
    BrandOut,
    CategoryTree,
    CollectionOut,
    ProductCard,
    ProductDetail,
    RoomOut,
)
from app.schemas.common import Page
from app.services import catalog as catalog_service
from app.services import catalog_supabase

router = APIRouter(prefix="/catalog", tags=["Shop · Catalogue"])

_LOADED = (
    selectinload(Product.variants),
    selectinload(Product.images),
    selectinload(Product.category),
    selectinload(Product.brand),
)

# Only active products are ever visible. Drafts and archived rows are staff
# concepts; a customer meeting one is a leak, not a feature.
_VISIBLE = Product.status == "active"


@router.get("/products", response_model=Page[ProductCard])
async def list_products(
    q: str | None = Query(None, min_length=2, description="Free-text search"),
    category: str | None = Query(None, description="Category slug"),
    room: str | None = Query(None, description="Room slug"),
    collection: str | None = Query(None, description="Collection slug"),
    brand: str | None = None,
    material: list[str] | None = Query(None),
    finish: list[str] | None = Query(None),
    colour: list[str] | None = Query(None),
    style: list[str] | None = Query(None),
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    max_width_mm: int | None = Query(None, ge=0, description="Will it fit through the door"),
    seats: int | None = Query(None, ge=1, le=20),
    in_stock: bool | None = None,
    sort: str = Query("featured", description="featured | price_asc | price_desc | newest | rating"),
    limit: int = Query(24, ge=1, le=48),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """One endpoint for the shop, a category page, a room page and search.

    Every filter listed here is genuinely applied. A filter the backend
    cannot honour is not accepted and silently ignored - a chip that claims
    to be narrowing an unfiltered grid is a lie the customer can see.
    """
    if settings.DATA_BACKEND == "supabase":
        found = await supabase.rpc("nivisa_shop_products", {
            "p_q": q, "p_category": category, "p_room": room,
            "p_collection": collection, "p_brand": brand,
            "p_material": material, "p_finish": finish,
            "p_colour": colour, "p_style": style,
            "p_min_price": float(min_price) if min_price is not None else None,
            "p_max_price": float(max_price) if max_price is not None else None,
            "p_max_width_mm": max_width_mm, "p_seats": seats,
            "p_in_stock": in_stock, "p_sort": sort,
            "p_limit": limit, "p_offset": offset,
        })
        # An unknown category slug is a 404, not an unfiltered grid - the same
        # answer the SQLAlchemy path gives, and the difference between "no such
        # page" and "we sell nothing in this room".
        if found.get("category_missing"):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No such category.")

        ids = found.get("ids") or []
        ratings = {
            int(pid): (float(pair[0]), int(pair[1]))
            for pid, pair in (found.get("ratings") or {}).items()
        }
        return Page[ProductCard](
            items=await catalog_supabase.product_cards(ids, ratings),
            total=found.get("total") or 0, limit=limit, offset=offset,
        )

    query = select(Product).options(*_LOADED).where(_VISIBLE)
    count_query = select(func.count(func.distinct(Product.id))).select_from(Product).where(_VISIBLE)
    conditions = []

    if q:
        term = f"%{q.strip()}%"
        conditions.append(or_(Product.name.ilike(term), Product.tagline.ilike(term), Product.description.ilike(term)))

    if category:
        # Includes descendants: browsing "Seating" must show sofas, which sit
        # on the leaf, not on the parent.
        root = (await db.execute(select(Category).where(Category.slug == category))).scalars().first()
        if root is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No such category.")
        ids = {root.id}
        frontier = [root.id]
        while frontier:
            children = (
                await db.execute(select(Category.id).where(Category.parent_id.in_(frontier)))
            ).scalars().all()
            frontier = [c for c in children if c not in ids]
            ids.update(frontier)
        conditions.append(Product.category_id.in_(ids))

    if room:
        conditions.append(
            exists().where(
                and_(
                    ProductRoom.product_id == Product.id,
                    ProductRoom.room_id == select(Room.id).where(Room.slug == room).scalar_subquery(),
                )
            )
        )

    if collection:
        conditions.append(
            exists().where(
                and_(
                    CollectionProduct.product_id == Product.id,
                    CollectionProduct.collection_id
                    == select(Collection.id).where(Collection.slug == collection).scalar_subquery(),
                )
            )
        )

    if brand:
        conditions.append(
            Product.brand_id == select(Brand.id).where(Brand.slug == brand).scalar_subquery()
        )

    # Attribute facets. Within one facet the slugs are OR-ed (oak *or*
    # walnut); across facets they are AND-ed (oak *and* fabric) - which is
    # what a shopper means by ticking two boxes in two different lists.
    for kind, values in (("material", material), ("finish", finish), ("colour", colour), ("style", style)):
        if values:
            conditions.append(
                exists().where(
                    and_(
                        ProductAttribute.product_id == Product.id,
                        ProductAttribute.attribute_id.in_(
                            select(Attribute.id).where(Attribute.kind == kind, Attribute.slug.in_(values))
                        ),
                    )
                )
            )

    variant_conditions = [ProductVariant.is_active.is_(True)]
    if min_price is not None:
        variant_conditions.append(ProductVariant.price >= min_price)
    if max_price is not None:
        variant_conditions.append(ProductVariant.price <= max_price)
    if max_width_mm is not None:
        variant_conditions.append(ProductVariant.width_mm <= max_width_mm)
    if in_stock:
        variant_conditions.append(
            or_(ProductVariant.stock_quantity > 0, ProductVariant.backorder_allowed.is_(True))
        )
    if len(variant_conditions) > 1:
        # The condition is "some variant matches all of these", not "some
        # variant is under the max price and some other one is in stock".
        conditions.append(
            exists().where(and_(ProductVariant.product_id == Product.id, *variant_conditions))
        )

    if seats is not None:
        conditions.append(Product.seating_capacity >= seats)

    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)

    total = await db.scalar(count_query) or 0

    if sort in ("price_asc", "price_desc"):
        # Order by the cheapest active variant, which is the price the card
        # actually shows. Joining and ordering by ProductVariant.price
        # directly would order by whichever row the join happened to pick.
        cheapest = (
            select(func.min(ProductVariant.price))
            .where(ProductVariant.product_id == Product.id, ProductVariant.is_active.is_(True))
            .scalar_subquery()
        )
        # created_at then id after the derived sort, so ties are broken the
        # same way every time. A catalogue seeded in one transaction shares a
        # created_at across dozens of rows, and an ORDER BY with ties is free
        # to return them in any order - which across pages means a product
        # appearing twice, or not at all.
        query = query.order_by(
            cheapest.asc() if sort == "price_asc" else cheapest.desc(),
            Product.created_at.desc(), Product.id.desc(),
        )
    elif sort == "newest":
        query = query.order_by(Product.created_at.desc(), Product.id.desc())
    elif sort == "rating":
        average = (
            select(func.avg(Review.rating))
            .where(Review.product_id == Product.id, Review.status == "approved")
            .scalar_subquery()
        )
        query = query.order_by(
            average.desc().nullslast(), Product.created_at.desc(), Product.id.desc()
        )
    else:
        query = query.order_by(Product.created_at.desc(), Product.id.desc())

    rows = (await db.execute(query.limit(limit).offset(offset))).scalars().unique().all()
    ratings = await catalog_service.rating_map(db, [p.id for p in rows])

    return Page[ProductCard](
        items=[catalog_service.to_card(p, ratings) for p in rows],
        total=total, limit=limit, offset=offset,
    )


@router.get("/products/{slug}", response_model=ProductDetail)
async def get_product(
    slug: str,
    db: AsyncSession = Depends(get_db),
    customer: Customer | None = Depends(get_optional_customer),
):
    if settings.DATA_BACKEND == "supabase":
        from app.services import ar as ar_service

        found = await catalog_supabase.product_detail(slug)
        if found is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "We could not find that piece.")

        # Recording the view is a write, and the customer account screens are
        # not ported yet - so it is skipped rather than half-done. A missing
        # "recently viewed" entry costs a convenience; a half-written one
        # would be a bug to find later.
        ratings = await catalog_supabase.ratings_for([found.id])
        asset = await catalog_supabase.ar_asset_for(found.id)
        return catalog_service.to_detail(
            found, ratings.get(found.id), ar=ar_service.to_public(asset)
        )

    product = (
        await db.execute(
            select(Product)
            .options(*_LOADED, selectinload(Product.rooms), selectinload(Product.attributes))
            .where(Product.slug == slug, _VISIBLE)
        )
    ).scalars().first()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We could not find that piece.")

    if customer:
        existing = (
            await db.execute(
                select(RecentlyViewed).where(
                    RecentlyViewed.customer_id == customer.id, RecentlyViewed.product_id == product.id
                )
            )
        ).scalars().first()
        if existing:
            # Touch rather than insert, so "recently viewed" is ordered by
            # the most recent look rather than the first one.
            existing.updated_at = func.now()
        else:
            db.add(RecentlyViewed(customer_id=customer.id, product_id=product.id))
        await db.commit()

    from app.models.ar import ProductArAsset
    from app.services import ar as ar_service

    ratings = await catalog_service.rating_map(db, [product.id])
    asset = (
        await db.execute(
            select(ProductArAsset).where(ProductArAsset.product_id == product.id)
        )
    ).scalars().first()

    # to_public returns None for anything that is not a published, validated
    # model, so an unfinished or failed asset can never reach the storefront.
    return catalog_service.to_detail(
        product, ratings.get(product.id), ar=ar_service.to_public(asset)
    )


@router.get("/products/{slug}/related", response_model=list[ProductCard])
async def related_products(
    slug: str,
    limit: int = Query(8, ge=1, le=16),
    db: AsyncSession = Depends(get_db),
):
    """Same category, excluding the piece itself.

    Not a recommendation engine, and not presented as one - it is a "more
    like this" rail, which is what the data actually supports.
    """
    product = (await db.execute(select(Product).where(Product.slug == slug, _VISIBLE))).scalars().first()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We could not find that piece.")

    rows = (
        await db.execute(
            select(Product).options(*_LOADED)
            .where(_VISIBLE, Product.id != product.id, Product.category_id == product.category_id)
            .order_by(func.random()).limit(limit)
        )
    ).scalars().unique().all()
    ratings = await catalog_service.rating_map(db, [p.id for p in rows])
    return [catalog_service.to_card(p, ratings) for p in rows]


@router.get("/categories", response_model=list[CategoryTree])
async def categories(db: AsyncSession = Depends(get_db)):
    # The database may not be reachable by the wire protocol at all - see
    # docs/CPANEL-SUPABASE-HTTP.md. `db` is still injected and simply unused
    # on that path; removing the dependency would change the signature for
    # both backends to save one unopened connection.
    if settings.DATA_BACKEND == "supabase":
        return await catalog_supabase.category_tree()

    rows = (
        await db.execute(
            select(Category).where(Category.is_active.is_(True)).order_by(Category.position, Category.name)
        )
    ).scalars().all()
    counts = dict(
        (await db.execute(
            select(Product.category_id, func.count(Product.id))
            .where(_VISIBLE).group_by(Product.category_id)
        )).all()
    )
    nodes = {
        r.id: CategoryTree.model_validate({**r.__dict__, "children": [], "product_count": counts.get(r.id, 0)})
        for r in rows
    }
    roots = []
    for row in rows:
        parent = nodes.get(row.parent_id) if row.parent_id else None
        (parent.children if parent else roots).append(nodes[row.id])
    return roots


@router.get("/rooms", response_model=list[RoomOut])
async def rooms(db: AsyncSession = Depends(get_db)):
    if settings.DATA_BACKEND == "supabase":
        return await catalog_supabase.rooms()

    rows = (
        await db.execute(select(Room).where(Room.is_active.is_(True)).order_by(Room.position, Room.name))
    ).scalars().all()
    return [RoomOut.model_validate(r) for r in rows]


@router.get("/collections", response_model=list[CollectionOut])
async def collections(
    featured_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        rows = await catalog_supabase.collections(featured_only)
        members = await supabase.select("collection_products", columns="collection_id")
        counts: dict[int, int] = {}
        for member in members:
            key = member["collection_id"]
            counts[key] = counts.get(key, 0) + 1
        return [
            CollectionOut.model_validate({**r, "product_count": counts.get(r["id"], 0)})
            for r in rows
        ]

    query = select(Collection).where(Collection.is_active.is_(True))
    if featured_only:
        query = query.where(Collection.is_featured.is_(True))
    rows = (await db.execute(query.order_by(Collection.position, Collection.name))).scalars().all()
    counts = dict(
        (await db.execute(
            select(CollectionProduct.collection_id, func.count(CollectionProduct.product_id))
            .group_by(CollectionProduct.collection_id)
        )).all()
    )
    return [
        CollectionOut.model_validate({**r.__dict__, "product_count": counts.get(r.id, 0)})
        for r in rows
    ]


@router.get("/filters")
async def filter_options(db: AsyncSession = Depends(get_db)):
    """Everything a filter panel needs, in one call.

    Served rather than hardcoded in the frontend so a finish added in the
    dashboard appears as a filter without a frontend release. Only
    attributes that are actually on a visible product are returned - a
    filter that can only ever return nothing is worse than no filter.
    """
    if settings.DATA_BACKEND == "supabase":
        return await supabase.rpc("nivisa_shop_filters")

    used = (
        select(ProductAttribute.attribute_id)
        .join(Product, Product.id == ProductAttribute.product_id)
        .where(_VISIBLE)
    )
    attributes = (
        await db.execute(
            select(Attribute)
            .where(Attribute.is_active.is_(True), Attribute.id.in_(used))
            .order_by(Attribute.kind, Attribute.position, Attribute.name)
        )
    ).scalars().all()

    price_range = (
        await db.execute(
            select(func.min(ProductVariant.price), func.max(ProductVariant.price))
            .join(Product, Product.id == ProductVariant.product_id)
            .where(_VISIBLE, ProductVariant.is_active.is_(True))
        )
    ).first()

    brands = (
        await db.execute(
            select(Brand).where(
                Brand.is_active.is_(True),
                Brand.id.in_(select(Product.brand_id).where(_VISIBLE, Product.brand_id.isnot(None))),
            ).order_by(Brand.name)
        )
    ).scalars().all()

    grouped: dict[str, list] = {}
    for attribute in attributes:
        grouped.setdefault(attribute.kind, []).append(AttributeOut.model_validate(attribute).model_dump())

    return {
        "attributes": grouped,
        "brands": [BrandOut.model_validate(b).model_dump() for b in brands],
        "price": {
            "min": float(price_range[0]) if price_range and price_range[0] is not None else 0,
            "max": float(price_range[1]) if price_range and price_range[1] is not None else 0,
        },
    }


@router.get("/serviceability/{pincode}")
async def serviceability(pincode: str, db: AsyncSession = Depends(get_db)):
    """Can we deliver here, how long will it take, and what does it cost.

    Answered from the shipping zones staff actually maintain, so the estimate
    on a product page is the same rule that will price the order at checkout.
    A city/state lookup would need a PIN-code database this project does not
    have, and inventing one would put a wrong city under a customer's address.
    """
    if not (pincode.isdigit() and len(pincode) == 6):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter a six-digit PIN code.")

    from app.models.commerce import ShippingRate

    rates = (
        await db.execute(
            select(ShippingRate).where(ShippingRate.is_active.is_(True)).order_by(ShippingRate.position)
        )
    ).scalars().all()

    chosen = None
    best = -1
    fallback = None
    for rate in rates:
        prefixes = [p.strip() for p in (rate.postcode_prefixes or "").split(",") if p.strip()]
        if not prefixes:
            fallback = fallback or rate
            continue
        for prefix in prefixes:
            if pincode.startswith(prefix) and len(prefix) > best:
                chosen, best = rate, len(prefix)

    rate = chosen or fallback
    if rate is None:
        # No zone at all is a configuration gap, not a refusal to deliver.
        # Saying "we do not deliver there" would turn a missing row into a
        # lost sale.
        return {"pincode": pincode, "serviceable": True, "zone": None}

    return {
        "pincode": pincode,
        "serviceable": True,
        "zone": rate.name,
        "shipping_fee": float(rate.rate),
        "free_above": float(rate.free_above) if rate.free_above is not None else None,
        "estimated_days_min": rate.estimated_days_min,
        "estimated_days_max": rate.estimated_days_max,
    }
