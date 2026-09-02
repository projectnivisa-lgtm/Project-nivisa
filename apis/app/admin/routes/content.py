"""Pages, banners, homepage sections, settings and uploads."""
import bleach
from fastapi import (
    APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require, require_any
from app.core.slug import slugify
from app.models.content import Banner, HomepageSection, Page as PageModel, Setting
from app.providers.storage import UnsupportedFile, check_type, get_storage
from app.schemas.common import Message
from app.schemas.content import (
    BannerOut, BannerWrite, HomepageSectionOut, HomepageSectionWrite, PageOut,
    PageUpdate, PageWrite, SettingOut, SettingWrite, UploadOut,
)

router = APIRouter(tags=["Admin · Content"])

# What a page body is allowed to contain. Sanitising on write means the
# storefront, an email and a PDF all render the same already-safe HTML
# instead of each having to remember to escape it.
ALLOWED_TAGS = [
    "p", "br", "strong", "em", "u", "s", "h2", "h3", "h4", "ul", "ol", "li",
    "blockquote", "a", "img", "table", "thead", "tbody", "tr", "th", "td", "hr",
]
ALLOWED_ATTRS = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "width", "height", "loading"],
    "td": ["colspan", "rowspan"],
    "th": ["colspan", "rowspan", "scope"],
}


def clean_html(raw: str) -> str:
    return bleach.clean(
        raw or "",
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=["http", "https", "mailto"],
        strip=True,
    )


# --- Pages ------------------------------------------------------------------


@router.get("/pages", response_model=list[PageOut])
async def list_pages(
    _: AdminPrincipal = Depends(require("content.read")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(select(PageModel).order_by(PageModel.is_system.desc(), PageModel.title))
    ).scalars().all()
    return [PageOut.model_validate(row) for row in rows]


@router.get("/pages/{slug}", response_model=PageOut)
async def get_page(
    slug: str,
    _: AdminPrincipal = Depends(require("content.read")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(PageModel).where(PageModel.slug == slug))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That page does not exist.")
    return PageOut.model_validate(row)


@router.post("/pages", response_model=PageOut, status_code=status.HTTP_201_CREATED)
async def create_page(
    payload: PageWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("content.write")),
    db: AsyncSession = Depends(get_db),
):
    slug = slugify(payload.slug)
    if (await db.execute(select(PageModel.id).where(PageModel.slug == slug))).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"A page at /{slug} already exists.")

    row = PageModel(**{**payload.model_dump(), "slug": slug, "body": clean_html(payload.body)})
    db.add(row)
    await db.flush()
    await audit.record(
        db, action="create", entity="pages", entity_id=row.id,
        summary=f"Created page /{slug}", principal=principal, request=request,
    )
    await db.commit()
    return PageOut.model_validate(row)


@router.put("/pages/{slug}", response_model=PageOut)
async def update_page(
    slug: str,
    payload: PageUpdate,
    request: Request,
    principal: AdminPrincipal = Depends(require("content.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(PageModel).where(PageModel.slug == slug))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That page does not exist.")

    data = payload.model_dump(exclude_unset=True)
    if "body" in data:
        data["body"] = clean_html(data["body"])
    before = {"title": row.title, "is_published": row.is_published}
    for field, value in data.items():
        setattr(row, field, value)

    await audit.record(
        db, action="update", entity="pages", entity_id=row.id,
        summary=f"Edited page /{slug}",
        changes=audit.diff(before, {"title": row.title, "is_published": row.is_published}),
        principal=principal, request=request,
    )
    await db.commit()
    return PageOut.model_validate(row)


@router.delete("/pages/{slug}", response_model=Message)
async def delete_page(
    slug: str,
    request: Request,
    principal: AdminPrincipal = Depends(require("content.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(PageModel).where(PageModel.slug == slug))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That page does not exist.")
    if row.is_system:
        # The footer and checkout link to these by slug; deleting one leaves
        # a 404 behind a link the shop is legally required to provide.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This page is linked from the storefront and cannot be deleted. Unpublish it instead.",
        )
    await audit.record(
        db, action="delete", entity="pages", entity_id=row.id,
        summary=f"Deleted page /{slug}", principal=principal, request=request,
    )
    await db.delete(row)
    await db.commit()
    return Message(message=f"Page /{slug} deleted.")


# --- Banners ----------------------------------------------------------------


@router.get("/banners", response_model=list[BannerOut])
async def list_banners(
    placement: str | None = None,
    _: AdminPrincipal = Depends(require("content.read")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Banner)
    if placement:
        query = query.where(Banner.placement == placement)
    rows = (await db.execute(query.order_by(Banner.placement, Banner.position))).scalars().all()
    return [BannerOut.model_validate(row) for row in rows]


@router.post("/banners", response_model=BannerOut, status_code=status.HTTP_201_CREATED)
async def create_banner(
    payload: BannerWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("content.write")),
    db: AsyncSession = Depends(get_db),
):
    row = Banner(**payload.model_dump())
    db.add(row)
    await db.flush()
    await audit.record(
        db, action="create", entity="banners", entity_id=row.id,
        summary=f"Created banner {row.title}", principal=principal, request=request,
    )
    await db.commit()
    return BannerOut.model_validate(row)


@router.put("/banners/{banner_id}", response_model=BannerOut)
async def update_banner(
    banner_id: int,
    payload: BannerWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("content.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Banner).where(Banner.id == banner_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That banner no longer exists.")
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    await audit.record(
        db, action="update", entity="banners", entity_id=row.id,
        summary=f"Updated banner {row.title}", principal=principal, request=request,
    )
    await db.commit()
    return BannerOut.model_validate(row)


@router.delete("/banners/{banner_id}", response_model=Message)
async def delete_banner(
    banner_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("content.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Banner).where(Banner.id == banner_id))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That banner no longer exists.")
    await audit.record(
        db, action="delete", entity="banners", entity_id=row.id,
        summary=f"Deleted banner {row.title}", principal=principal, request=request,
    )
    await db.delete(row)
    await db.commit()
    return Message(message="Banner deleted.")


# --- Homepage ---------------------------------------------------------------


@router.get("/homepage", response_model=list[HomepageSectionOut])
async def list_sections(
    _: AdminPrincipal = Depends(require("content.read")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(select(HomepageSection).order_by(HomepageSection.position))
    ).scalars().all()
    return [HomepageSectionOut.model_validate(row) for row in rows]


@router.put("/homepage", response_model=list[HomepageSectionOut])
async def replace_homepage(
    payload: list[HomepageSectionWrite],
    request: Request,
    principal: AdminPrincipal = Depends(require("content.write")),
    db: AsyncSession = Depends(get_db),
):
    """The whole page in one write.

    Reordering bands is the common edit, and a per-row PATCH would leave the
    page in a half-reordered state if any one call failed.
    """
    existing = (await db.execute(select(HomepageSection))).scalars().all()
    for row in existing:
        await db.delete(row)
    await db.flush()

    created = []
    for index, section in enumerate(payload):
        row = HomepageSection(**{**section.model_dump(), "position": index})
        db.add(row)
        created.append(row)
    await db.flush()

    await audit.record(
        db, action="update", entity="homepage_sections",
        summary=f"Rebuilt the homepage with {len(payload)} section(s)",
        principal=principal, request=request,
    )
    await db.commit()
    return [HomepageSectionOut.model_validate(row) for row in created]


# --- Settings ---------------------------------------------------------------


@router.get("/settings", response_model=list[SettingOut])
async def list_settings(
    _: AdminPrincipal = Depends(require_any("settings.write", "content.read")),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(select(Setting).order_by(Setting.group, Setting.key))).scalars().all()
    return [SettingOut.model_validate(row) for row in rows]


@router.put("/settings/{key}", response_model=SettingOut)
async def update_setting(
    key: str,
    payload: SettingWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("settings.write")),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(Setting).where(Setting.key == key))).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That setting does not exist.")
    before = row.value
    row.value = payload.value
    await audit.record(
        db, action="update", entity="settings", entity_id=row.key,
        summary=f"Changed setting {key}", changes={key: [before, payload.value]},
        principal=principal, request=request,
    )
    await db.commit()
    return SettingOut.model_validate(row)


# --- Uploads ----------------------------------------------------------------


@router.post("/uploads", response_model=UploadOut)
async def upload(
    file: UploadFile = File(...),
    folder: str = Query("products", pattern="^[a-z][a-z0-9-]{0,30}$"),
    _: AdminPrincipal = Depends(require_any("products.write", "content.write", "taxonomy.write")),
):
    """Accepts one image or PDF and returns the URL to reference it by.

    The size is checked after reading rather than from the Content-Length
    header, because that header is client-supplied and a lie is exactly what
    an upload limit exists to stop.
    """
    try:
        check_type(file.content_type, allow_documents=True)
    except UnsupportedFile as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc))

    data = await file.read()
    limit = app_settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(data) > limit:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"That file is {len(data) / 1_048_576:.1f} MB. The limit is {app_settings.MAX_UPLOAD_MB} MB.",
        )

    url = await get_storage().save(
        data=data, filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream", folder=folder,
    )
    return UploadOut(
        url=url, filename=file.filename or "upload",
        content_type=file.content_type or "", size=len(data),
    )
