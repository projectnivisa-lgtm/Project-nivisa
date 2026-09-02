"""Turning catalogue rows into the shapes the two clients need.

Serialisation lives here rather than in the routers so the storefront and
the dashboard cannot drift into showing different prices for the same
product - the "price from" rule, the primary-image rule and the stock rule
each exist exactly once.
"""
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.slug import slugify
from app.models.catalog import Product, ProductImage, ProductVariant, Review
from app.schemas.catalog import (
    BrandOut, CategoryOut, ImageOut, ProductAdminRow, ProductCard, ProductDetail,
    VariantAdminOut, VariantOut,
)


async def unique_slug(db: AsyncSession, model, value: str, *, exclude_id: int | None = None) -> str:
    """A slug nobody else holds.

    Appending -2, -3 rather than a random suffix keeps URLs readable; the
    loop is bounded by how many products genuinely share a name, which in a
    furniture catalogue is a handful at most.
    """
    base = slugify(value)
    candidate = base
    counter = 2
    while True:
        query = select(model.id).where(model.slug == candidate)
        if exclude_id is not None:
            query = query.where(model.id != exclude_id)
        if (await db.execute(query)).first() is None:
            return candidate
        candidate = f"{base}-{counter}"
        counter += 1


def _sellable(product: Product) -> list[ProductVariant]:
    return [v for v in product.variants if v.is_active]


def price_from(product: Product) -> Decimal:
    """The lowest active variant price - what a card shows as "from".

    Falls back to the lowest price of any variant when none are active, so
    a card never renders a price of zero for a product that plainly has one.
    """
    variants = _sellable(product) or list(product.variants)
    return min((v.price for v in variants), default=Decimal("0"))


def compare_at_for(product: Product) -> Decimal | None:
    """The compare-at of whichever variant sets the "from" price.

    Taking the highest compare-at across all variants would advertise a
    saving against a price the customer is not being offered.
    """
    variants = _sellable(product) or list(product.variants)
    if not variants:
        return None
    cheapest = min(variants, key=lambda v: v.price)
    return cheapest.compare_at_price


def primary_image(product: Product) -> ProductImage | None:
    """A studio shot if there is one, otherwise the first image.

    Cards are a grid of objects on a plain ground; a lifestyle shot in that
    grid reads as a different product entirely.
    """
    if not product.images:
        return None
    studio = [i for i in product.images if i.kind == "studio"]
    return (studio or product.images)[0]


def hover_image(product: Product) -> ProductImage | None:
    """The second image, for the card's hover swap. None when there is only
    one - a hover that swaps an image for itself reads as a flicker."""
    images = [i for i in product.images if i.id != (primary_image(product).id if product.images else None)]
    return images[0] if images else None


def in_stock(product: Product) -> bool:
    return any(v.in_stock for v in _sellable(product))


def total_stock(product: Product) -> int:
    return sum(v.stock_quantity for v in product.variants)


def is_low_stock(product: Product) -> bool:
    return any(
        v.is_active and not v.backorder_allowed and v.stock_quantity <= v.low_stock_threshold
        for v in product.variants
    )


def _dimensions(product: Product) -> tuple[int | None, int | None, int | None]:
    """The card shows one set of dimensions; use the "from"-priced variant's,
    the same one the price belongs to."""
    variants = _sellable(product) or list(product.variants)
    if not variants:
        return (None, None, None)
    v = min(variants, key=lambda x: x.price)
    return (v.width_mm, v.depth_mm, v.height_mm)


async def rating_map(db: AsyncSession, product_ids: list[int]) -> dict[int, tuple[float, int]]:
    """Approved-review averages for a whole page of products in one query.

    Product cards want a star rating; fetching reviews per card is the
    classic N+1 that made the previous backend drop ratings from listings
    altogether.
    """
    if not product_ids:
        return {}
    result = await db.execute(
        select(Review.product_id, func.avg(Review.rating), func.count(Review.id))
        .where(Review.product_id.in_(product_ids), Review.status == "approved")
        .group_by(Review.product_id)
    )
    return {row[0]: (round(float(row[1]), 2), int(row[2])) for row in result.all()}


def default_variant(product: Product) -> ProductVariant | None:
    """The cheapest active variant - the one the card's price belongs to."""
    variants = _sellable(product) or list(product.variants)
    return min(variants, key=lambda v: v.price) if variants else None


def to_card(product: Product, ratings: dict[int, tuple[float, int]] | None = None) -> ProductCard:
    width, depth, height = _dimensions(product)
    chosen = default_variant(product)
    rating = (ratings or {}).get(product.id)
    primary = primary_image(product)
    return ProductCard(
        id=product.id,
        name=product.name,
        slug=product.slug,
        tagline=product.tagline,
        brand=BrandOut.model_validate(product.brand) if product.brand else None,
        category=CategoryOut.model_validate(product.category) if product.category else None,
        price_from=price_from(product),
        compare_at_price=compare_at_for(product),
        primary_image=ImageOut.model_validate(primary) if primary else None,
        hover_image=ImageOut.model_validate(hover_image(product)) if hover_image(product) else None,
        in_stock=in_stock(product),
        variant_count=len(_sellable(product)),
        default_variant_id=chosen.id if chosen else None,
        width_mm=width,
        depth_mm=depth,
        height_mm=height,
        rating_average=rating[0] if rating else None,
        rating_count=rating[1] if rating else 0,
    )


def to_detail(
    product: Product,
    rating: tuple[float, int] | None = None,
    ar: dict | None = None,
) -> ProductDetail:
    return ProductDetail(
        id=product.id,
        name=product.name,
        slug=product.slug,
        tagline=product.tagline,
        description=product.description,
        status=product.status,
        brand=BrandOut.model_validate(product.brand) if product.brand else None,
        category=CategoryOut.model_validate(product.category) if product.category else None,
        rooms=[r for r in product.rooms],
        attributes=[a for a in product.attributes],
        variants=[
            VariantOut.model_validate({**v.__dict__, "in_stock": v.in_stock})
            for v in _sellable(product)
        ],
        images=[ImageOut.model_validate(i) for i in product.images],
        assembly_required=product.assembly_required,
        assembly_note=product.assembly_note,
        warranty_months=product.warranty_months,
        care_instructions=product.care_instructions,
        seating_capacity=product.seating_capacity,
        specifications=product.specifications,
        meta_title=product.meta_title,
        meta_description=product.meta_description,
        rating_average=rating[0] if rating else None,
        rating_count=rating[1] if rating else 0,
        ar=ar,
        created_at=product.created_at,
    )


def to_admin_row(product: Product, ar_status: str | None = None) -> ProductAdminRow:
    primary = primary_image(product)
    return ProductAdminRow(
        id=product.id,
        name=product.name,
        slug=product.slug,
        status=product.status,
        category=CategoryOut.model_validate(product.category) if product.category else None,
        brand=BrandOut.model_validate(product.brand) if product.brand else None,
        price_from=price_from(product),
        total_stock=total_stock(product),
        variant_count=len(product.variants),
        low_stock=is_low_stock(product),
        primary_image=ImageOut.model_validate(primary) if primary else None,
        updated_at=product.updated_at,
        ar_status=ar_status,
    )


def to_admin_detail(product: Product) -> dict:
    """The full product, including cost price and boxed dimensions the
    storefront must never see."""
    detail = to_detail(product)
    payload = detail.model_dump()
    payload["variants"] = [
        VariantAdminOut.model_validate({**v.__dict__, "in_stock": v.in_stock}).model_dump()
        for v in product.variants  # inactive ones included: the form edits them
    ]
    payload["room_ids"] = [r.id for r in product.rooms]
    payload["attribute_ids"] = [a.id for a in product.attributes]
    payload["category_id"] = product.category_id
    payload["brand_id"] = product.brand_id
    return payload
