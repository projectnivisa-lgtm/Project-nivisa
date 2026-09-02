"""Product management."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import audit, supabase
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require
from app.models.ar import ProductArAsset
from app.models.catalog import (
    CollectionProduct,
    Product,
    ProductAttribute,
    ProductImage,
    ProductRoom,
    ProductVariant,
)
from app.schemas.catalog import (
    ProductAdminRow,
    ProductWrite,
    StockAdjustment,
)
from app.schemas.common import Message, Page
from app.services import admin_supabase
from app.services import catalog as catalog_service
from app.services.orders import adjust_stock

router = APIRouter(prefix="/products", tags=["Admin · Products"])

_LOADED = (
    selectinload(Product.variants),
    selectinload(Product.images),
    selectinload(Product.rooms),
    selectinload(Product.attributes),
    selectinload(Product.category),
    selectinload(Product.brand),
)


async def _load(db: AsyncSession, product_id: int) -> Product:
    product = (
        await db.execute(
            select(Product).options(*_LOADED).where(Product.id == product_id)
            # The session keeps objects alive across commit (expire_on_commit
            # is off), and a re-query will NOT refresh a collection that is
            # already populated on the identity-mapped instance. Without
            # this, the response to a create returns the empty variant list
            # the object was constructed with rather than what was written.
            .execution_options(populate_existing=True)
        )
    ).scalars().first()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That product no longer exists.")
    return product


@router.get("", response_model=Page[ProductAdminRow])
async def list_products(
    q: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    category_id: int | None = None,
    brand_id: int | None = None,
    room_id: int | None = None,
    collection_id: int | None = Query(
        None, description="Members of one collection, in the merchandiser's order"
    ),
    stock: str | None = Query(None, description="low | out | in"),
    ar: str | None = Query(
        None,
        description=(
            "missing | processing | ready | failed | deprecated. 'missing' covers "
            "both a product with no AR row and one whose row is 'unavailable' - "
            "to a merchandiser they are the same thing: no model yet."
        ),
    ),
    sort: str = Query("recent", description="recent | name | price_asc | price_desc | stock"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: AdminPrincipal = Depends(require("products.read")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        # One RPC. This endpoint searches across names AND SKUs, filters
        # through three join tables and sorts on values that only exist once
        # variants are aggregated - none of which PostgREST expresses, and a
        # filter it does not understand comes back as 200 and an empty list.
        # See apis/sql/admin_products.sql.
        return await supabase.rpc("nivisa_admin_products", {
            "p_q": q, "p_status": status_filter, "p_category_id": category_id,
            "p_brand_id": brand_id, "p_room_id": room_id,
            "p_collection_id": collection_id, "p_stock": stock, "p_ar": ar,
            "p_sort": sort, "p_limit": limit, "p_offset": offset,
        })

    query = select(Product).options(*_LOADED)
    count_query = select(func.count(func.distinct(Product.id))).select_from(Product)

    filters = []
    if q:
        term = f"%{q.strip()}%"
        # SKU is included because staff search by the number on the box far
        # more often than by the marketing name.
        query = query.outerjoin(ProductVariant, ProductVariant.product_id == Product.id)
        count_query = count_query.outerjoin(ProductVariant, ProductVariant.product_id == Product.id)
        filters.append(or_(Product.name.ilike(term), ProductVariant.sku.ilike(term)))
    if status_filter:
        filters.append(Product.status == status_filter)
    if category_id is not None:
        filters.append(Product.category_id == category_id)
    if brand_id is not None:
        filters.append(Product.brand_id == brand_id)
    if room_id is not None:
        query = query.join(ProductRoom, ProductRoom.product_id == Product.id)
        count_query = count_query.join(ProductRoom, ProductRoom.product_id == Product.id)
        filters.append(ProductRoom.room_id == room_id)

    if collection_id is not None:
        query = query.join(CollectionProduct, CollectionProduct.product_id == Product.id)
        count_query = count_query.join(CollectionProduct, CollectionProduct.product_id == Product.id)
        filters.append(CollectionProduct.collection_id == collection_id)

    if ar:
        # Outer, not inner: "missing" has to include the products that have no
        # AR row at all, and those are the ones the filter is mostly for.
        query = query.outerjoin(ProductArAsset, ProductArAsset.product_id == Product.id)
        count_query = count_query.outerjoin(
            ProductArAsset, ProductArAsset.product_id == Product.id
        )
        if ar == "missing":
            filters.append(
                or_(ProductArAsset.id.is_(None), ProductArAsset.status == "unavailable")
            )
        else:
            filters.append(ProductArAsset.status == ar)

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total = await db.scalar(count_query) or 0

    if collection_id is not None:
        # A collection IS its order - the merchandiser decided what a customer
        # sees first. Returning it sorted any other way would silently discard
        # that, and the curation screen would save the wrong sequence back.
        query = query.order_by(CollectionProduct.position, Product.id)
    else:
        order = {
            "name": Product.name.asc(),
            "recent": Product.updated_at.desc(),
        }.get(sort, Product.updated_at.desc())
        query = query.distinct().order_by(order, Product.id.desc())

    # Stock and price sorting operate on values derived from a product's
    # variants, so they are applied after loading rather than as SQL. The
    # page size is capped at 100, which keeps that honest; if this ever needs
    # to sort a whole catalogue it wants a materialised column, not a bigger
    # fetch.
    if stock or sort in ("price_asc", "price_desc", "stock"):
        rows = (await db.execute(query.limit(500))).scalars().unique().all()
        if stock == "low":
            rows = [p for p in rows if catalog_service.is_low_stock(p)]
        elif stock == "out":
            rows = [p for p in rows if not catalog_service.in_stock(p)]
        elif stock == "in":
            rows = [p for p in rows if catalog_service.in_stock(p)]
        if sort == "price_asc":
            rows.sort(key=catalog_service.price_from)
        elif sort == "price_desc":
            rows.sort(key=catalog_service.price_from, reverse=True)
        elif sort == "stock":
            rows.sort(key=catalog_service.total_stock)
        total = len(rows)
        rows = rows[offset:offset + limit]
    else:
        rows = (await db.execute(query.limit(limit).offset(offset))).scalars().unique().all()

    # One extra query for the whole page rather than one per row. The AR asset
    # has no relationship on Product, and adding an eager load to `_LOADED`
    # would pay for it on every product read in the dashboard, not just here.
    ar_status = dict(
        (
            await db.execute(
                select(ProductArAsset.product_id, ProductArAsset.status).where(
                    ProductArAsset.product_id.in_([p.id for p in rows])
                )
            )
        ).all()
    ) if rows else {}

    return Page[ProductAdminRow](
        items=[catalog_service.to_admin_row(p, ar_status.get(p.id)) for p in rows],
        total=total, limit=limit, offset=offset,
    )


@router.get("/{product_id}")
async def get_product(
    product_id: int,
    _: AdminPrincipal = Depends(require("products.read")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        found = await admin_supabase.product_detail(product_id)
        if found is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That product no longer exists.")
        return catalog_service.to_admin_detail(found)

    return catalog_service.to_admin_detail(await _load(db, product_id))


async def _apply(db: AsyncSession, product: Product, payload: ProductWrite) -> None:
    """Write the whole product: scalars, relations, variants and images.

    Variants and images are reconciled by id rather than replaced wholesale.
    Deleting and re-inserting them would break every order item and cart line
    that points at a variant, and would lose the inventory ledger with it.
    """
    product.name = payload.name
    product.tagline = payload.tagline
    product.description = payload.description
    product.category_id = payload.category_id
    product.brand_id = payload.brand_id
    product.status = payload.status
    product.assembly_required = payload.assembly_required
    product.assembly_note = payload.assembly_note
    product.warranty_months = payload.warranty_months
    product.care_instructions = payload.care_instructions
    product.seating_capacity = payload.seating_capacity
    product.specifications = [s.model_dump() for s in payload.specifications] if payload.specifications else None
    product.meta_title = payload.meta_title
    product.meta_description = payload.meta_description

    if payload.slug:
        product.slug = await catalog_service.unique_slug(
            db, Product, payload.slug, exclude_id=product.id
        )
    elif not product.slug:
        product.slug = await catalog_service.unique_slug(db, Product, payload.name)

    await db.flush()

    # --- Rooms and attributes: small sets, replaced outright.
    await db.execute(delete(ProductRoom).where(ProductRoom.product_id == product.id))
    for room_id in dict.fromkeys(payload.room_ids):
        db.add(ProductRoom(product_id=product.id, room_id=room_id))

    await db.execute(delete(ProductAttribute).where(ProductAttribute.product_id == product.id))
    for attribute_id in dict.fromkeys(payload.attribute_ids):
        db.add(ProductAttribute(product_id=product.id, attribute_id=attribute_id))

    # --- Variants
    existing = {v.id: v for v in product.variants}
    # SKU is the unique business key, so a payload that omits ids - a script,
    # or an import - is still matched to the right rows. Without this second
    # index an update that only changed a price would try to insert a second
    # variant with a SKU the database has a unique index on.
    by_sku = {v.sku.strip().upper(): v for v in product.variants}
    kept: set[int] = set()
    for index, incoming in enumerate(payload.variants):
        target = existing.get(incoming.id) if incoming.id else by_sku.get(incoming.sku.strip().upper())
        if target is None:
            target = ProductVariant(product_id=product.id)
            db.add(target)
        else:
            kept.add(target.id)
        for field, value in incoming.model_dump(exclude={"id", "position"}).items():
            setattr(target, field, value)
        target.sku = incoming.sku.strip().upper()
        target.position = index

    for variant_id, variant in existing.items():
        if variant_id not in kept:
            # Deactivated, not deleted: a removed variant is still referenced
            # by past order items, and the inventory ledger must survive it.
            variant.is_active = False

    # --- Images: these carry no foreign keys from elsewhere, so removals
    # are real deletions.
    existing_images = {i.id: i for i in product.images}
    kept_images: set[int] = set()
    for index, incoming in enumerate(payload.images):
        target = existing_images.get(incoming.id) if incoming.id else None
        if target is None:
            target = ProductImage(product_id=product.id)
            db.add(target)
        else:
            kept_images.add(target.id)
        target.url = incoming.url
        target.alt_text = incoming.alt_text
        target.kind = incoming.kind
        target.variant_id = incoming.variant_id
        target.position = index

    for image_id in set(existing_images) - kept_images:
        await db.delete(existing_images[image_id])

    await db.flush()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("products.write")),
    db: AsyncSession = Depends(get_db),
):
    if payload.status == "active" and not principal.can("products.publish"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Your role can create drafts but not publish them.",
        )

    skus = [v.sku.strip().upper() for v in payload.variants]
    clash = (await db.execute(select(ProductVariant.sku).where(ProductVariant.sku.in_(skus)))).first()
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, f"SKU {clash[0]} is already in use.")

    # The slug is set before the first flush, not by _apply afterwards: it is
    # NOT NULL, so an insert without it never reaches the code that would
    # have filled it in.
    product = Product(
        name=payload.name,
        status=payload.status,
        slug=await catalog_service.unique_slug(db, Product, payload.slug or payload.name),
        # Assigned empty so SQLAlchemy treats both collections as loaded.
        # Left unset, _apply's first read of product.variants would emit a
        # lazy load, which raises MissingGreenlet under asyncio.
        variants=[],
        images=[],
    )
    db.add(product)
    await db.flush()
    await _apply(db, product, payload)

    await audit.record(
        db, action="create", entity="products", entity_id=product.id,
        summary=f"Created product {product.name}", principal=principal, request=request,
    )
    await db.commit()
    return catalog_service.to_admin_detail(await _load(db, product.id))


@router.put("/{product_id}")
async def update_product(
    product_id: int,
    payload: ProductWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("products.write")),
    db: AsyncSession = Depends(get_db),
):
    product = await _load(db, product_id)
    if payload.status != product.status and not principal.can("products.publish"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Your role cannot change whether a product is published."
        )

    skus = [v.sku.strip().upper() for v in payload.variants]
    clash = (
        await db.execute(
            select(ProductVariant.sku).where(
                ProductVariant.sku.in_(skus), ProductVariant.product_id != product.id
            )
        )
    ).first()
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, f"SKU {clash[0]} belongs to another product.")

    before = {"name": product.name, "status": product.status, "category_id": product.category_id}
    await _apply(db, product, payload)

    await audit.record(
        db, action="update", entity="products", entity_id=product.id,
        summary=f"Updated product {product.name}",
        changes=audit.diff(before, {
            "name": product.name, "status": product.status, "category_id": product.category_id,
        }),
        principal=principal, request=request,
    )
    await db.commit()
    return catalog_service.to_admin_detail(await _load(db, product.id))


@router.post("/{product_id}/status", response_model=Message)
async def set_status(
    product_id: int,
    new_status: str = Query(..., alias="value", pattern="^(draft|active|archived)$"),
    request: Request = None,
    principal: AdminPrincipal = Depends(require("products.publish")),
    db: AsyncSession = Depends(get_db),
):
    product = await _load(db, product_id)
    before = product.status
    product.status = new_status
    await audit.record(
        db, action="update", entity="products", entity_id=product.id,
        summary=f"{product.name}: {before} to {new_status}",
        changes={"status": [before, new_status]}, principal=principal, request=request,
    )
    await db.commit()
    return Message(message=f"{product.name} is now {new_status}.")


@router.delete("/{product_id}", response_model=Message)
async def archive_product(
    product_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("products.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Archives rather than deletes.

    Order items reference the product for their image and their link back to
    the catalogue. Archiving takes it out of the shop and every admin list
    while leaving past orders intact.
    """
    product = await _load(db, product_id)
    product.status = "archived"
    await audit.record(
        db, action="archive", entity="products", entity_id=product.id,
        summary=f"Archived {product.name}", principal=principal, request=request,
    )
    await db.commit()
    return Message(message=f"{product.name} has been archived.")


@router.post("/stock", response_model=Message)
async def adjust_inventory(
    payload: list[StockAdjustment],
    request: Request,
    principal: AdminPrincipal = Depends(require("inventory.write")),
    db: AsyncSession = Depends(get_db),
):
    """Bulk stock adjustment.

    A list rather than one-at-a-time because receiving a delivery means
    twenty lines, and twenty requests is twenty chances to half-apply it.
    """
    variant_ids = [a.variant_id for a in payload]
    variants = {
        v.id: v for v in (
            await db.execute(select(ProductVariant).where(ProductVariant.id.in_(variant_ids)))
        ).scalars().all()
    }
    missing = set(variant_ids) - set(variants)
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Unknown variant(s): {sorted(missing)}"
        )

    for adjustment in payload:
        await adjust_stock(
            db, variants[adjustment.variant_id],
            delta=adjustment.delta, reason=adjustment.reason,
            staff_user_id=principal.user.id, note=adjustment.note,
        )

    await audit.record(
        db, action="stock_adjust", entity="product_variants",
        summary=f"Adjusted stock on {len(payload)} variant(s)",
        principal=principal, request=request,
    )
    await db.commit()
    return Message(message=f"Stock updated on {len(payload)} variant(s).")
