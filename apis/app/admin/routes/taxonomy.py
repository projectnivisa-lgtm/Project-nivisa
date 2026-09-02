"""Categories, rooms, collections, brands and attributes.

These five are CRUD over near-identical shapes, so the handlers are generated
from one table rather than written five times. Five hand-written copies is
how the previous backend ended up with a `slug` field on one master that
returned the row's id.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require
from app.models.catalog import (
    Attribute, Brand, Category, Collection, CollectionProduct, Product, Room,
)
from app.schemas.catalog import (
    AttributeCreate, AttributeOut, BrandCreate, BrandOut, CategoryCreate,
    CategoryOut, CategoryTree, CategoryUpdate, CollectionCreate, CollectionOut,
    RoomCreate, RoomOut,
)
from app.schemas.common import Message
from app.services.catalog import unique_slug

router = APIRouter(tags=["Admin · Taxonomy"])


async def _assert_unique_slug(db: AsyncSession, model, value: str, exclude_id: int | None) -> str:
    return await unique_slug(db, model, value, exclude_id=exclude_id)


# --- Categories -------------------------------------------------------------


@router.get("/categories", response_model=list[CategoryTree])
async def list_categories(
    _: AdminPrincipal = Depends(require("taxonomy.read")),
    db: AsyncSession = Depends(get_db),
):
    """The whole tree in one call, with product counts.

    A category list is small - dozens, not thousands - and the admin screen
    always needs the whole shape. Paginating it would only force the client
    to reassemble the tree itself.
    """
    rows = (await db.execute(select(Category).order_by(Category.position, Category.name))).scalars().all()
    counts = dict(
        (await db.execute(
            select(Product.category_id, func.count(Product.id))
            .where(Product.status != "archived")
            .group_by(Product.category_id)
        )).all()
    )

    nodes: dict[int, CategoryTree] = {
        row.id: CategoryTree.model_validate({**row.__dict__, "children": [], "product_count": counts.get(row.id, 0)})
        for row in rows
    }
    roots: list[CategoryTree] = []
    for row in rows:
        node = nodes[row.id]
        parent = nodes.get(row.parent_id) if row.parent_id else None
        (parent.children if parent else roots).append(node)
    return roots


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    row = Category(
        **payload.model_dump(exclude={"slug"}),
        slug=await _assert_unique_slug(db, Category, payload.slug or payload.name, None),
    )
    db.add(row)
    await db.flush()
    await audit.record(
        db, action="create", entity="categories", entity_id=row.id,
        summary=f"Created category {row.name}", principal=principal, request=request,
    )
    await db.commit()
    return CategoryOut.model_validate(row)


@router.put("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int,
    payload: CategoryUpdate,
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Category).where(Category.id == category_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That category no longer exists.")

    if payload.parent_id is not None:
        if payload.parent_id == category_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A category cannot be its own parent.")
        # Walk up from the proposed parent: if we meet this category, the
        # move would create a cycle and the tree endpoint would recurse
        # until it ran out of stack.
        cursor = payload.parent_id
        seen = set()
        while cursor and cursor not in seen:
            seen.add(cursor)
            if cursor == category_id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "That move would put the category inside one of its own children.",
                )
            cursor = await db.scalar(select(Category.parent_id).where(Category.id == cursor))

    before = {"name": row.name, "parent_id": row.parent_id, "is_active": row.is_active}
    data = payload.model_dump(exclude_unset=True, exclude={"slug"})
    for field, value in data.items():
        setattr(row, field, value)
    if payload.slug:
        row.slug = await _assert_unique_slug(db, Category, payload.slug, category_id)

    await audit.record(
        db, action="update", entity="categories", entity_id=row.id,
        summary=f"Updated category {row.name}",
        changes=audit.diff(before, {"name": row.name, "parent_id": row.parent_id, "is_active": row.is_active}),
        principal=principal, request=request,
    )
    await db.commit()
    return CategoryOut.model_validate(row)


@router.delete("/categories/{category_id}", response_model=Message)
async def delete_category(
    category_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Category).where(Category.id == category_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That category no longer exists.")

    in_use = await db.scalar(select(func.count(Product.id)).where(Product.category_id == category_id))
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{in_use} product(s) are in this category. Move them first, or deactivate the category instead.",
        )
    children = await db.scalar(select(func.count(Category.id)).where(Category.parent_id == category_id))
    if children:
        raise HTTPException(status.HTTP_409_CONFLICT, "Remove or move the sub-categories first.")

    await audit.record(
        db, action="delete", entity="categories", entity_id=row.id,
        summary=f"Deleted category {row.name}", principal=principal, request=request,
    )
    await db.delete(row)
    await db.commit()
    return Message(message=f"Category {row.name} deleted.")


# --- Rooms, collections, brands, attributes ---------------------------------
#
# Each entry: (path, model, create schema, out schema, label, extra filters)

_SIMPLE: tuple[tuple[str, Any, Any, Any, str], ...] = (
    ("rooms", Room, RoomCreate, RoomOut, "room"),
    ("brands", Brand, BrandCreate, BrandOut, "brand"),
)


def _register_simple(path: str, model, create_schema, out_schema, label: str) -> None:
    @router.get(f"/{path}", response_model=list[out_schema], name=f"list_{path}")
    async def _list(  # noqa: ANN202
        include_inactive: bool = True,
        _: AdminPrincipal = Depends(require("taxonomy.read")),
        db: AsyncSession = Depends(get_db),
    ):
        query = select(model)
        if not include_inactive:
            query = query.where(model.is_active.is_(True))
        order = (model.position, model.name) if hasattr(model, "position") else (model.name,)
        rows = (await db.execute(query.order_by(*order))).scalars().all()
        return [out_schema.model_validate(row) for row in rows]

    @router.post(f"/{path}", response_model=out_schema, status_code=201, name=f"create_{path}")
    async def _create(  # noqa: ANN202
        payload: create_schema,
        request: Request,
        principal: AdminPrincipal = Depends(require("taxonomy.write")),
        db: AsyncSession = Depends(get_db),
    ):
        row = model(
            **payload.model_dump(exclude={"slug"}),
            slug=await unique_slug(db, model, payload.slug or payload.name),
        )
        db.add(row)
        await db.flush()
        await audit.record(
            db, action="create", entity=path, entity_id=row.id,
            summary=f"Created {label} {row.name}", principal=principal, request=request,
        )
        await db.commit()
        return out_schema.model_validate(row)

    @router.put(f"/{path}/{{row_id}}", response_model=out_schema, name=f"update_{path}")
    async def _update(  # noqa: ANN202
        row_id: int,
        payload: create_schema,
        request: Request,
        principal: AdminPrincipal = Depends(require("taxonomy.write")),
        db: AsyncSession = Depends(get_db),
    ):
        row = (await db.execute(select(model).where(model.id == row_id))).scalars().first()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"That {label} no longer exists.")
        before = {"name": row.name, "is_active": row.is_active}
        for field, value in payload.model_dump(exclude={"slug"}).items():
            setattr(row, field, value)
        if payload.slug:
            row.slug = await unique_slug(db, model, payload.slug, exclude_id=row_id)
        await audit.record(
            db, action="update", entity=path, entity_id=row.id,
            summary=f"Updated {label} {row.name}",
            changes=audit.diff(before, {"name": row.name, "is_active": row.is_active}),
            principal=principal, request=request,
        )
        await db.commit()
        return out_schema.model_validate(row)

    @router.delete(f"/{path}/{{row_id}}", response_model=Message, name=f"delete_{path}")
    async def _delete(  # noqa: ANN202
        row_id: int,
        request: Request,
        principal: AdminPrincipal = Depends(require("taxonomy.write")),
        db: AsyncSession = Depends(get_db),
    ):
        row = (await db.execute(select(model).where(model.id == row_id))).scalars().first()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"That {label} no longer exists.")
        await audit.record(
            db, action="delete", entity=path, entity_id=row.id,
            summary=f"Deleted {label} {row.name}", principal=principal, request=request,
        )
        await db.delete(row)
        await db.commit()
        return Message(message=f"{row.name} deleted.")


for _args in _SIMPLE:
    _register_simple(*_args)


# --- Collections (products attached, so hand-written) -----------------------


@router.get("/collections", response_model=list[CollectionOut])
async def list_collections(
    _: AdminPrincipal = Depends(require("taxonomy.read")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(select(Collection).order_by(Collection.position, Collection.name))
    ).scalars().all()
    counts = dict(
        (await db.execute(
            select(CollectionProduct.collection_id, func.count(CollectionProduct.product_id))
            .group_by(CollectionProduct.collection_id)
        )).all()
    )
    return [
        CollectionOut.model_validate({**row.__dict__, "product_count": counts.get(row.id, 0)})
        for row in rows
    ]


@router.post("/collections", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
async def create_collection(
    payload: CollectionCreate,
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    row = Collection(
        **payload.model_dump(exclude={"slug"}),
        slug=await unique_slug(db, Collection, payload.slug or payload.name),
    )
    db.add(row)
    await db.flush()
    await audit.record(
        db, action="create", entity="collections", entity_id=row.id,
        summary=f"Created collection {row.name}", principal=principal, request=request,
    )
    await db.commit()
    return CollectionOut.model_validate({**row.__dict__, "product_count": 0})


@router.put("/collections/{collection_id}", response_model=CollectionOut)
async def update_collection(
    collection_id: int,
    payload: CollectionCreate,
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Collection).where(Collection.id == collection_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That collection no longer exists.")
    for field, value in payload.model_dump(exclude={"slug"}).items():
        setattr(row, field, value)
    if payload.slug:
        row.slug = await unique_slug(db, Collection, payload.slug, exclude_id=collection_id)
    await audit.record(
        db, action="update", entity="collections", entity_id=row.id,
        summary=f"Updated collection {row.name}", principal=principal, request=request,
    )
    await db.commit()
    count = await db.scalar(
        select(func.count(CollectionProduct.product_id)).where(CollectionProduct.collection_id == row.id)
    )
    return CollectionOut.model_validate({**row.__dict__, "product_count": count or 0})


@router.put("/collections/{collection_id}/products", response_model=Message)
async def set_collection_products(
    collection_id: int,
    product_ids: list[int],
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    """Replaces the membership, in the order given.

    The order is the point: a merchandiser arranging a rail is deciding what
    a customer sees first, and an alphabetical fallback would throw that away.
    """
    row = (await db.execute(select(Collection).where(Collection.id == collection_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That collection no longer exists.")

    known = {
        pid for (pid,) in (
            await db.execute(select(Product.id).where(Product.id.in_(product_ids)))
        ).all()
    }
    unknown = [pid for pid in product_ids if pid not in known]
    if unknown:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown product(s): {unknown}")

    await db.execute(delete(CollectionProduct).where(CollectionProduct.collection_id == collection_id))
    for position, product_id in enumerate(dict.fromkeys(product_ids)):
        db.add(CollectionProduct(collection_id=collection_id, product_id=product_id, position=position))

    await audit.record(
        db, action="update", entity="collections", entity_id=collection_id,
        summary=f"Set {len(product_ids)} product(s) in {row.name}",
        principal=principal, request=request,
    )
    await db.commit()
    return Message(message=f"{row.name} now has {len(set(product_ids))} product(s).")


@router.delete("/collections/{collection_id}", response_model=Message)
async def delete_collection(
    collection_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Collection).where(Collection.id == collection_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That collection no longer exists.")
    await audit.record(
        db, action="delete", entity="collections", entity_id=row.id,
        summary=f"Deleted collection {row.name}", principal=principal, request=request,
    )
    await db.delete(row)
    await db.commit()
    return Message(message=f"Collection {row.name} deleted.")


# --- Attributes -------------------------------------------------------------


@router.get("/attributes", response_model=list[AttributeOut])
async def list_attributes(
    kind: str | None = Query(None, description="material | finish | colour | style | upholstery"),
    _: AdminPrincipal = Depends(require("taxonomy.read")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Attribute)
    if kind:
        query = query.where(Attribute.kind == kind)
    rows = (
        await db.execute(query.order_by(Attribute.kind, Attribute.position, Attribute.name))
    ).scalars().all()
    return [AttributeOut.model_validate(row) for row in rows]


@router.post("/attributes", response_model=AttributeOut, status_code=status.HTTP_201_CREATED)
async def create_attribute(
    payload: AttributeCreate,
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    from app.core.slug import slugify

    slug = slugify(payload.slug or payload.name)
    clash = (
        await db.execute(
            select(Attribute.id).where(Attribute.kind == payload.kind, Attribute.slug == slug)
        )
    ).first()
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{payload.name} already exists as a {payload.kind}.")

    row = Attribute(**payload.model_dump(exclude={"slug"}), slug=slug)
    db.add(row)
    await db.flush()
    await audit.record(
        db, action="create", entity="attributes", entity_id=row.id,
        summary=f"Created {payload.kind} {row.name}", principal=principal, request=request,
    )
    await db.commit()
    return AttributeOut.model_validate(row)


@router.put("/attributes/{attribute_id}", response_model=AttributeOut)
async def update_attribute(
    attribute_id: int,
    payload: AttributeCreate,
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    from app.core.slug import slugify

    row = (await db.execute(select(Attribute).where(Attribute.id == attribute_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That attribute no longer exists.")
    for field, value in payload.model_dump(exclude={"slug"}).items():
        setattr(row, field, value)
    row.slug = slugify(payload.slug or payload.name)
    await audit.record(
        db, action="update", entity="attributes", entity_id=row.id,
        summary=f"Updated {row.kind} {row.name}", principal=principal, request=request,
    )
    await db.commit()
    return AttributeOut.model_validate(row)


@router.delete("/attributes/{attribute_id}", response_model=Message)
async def delete_attribute(
    attribute_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("taxonomy.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Attribute).where(Attribute.id == attribute_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That attribute no longer exists.")
    await audit.record(
        db, action="delete", entity="attributes", entity_id=row.id,
        summary=f"Deleted {row.kind} {row.name}", principal=principal, request=request,
    )
    await db.delete(row)
    await db.commit()
    return Message(message=f"{row.name} deleted.")
