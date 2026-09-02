from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ApiModel

AttributeKind = Literal["material", "finish", "colour", "style", "upholstery"]
ImageKind = Literal["studio", "lifestyle", "detail", "dimension"]
ProductStatus = Literal["draft", "active", "archived"]


# --- Taxonomy ---------------------------------------------------------------


class TaxonomyBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str | None = Field(None, max_length=180)
    description: str | None = None
    image_url: str | None = None
    position: int = 0
    is_active: bool = True


class CategoryCreate(TaxonomyBase):
    parent_id: int | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=160)
    slug: str | None = None
    parent_id: int | None = None
    description: str | None = None
    image_url: str | None = None
    position: int | None = None
    is_active: bool | None = None


class CategoryOut(ApiModel):
    id: int
    parent_id: int | None
    name: str
    slug: str
    description: str | None
    image_url: str | None
    position: int
    is_active: bool


class CategoryTree(CategoryOut):
    children: list["CategoryTree"] = []
    product_count: int = 0


class RoomCreate(TaxonomyBase):
    pass


class RoomOut(ApiModel):
    id: int
    name: str
    slug: str
    description: str | None
    image_url: str | None
    position: int
    is_active: bool


class CollectionCreate(TaxonomyBase):
    is_featured: bool = False


class CollectionOut(RoomOut):
    is_featured: bool
    product_count: int = 0


class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str | None = None
    description: str | None = None
    logo_url: str | None = None
    is_active: bool = True


class BrandOut(ApiModel):
    id: int
    name: str
    slug: str
    description: str | None
    logo_url: str | None
    is_active: bool


class AttributeCreate(BaseModel):
    kind: AttributeKind
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = None
    hex_code: str | None = Field(None, max_length=9)
    position: int = 0
    is_active: bool = True

    @field_validator("hex_code")
    @classmethod
    def _valid_hex(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if not value.startswith("#") or len(value) not in (4, 7, 9):
            raise ValueError("Colour must be a hex value such as #8B5E3C.")
        return value


class AttributeOut(ApiModel):
    id: int
    kind: str
    name: str
    slug: str
    hex_code: str | None
    position: int
    is_active: bool


# --- Product ----------------------------------------------------------------


class VariantIn(BaseModel):
    id: int | None = None  # present when editing an existing variant
    sku: str = Field(min_length=1, max_length=64)
    option_label: str | None = Field(None, max_length=160)
    price: Decimal = Field(ge=0, decimal_places=2)
    compare_at_price: Decimal | None = Field(None, ge=0)
    cost_price: Decimal | None = Field(None, ge=0)
    tax_rate: Decimal = Field(Decimal("18.00"), ge=0, le=100)
    stock_quantity: int = Field(0, ge=0)
    low_stock_threshold: int = Field(3, ge=0)
    backorder_allowed: bool = False
    width_mm: int | None = Field(None, ge=0, le=100_000)
    depth_mm: int | None = Field(None, ge=0, le=100_000)
    height_mm: int | None = Field(None, ge=0, le=100_000)
    weight_g: int | None = Field(None, ge=0)
    boxed_width_mm: int | None = Field(None, ge=0, le=100_000)
    boxed_depth_mm: int | None = Field(None, ge=0, le=100_000)
    boxed_height_mm: int | None = Field(None, ge=0, le=100_000)
    lead_time_days: int | None = Field(None, ge=0, le=365)
    position: int = 0
    is_active: bool = True

    @field_validator("compare_at_price")
    @classmethod
    def _no_fake_discount(cls, value: Decimal | None, info) -> Decimal | None:
        # A compare-at below the selling price renders as a struck-through
        # number that is *lower* than what you pay. Reject it here rather
        # than teaching every surface to hide it.
        price = info.data.get("price")
        if value is not None and price is not None and value <= price:
            raise ValueError("Compare-at price must be higher than the selling price, or left blank.")
        return value


class VariantOut(ApiModel):
    id: int
    sku: str
    option_label: str | None
    price: Decimal
    compare_at_price: Decimal | None
    tax_rate: Decimal
    stock_quantity: int
    low_stock_threshold: int
    backorder_allowed: bool
    in_stock: bool
    width_mm: int | None
    depth_mm: int | None
    height_mm: int | None
    weight_g: int | None
    lead_time_days: int | None
    position: int
    is_active: bool


class VariantAdminOut(VariantOut):
    cost_price: Decimal | None
    boxed_width_mm: int | None
    boxed_depth_mm: int | None
    boxed_height_mm: int | None


class ImageIn(BaseModel):
    id: int | None = None
    url: str = Field(min_length=1, max_length=500)
    # Required with a minimum length, not merely present: an empty alt on a
    # product photo is the same failure as a missing one.
    alt_text: str = Field(min_length=3, max_length=300)
    kind: ImageKind = "studio"
    position: int = 0
    variant_id: int | None = None


class ImageOut(ApiModel):
    id: int
    url: str
    alt_text: str
    kind: str
    position: int
    variant_id: int | None


class SpecRow(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=200)


class ProductWrite(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    slug: str | None = None
    tagline: str | None = Field(None, max_length=300)
    description: str | None = None
    category_id: int | None = None
    brand_id: int | None = None
    status: ProductStatus = "draft"
    assembly_required: bool | None = None
    assembly_note: str | None = None
    warranty_months: int | None = Field(None, ge=0, le=1200)
    care_instructions: str | None = None
    seating_capacity: int | None = Field(None, ge=0, le=50)
    specifications: list[SpecRow] | None = None
    meta_title: str | None = Field(None, max_length=200)
    meta_description: str | None = Field(None, max_length=400)
    room_ids: list[int] = []
    attribute_ids: list[int] = []
    variants: list[VariantIn] = Field(min_length=1)
    images: list[ImageIn] = []

    @field_validator("variants")
    @classmethod
    def _unique_skus(cls, variants: list[VariantIn]) -> list[VariantIn]:
        skus = [v.sku.strip().upper() for v in variants]
        if len(set(skus)) != len(skus):
            raise ValueError("Each variant needs its own SKU.")
        return variants


class ProductUpdate(ProductWrite):
    # Same shape as create: a product form that submits the whole product is
    # far easier to reason about than one that has to diff variants and
    # images client-side and send three separate calls.
    pass


class ProductCard(ApiModel):
    """The shape a grid needs. Deliberately smaller than ProductDetail -
    a 48-product listing that returned full detail would ship every spec
    row and every description to render a name and a price."""

    id: int
    name: str
    slug: str
    tagline: str | None
    brand: BrandOut | None
    category: CategoryOut | None
    price_from: Decimal
    compare_at_price: Decimal | None
    primary_image: ImageOut | None
    hover_image: ImageOut | None
    in_stock: bool
    variant_count: int
    # The variant the "from" price belongs to. A card with exactly one variant
    # can be added to the cart straight from a grid or a wishlist; with more
    # than one the shopper has to choose, and the card links to the product
    # page instead. Without this the card knows a price but not what it is a
    # price *for*, and "add to cart" from a grid is impossible.
    default_variant_id: int | None
    width_mm: int | None
    depth_mm: int | None
    height_mm: int | None
    rating_average: float | None = None
    rating_count: int = 0


class ProductDetail(ApiModel):
    id: int
    name: str
    slug: str
    tagline: str | None
    description: str | None
    status: str
    brand: BrandOut | None
    category: CategoryOut | None
    rooms: list[RoomOut]
    attributes: list[AttributeOut]
    variants: list[VariantOut]
    images: list[ImageOut]
    assembly_required: bool | None
    assembly_note: str | None
    warranty_months: int | None
    care_instructions: str | None
    seating_capacity: int | None
    specifications: list[dict] | None
    meta_title: str | None
    meta_description: str | None
    rating_average: float | None = None
    rating_count: int = 0
    # Present only for a published, scale-checked model. Absent is the honest
    # default: most furniture has no 3D model, and the page hides the AR
    # button rather than offering one that cannot work.
    ar: dict | None = None
    created_at: datetime


class ProductAdminRow(ApiModel):
    id: int
    name: str
    slug: str
    status: str
    category: CategoryOut | None
    brand: BrandOut | None
    price_from: Decimal
    total_stock: int
    variant_count: int
    low_stock: bool
    primary_image: ImageOut | None
    updated_at: datetime
    # None where the product has no AR row at all, which reads the same as
    # "unavailable" to a merchandiser and is what lets the product list answer
    # "which of these still needs a model" without opening each one.
    ar_status: str | None = None


class StockAdjustment(BaseModel):
    variant_id: int
    # Signed: -2 for a damaged pair, +10 for a delivery. An absolute
    # "set to N" loses the reason and races with a concurrent sale.
    delta: int
    reason: Literal["restock", "adjustment", "return"] = "adjustment"
    note: str | None = Field(None, max_length=300)


# --- Reviews ----------------------------------------------------------------


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(None, max_length=200)
    body: str | None = Field(None, max_length=4000)
    author_name: str | None = Field(None, max_length=160)


class ReviewOut(ApiModel):
    id: int
    product_id: int
    rating: int
    title: str | None
    body: str | None
    author_name: str
    status: str
    is_verified_purchase: bool
    staff_reply: str | None
    created_at: datetime


class ReviewModeration(BaseModel):
    status: Literal["pending", "approved", "rejected"] | None = None
    staff_reply: str | None = Field(None, max_length=2000)


CategoryTree.model_rebuild()
