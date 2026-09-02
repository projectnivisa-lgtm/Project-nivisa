"""AR and 3D asset management."""
from datetime import datetime, timezone

from fastapi import (
    APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status,
)
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import audit
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require
from app.models.ar import ArEvent, ProductArAsset
from app.models.catalog import Product
from app.providers.storage import (
    UnsupportedFile, check_model, check_model_bytes, check_type, get_storage,
)
from app.schemas.ar import (
    ArAssetOut, ArAssetRow, ArAssetWrite, ArReportRow, ArValidationOut,
)
from app.schemas.common import Message, Page
from app.services import ar as ar_service

router = APIRouter(prefix="/ar", tags=["Admin · AR"])

# A 3D model is a different order of size from a photograph, so it gets its
# own ceiling. Above roughly this a model is too heavy to download on a phone
# over mobile data, which is exactly where AR is used.
MAX_MODEL_MB = 40


async def _load_product(db: AsyncSession, product_id: int) -> Product:
    product = (
        await db.execute(
            select(Product).options(selectinload(Product.variants)).where(Product.id == product_id)
        )
    ).scalars().first()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That product no longer exists.")
    return product


async def _load_asset(db: AsyncSession, product_id: int) -> ProductArAsset | None:
    return (
        await db.execute(select(ProductArAsset).where(ProductArAsset.product_id == product_id))
    ).scalars().first()


def _serialise(asset: ProductArAsset, product: Product) -> ArAssetOut:
    variant = ar_service.reference_variant(product)
    result = ar_service.validate(asset, product)
    return ArAssetOut.model_validate({
        **{k: v for k, v in asset.__dict__.items() if not k.startswith("_")},
        "product_name": product.name,
        "product_width_mm": variant.width_mm if variant else None,
        "product_height_mm": variant.height_mm if variant else None,
        "product_depth_mm": variant.depth_mm if variant else None,
        "validation": ArValidationOut(
            ok=result.ok, problems=result.problems, warnings=result.warnings
        ),
    })


@router.get("", response_model=Page[ArAssetRow])
async def list_ar(
    q: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: AdminPrincipal = Depends(require("products.read")),
    db: AsyncSession = Depends(get_db),
):
    """Every product, with its AR state.

    Products WITHOUT an asset are listed too. The job this screen exists for
    is "which pieces still need a model", and a list of only the ones already
    done cannot answer it.
    """
    query = (
        select(Product, ProductArAsset)
        .outerjoin(ProductArAsset, ProductArAsset.product_id == Product.id)
        .where(Product.status != "archived")
    )
    count_query = (
        select(func.count(Product.id))
        .select_from(Product)
        .outerjoin(ProductArAsset, ProductArAsset.product_id == Product.id)
        .where(Product.status != "archived")
    )

    conditions = []
    if q:
        conditions.append(Product.name.ilike(f"%{q.strip()}%"))
    if status_filter == "unavailable":
        # "Needs a model" is the useful reading of this filter, so it covers
        # both a product with no asset row at all and one whose asset exists
        # but has never been given a file.
        conditions.append(
            or_(ProductArAsset.id.is_(None), ProductArAsset.status == "unavailable")
        )
    elif status_filter:
        conditions.append(ProductArAsset.status == status_filter)

    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)

    total = await db.scalar(count_query) or 0
    rows = (await db.execute(query.order_by(Product.name).limit(limit).offset(offset))).all()

    return Page[ArAssetRow](
        items=[
            ArAssetRow(
                product_id=product.id,
                product_name=product.name,
                product_slug=product.slug,
                product_status=product.status,
                has_asset=asset is not None,
                status=asset.status if asset else "unavailable",
                version=asset.version if asset else 0,
                has_glb=bool(asset and asset.model_url),
                has_usdz=bool(asset and asset.ios_model_url),
                updated_at=asset.updated_at if asset else None,
            )
            for product, asset in rows
        ],
        total=total, limit=limit, offset=offset,
    )


@router.get("/{product_id}", response_model=ArAssetOut)
async def get_ar(
    product_id: int,
    _: AdminPrincipal = Depends(require("products.read")),
    db: AsyncSession = Depends(get_db),
):
    product = await _load_product(db, product_id)
    asset = await _load_asset(db, product_id)
    if asset is None:
        # Materialised on first read rather than 404-ing, so the editor always
        # has something to open and the caller does not need a "create or
        # edit" branch. Nothing is published by existing.
        asset = ProductArAsset(product_id=product_id, status="unavailable")
        db.add(asset)
        await db.flush()
        await db.commit()
        await db.refresh(asset)
    return _serialise(asset, product)


@router.put("/{product_id}", response_model=ArAssetOut)
async def update_ar(
    product_id: int,
    payload: ArAssetWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("ar.manage")),
    db: AsyncSession = Depends(get_db),
):
    product = await _load_product(db, product_id)
    asset = await _load_asset(db, product_id)
    if asset is None:
        asset = ProductArAsset(product_id=product_id)
        db.add(asset)

    before = {
        "real_width_mm": asset.real_width_mm,
        "real_height_mm": asset.real_height_mm,
        "real_depth_mm": asset.real_depth_mm,
        "scale_mode": asset.scale_mode,
        "placement": asset.placement,
    }

    # Only the settings. The file URLs are not in this payload at all, so a
    # save from the dimensions form cannot clear an uploaded model.
    for field, value in payload.model_dump().items():
        setattr(asset, field, value)
    asset.uploaded_by = principal.user.id

    # Editing a published asset takes it back off the storefront until it has
    # been checked again. Changing a model's stated size and leaving the old
    # one live is exactly how a wrong-scale piece reaches a customer.
    if asset.status == "ready":
        asset.status = "processing"
        asset.published_at = None

    await db.flush()
    await audit.record(
        db, action="update", entity="product_ar_assets", entity_id=asset.id,
        summary=f"Updated AR asset for {product.name}",
        changes=audit.diff(before, {
            "real_width_mm": asset.real_width_mm,
            "real_height_mm": asset.real_height_mm,
            "real_depth_mm": asset.real_depth_mm,
            "scale_mode": asset.scale_mode,
            "placement": asset.placement,
        }),
        principal=principal, request=request,
    )
    await db.commit()
    await db.refresh(asset)
    return _serialise(asset, product)


@router.post("/{product_id}/model", response_model=ArAssetOut)
async def upload_model(
    product_id: int,
    request: Request,
    file: UploadFile = File(...),
    kind: str = Query("auto", pattern="^(auto|glb|usdz|poster)$"),
    principal: AdminPrincipal = Depends(require("ar.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Upload one file: a .glb, a .usdz, or a poster image.

    `kind=auto` routes by extension, so a person can drop either model in
    without first telling the form which platform it is for.
    """
    product = await _load_product(db, product_id)
    asset = await _load_asset(db, product_id)
    if asset is None:
        asset = ProductArAsset(product_id=product_id)
        db.add(asset)
        await db.flush()

    filename = file.filename or "model"

    try:
        if kind == "poster":
            check_type(file.content_type)
            target = "poster"
        else:
            suffix = check_model(filename, file.content_type)
            target = "usdz" if suffix == ".usdz" else "glb"
            if kind != "auto" and kind != target:
                raise UnsupportedFile(
                    f"That file is a {target} but the {kind} slot was chosen."
                )
    except UnsupportedFile as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc))

    data = await file.read()

    # The name said .glb; this is where we find out whether it is one. Checked
    # before the size limit so a renamed 40MB video is rejected for what it is
    # rather than for how big it is.
    if target != "poster":
        try:
            check_model_bytes(suffix, data)
        except UnsupportedFile as exc:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc))

    limit_mb = settings.MAX_UPLOAD_MB if target == "poster" else MAX_MODEL_MB
    if len(data) > limit_mb * 1024 * 1024:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"That file is {len(data) / 1_048_576:.1f} MB. The limit is {limit_mb} MB — "
            "AR is used on a phone, often on mobile data.",
        )

    url = await get_storage().save(
        data=data, filename=filename,
        content_type=file.content_type or "application/octet-stream",
        folder="ar",
    )

    if target == "poster":
        asset.poster_url = url
    elif target == "usdz":
        asset.ios_model_url = url
    else:
        asset.model_url = url

    if target != "poster":
        # A new model is a new version, and an already-published asset comes
        # off the storefront until the replacement has been checked.
        asset.version += 1
        if asset.status == "ready":
            asset.published_at = None
        asset.status = "processing"

    asset.uploaded_by = principal.user.id

    await db.flush()
    await audit.record(
        db, action="upload", entity="product_ar_assets", entity_id=asset.id,
        summary=f"Uploaded {target} for {product.name} (v{asset.version})",
        principal=principal, request=request,
    )
    await db.commit()
    await db.refresh(asset)
    return _serialise(asset, product)


@router.delete("/{product_id}/model", response_model=ArAssetOut)
async def remove_model(
    product_id: int,
    request: Request,
    kind: str = Query(..., pattern="^(glb|usdz|poster)$"),
    principal: AdminPrincipal = Depends(require("ar.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Remove one uploaded file.

    The stored object is deleted too, not just the reference - an orphaned
    40MB model in the bucket costs money for as long as nobody notices it.
    """
    product = await _load_product(db, product_id)
    asset = await _load_asset(db, product_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "There is no AR asset for this product.")

    field = {"glb": "model_url", "usdz": "ios_model_url", "poster": "poster_url"}[kind]
    url = getattr(asset, field)
    if url:
        await get_storage().delete(url)
    setattr(asset, field, None)

    # Removing a model takes AR off the storefront: the remaining platforms
    # may still work, but that is a decision to make deliberately by
    # publishing again, not one to inherit silently.
    if kind != "poster" and asset.status == "ready":
        asset.status = "processing"
        asset.published_at = None

    await audit.record(
        db, action="delete", entity="product_ar_assets", entity_id=asset.id,
        summary=f"Removed the {kind} for {product.name}",
        principal=principal, request=request,
    )
    await db.commit()
    await db.refresh(asset)
    return _serialise(asset, product)


@router.post("/{product_id}/publish", response_model=ArAssetOut)
async def publish(
    product_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("ar.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Put AR live, if and only if it validates.

    The check is server-side and unconditional. The dashboard shows the same
    result as you type, but a UI that merely discourages publishing a
    wrong-scale model is not a safeguard — it is a suggestion.
    """
    product = await _load_product(db, product_id)
    asset = await _load_asset(db, product_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "There is no AR asset for this product.")

    result = ar_service.validate(asset, product)
    asset.validation_note = result.note

    if not result.ok:
        asset.status = "failed"
        await db.commit()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This model cannot be published yet. " + " ".join(result.problems),
        )

    asset.status = "ready"
    asset.published_at = datetime.now(timezone.utc)

    await audit.record(
        db, action="publish", entity="product_ar_assets", entity_id=asset.id,
        summary=f"Published AR for {product.name} (v{asset.version})",
        principal=principal, request=request,
    )
    await db.commit()
    await db.refresh(asset)
    return _serialise(asset, product)


@router.post("/{product_id}/unpublish", response_model=ArAssetOut)
async def unpublish(
    product_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("ar.manage")),
    db: AsyncSession = Depends(get_db),
):
    product = await _load_product(db, product_id)
    asset = await _load_asset(db, product_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "There is no AR asset for this product.")

    asset.status = "deprecated"
    asset.published_at = None
    await audit.record(
        db, action="unpublish", entity="product_ar_assets", entity_id=asset.id,
        summary=f"Took AR off the storefront for {product.name}",
        principal=principal, request=request,
    )
    await db.commit()
    await db.refresh(asset)
    return _serialise(asset, product)


@router.get("/report/summary", response_model=list[ArReportRow])
async def ar_report(
    days: int = Query(30, ge=1, le=365),
    _: AdminPrincipal = Depends(require("reports.view")),
    db: AsyncSession = Depends(get_db),
):
    """How AR is actually being used.

    Two numbers, both observable: how many sessions opened AR on a product,
    and how many of those sessions went on to add it to the cart.

    What is deliberately absent is a "placement rate". AR is handed to the
    operating system — iOS Quick Look, Android Scene Viewer — and neither
    reports back whether the model was placed in a room. Any such figure here
    would be invented, and one invented number discredits the two real ones.
    """
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        await db.execute(
            select(
                ArEvent.product_id,
                Product.name,
                func.count(func.distinct(ArEvent.session_token)).filter(ArEvent.kind == "opened"),
                func.count(func.distinct(ArEvent.session_token)).filter(ArEvent.kind == "added_to_cart"),
            )
            .join(Product, Product.id == ArEvent.product_id)
            .where(ArEvent.created_at >= since)
            .group_by(ArEvent.product_id, Product.name)
            .order_by(func.count(func.distinct(ArEvent.session_token)).desc())
        )
    ).all()

    return [
        ArReportRow(
            product_id=row[0],
            product_name=row[1],
            opened=row[2] or 0,
            added_to_cart=row[3] or 0,
            # Null rather than zero when nothing opened AR: a rate over no
            # sessions is undefined, and "0%" reads as a product AR failed on.
            conversion_pct=round((row[3] or 0) / row[2] * 100, 1) if row[2] else None,
        )
        for row in rows
    ]
