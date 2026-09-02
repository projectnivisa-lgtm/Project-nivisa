"""The furniture catalogue.

Shape decisions worth knowing:

- A product owns one or more **variants**, and a variant is the thing that
  carries SKU, price and stock. A sofa in three finishes is one product and
  three variants, so the shop can show one card, one review thread and one
  price-from, while the warehouse counts three sellable things. Products
  with a single option still get one variant, so nothing downstream needs a
  "does this have variants" branch.
- **Dimensions are numeric columns**, not free text. Filtering "under 200cm
  wide" and "will it fit" are the two questions a furniture buyer actually
  asks, and neither can be answered by parsing a string at read time.
- Categories, rooms and collections are three separate taxonomies rather
  than one tree with a `type` column. They behave differently: a category is
  hierarchical and a product has exactly one, a room is flat and a product
  has several, a collection is merchandiser-curated and ordered by hand.
"""
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, Date, ForeignKey, Index, Integer, Numeric,
    String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Category(Base, TimestampMixin):
    """Hierarchical: Seating > Sofas > 3-seaters. A product sits on a leaf."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text())
    image_url: Mapped[str | None] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    parent: Mapped["Category | None"] = relationship(remote_side="Category.id", back_populates="children")
    children: Mapped[list["Category"]] = relationship(back_populates="parent")


class Room(Base, TimestampMixin):
    """Living, Bedroom, Dining, Study, Kids, Outdoor. Flat, many-per-product."""

    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text())
    image_url: Mapped[str | None] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Collection(Base, TimestampMixin):
    """Merchandiser-created rails. Replaces the eight hardcoded flag tables
    the copied backend used, which no one could add a ninth to."""

    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text())
    image_url: Mapped[str | None] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Shown on the homepage rails. A collection can exist for a campaign URL
    # without taking a slot on the front page.
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Brand(Base, TimestampMixin):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text())
    logo_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Attribute(Base, TimestampMixin):
    """One table for material, finish, colour, style and upholstery.

    Five near-identical tables was the alternative; they would need five sets
    of CRUD endpoints, five admin screens and a sixth the day someone wants
    "leg type". `kind` keeps one of each.
    """

    __tablename__ = "attributes"
    __table_args__ = (
        UniqueConstraint("kind", "slug", name="uq_attribute_kind_slug"),
        CheckConstraint(
            "kind IN ('material', 'finish', 'colour', 'style', 'upholstery')",
            name="ck_attribute_kind",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), index=True)
    # Colours need a swatch; the other kinds leave this null.
    hex_code: Mapped[str | None] = mapped_column(String(9))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# --- Join tables -----------------------------------------------------------


class ProductRoom(Base):
    __tablename__ = "product_rooms"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), primary_key=True)


class ProductAttribute(Base):
    __tablename__ = "product_attributes"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    attribute_id: Mapped[int] = mapped_column(ForeignKey("attributes.id", ondelete="CASCADE"), primary_key=True)


class CollectionProduct(Base):
    __tablename__ = "collection_products"

    collection_id: Mapped[int] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    # Merchandiser-controlled order within the rail.
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


# --- Product ---------------------------------------------------------------


PRODUCT_STATUSES = ("draft", "active", "archived")


class Product(Base, TimestampMixin):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'active', 'archived')", name="ck_product_status"),
        Index("ix_products_status_created", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(240), index=True)
    slug: Mapped[str] = mapped_column(String(260), unique=True, index=True)
    # Short line under the name on a card; the long copy is `description`.
    tagline: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text())

    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    brand_id: Mapped[int | None] = mapped_column(ForeignKey("brands.id", ondelete="SET NULL"), index=True)

    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False, index=True)

    # Furniture-specific trust copy. Null means "we have nothing to say",
    # and the storefront hides the section rather than inventing filler.
    assembly_required: Mapped[bool | None] = mapped_column(Boolean)
    assembly_note: Mapped[str | None] = mapped_column(Text())
    warranty_months: Mapped[int | None] = mapped_column(Integer)
    care_instructions: Mapped[str | None] = mapped_column(Text())
    seating_capacity: Mapped[int | None] = mapped_column(Integer)

    # Free-form spec rows the buyer sees as a table: [{label, value}].
    # Anything worth filtering on gets a column or an Attribute instead.
    specifications: Mapped[list[dict] | None] = mapped_column(JSONB)

    meta_title: Mapped[str | None] = mapped_column(String(200))
    meta_description: Mapped[str | None] = mapped_column(String(400))

    category: Mapped[Category | None] = relationship(lazy="selectin")
    brand: Mapped[Brand | None] = relationship(lazy="selectin")
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", lazy="selectin",
        order_by="ProductVariant.position",
    )
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", lazy="selectin",
        order_by="ProductImage.position",
    )
    rooms: Mapped[list[Room]] = relationship(secondary="product_rooms", lazy="selectin")
    attributes: Mapped[list[Attribute]] = relationship(secondary="product_attributes", lazy="selectin")


class ProductVariant(Base, TimestampMixin):
    """The sellable unit. Price and stock live here, never on Product."""

    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("sku", name="uq_variant_sku"),
        CheckConstraint("price >= 0", name="ck_variant_price_non_negative"),
        CheckConstraint("stock_quantity >= 0", name="ck_variant_stock_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    product: Mapped[Product] = relationship(back_populates="variants")

    sku: Mapped[str] = mapped_column(String(64), index=True)
    # "Walnut / 3-seater". Null on a single-variant product, where showing a
    # selector with one option is noise.
    option_label: Mapped[str | None] = mapped_column(String(160))

    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # What the piece used to cost. Rendered struck-through, and only when it
    # is genuinely higher than `price`.
    compare_at_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    cost_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("18.00"), nullable=False)

    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    # Made-to-order pieces sell past zero on purpose.
    backorder_allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Millimetres and kilograms, assembled. Integers because a millimetre is
    # already finer than any furniture spec sheet, and floats would make
    # "under 2000mm wide" filters unreliable at the boundary.
    width_mm: Mapped[int | None] = mapped_column(Integer)
    depth_mm: Mapped[int | None] = mapped_column(Integer)
    height_mm: Mapped[int | None] = mapped_column(Integer)
    weight_g: Mapped[int | None] = mapped_column(Integer)

    # Deliverability: a 2.4m sofa does not go up every staircase.
    boxed_width_mm: Mapped[int | None] = mapped_column(Integer)
    boxed_depth_mm: Mapped[int | None] = mapped_column(Integer)
    boxed_height_mm: Mapped[int | None] = mapped_column(Integer)

    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    @property
    def in_stock(self) -> bool:
        return self.backorder_allowed or self.stock_quantity > 0


class ProductImage(Base, TimestampMixin):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    product: Mapped[Product] = relationship(back_populates="images")

    url: Mapped[str] = mapped_column(String(500))
    # Required, not optional: a furniture catalogue without alt text is
    # unusable on a screen reader, and the admin form enforces it.
    alt_text: Mapped[str] = mapped_column(String(300), default="")
    # "studio" | "lifestyle" | "detail" | "dimension" - the storefront
    # gallery orders by kind, and the card only ever uses a studio shot.
    kind: Mapped[str] = mapped_column(String(24), default="studio", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Set when the image belongs to one finish rather than the product.
    variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="CASCADE"), index=True
    )


class Review(Base, TimestampMixin):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_review_rating"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_review_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text())
    author_name: Mapped[str] = mapped_column(String(160), default="")

    # Reviews are held until a moderator releases them. Furniture reviews
    # attract spam, and an unmoderated stream on a product page is worse
    # than none.
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False, index=True)
    # Set from the customer's own order history at submit time, never by the
    # reviewer, so the badge on the storefront means something.
    is_verified_purchase: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    staff_reply: Mapped[str | None] = mapped_column(Text())


class Wishlist(Base, TimestampMixin):
    __tablename__ = "wishlists"
    __table_args__ = (UniqueConstraint("customer_id", "product_id", name="uq_wishlist_customer_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)


class RecentlyViewed(Base, TimestampMixin):
    __tablename__ = "recently_viewed"
    __table_args__ = (UniqueConstraint("customer_id", "product_id", name="uq_recent_customer_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)


class InventoryMovement(Base, TimestampMixin):
    """Every stock change, with a reason. Without this a variant's count is
    a number nobody can explain, and shrinkage is invisible."""

    __tablename__ = "inventory_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id", ondelete="CASCADE"), index=True)
    # Negative for a sale, positive for a receipt or a cancellation restock.
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    # 'sale' | 'restock' | 'adjustment' | 'cancellation' | 'return'
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    note: Mapped[str | None] = mapped_column(String(300))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))
    staff_user_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"))
