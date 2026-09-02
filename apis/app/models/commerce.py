"""Cart, checkout, orders, payments and discounts.

The copied backend derived an order's state from four independent integer
columns (`status`, `payment_status`, `process_status`, `shipping_status`),
which meant no query could filter on "shipped" without reproducing a
five-branch derivation in SQL. Here fulfilment and payment are two explicit
enums on two axes, because they genuinely are independent - a paid order can
be unfulfilled, and a dispatched order can be refunded - but each axis is one
column with one legal set of values, enforced by a CHECK constraint.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer,
    Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

# --- Status vocabularies ---------------------------------------------------

FULFILMENT_STATUSES = ("pending", "processing", "packed", "dispatched", "delivered", "cancelled", "returned")
PAYMENT_STATUSES = ("pending", "paid", "failed", "refunded", "partially_refunded")

# The one legal forward path. Staff advance an order one step at a time;
# cancellation and return are the only jumps, and both are separate actions
# with their own permission.
FULFILMENT_FLOW: dict[str, tuple[str, ...]] = {
    "pending": ("processing", "cancelled"),
    "processing": ("packed", "cancelled"),
    "packed": ("dispatched", "cancelled"),
    "dispatched": ("delivered", "returned"),
    "delivered": ("returned",),
    "cancelled": (),
    "returned": (),
}


class Cart(Base, TimestampMixin):
    """One open cart per customer, or per anonymous session token.

    `session_token` exists so a visitor can fill a cart before logging in;
    on login the anonymous cart is merged into the customer's own.
    """

    __tablename__ = "carts"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    session_token: Mapped[str | None] = mapped_column(String(64), index=True)
    coupon_code: Mapped[str | None] = mapped_column(String(40))

    items: Mapped[list["CartItem"]] = relationship(
        back_populates="cart", cascade="all, delete-orphan", lazy="selectin"
    )


class CartItem(Base, TimestampMixin):
    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint("cart_id", "variant_id", name="uq_cart_variant"),
        CheckConstraint("quantity > 0", name="ck_cart_item_quantity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    cart_id: Mapped[int] = mapped_column(ForeignKey("carts.id", ondelete="CASCADE"), index=True)
    cart: Mapped[Cart] = relationship(back_populates="items")
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id", ondelete="CASCADE"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class Order(Base, TimestampMixin):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "fulfilment_status IN ('pending','processing','packed','dispatched','delivered','cancelled','returned')",
            name="ck_order_fulfilment_status",
        ),
        CheckConstraint(
            "payment_status IN ('pending','paid','failed','refunded','partially_refunded')",
            name="ck_order_payment_status",
        ),
        Index("ix_orders_status_placed", "fulfilment_status", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Human-facing reference, e.g. NIV-2026-000148. Quoted on the phone, so
    # it is short and has no ambiguous characters.
    order_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)

    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    customer: Mapped["object"] = relationship("Customer", lazy="joined")

    fulfilment_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    payment_status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)

    # Money. Every figure the customer was shown is stored, not recomputed:
    # a discount rule edited next month must not silently restate a past
    # order's total.
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    discount_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    shipping_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    refunded_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)

    coupon_code: Mapped[str | None] = mapped_column(String(40))

    # The address as it was at checkout, copied rather than referenced. A
    # customer editing their address later must not rewrite where a parcel
    # was actually sent.
    shipping_address: Mapped[dict] = mapped_column(JSONB, nullable=False)
    billing_address: Mapped[dict | None] = mapped_column(JSONB)

    customer_note: Mapped[str | None] = mapped_column(Text())
    staff_note: Mapped[str | None] = mapped_column(Text())

    courier_name: Mapped[str | None] = mapped_column(String(120))
    tracking_number: Mapped[str | None] = mapped_column(String(120))
    tracking_url: Mapped[str | None] = mapped_column(String(500))

    placed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(String(300))
    expected_delivery_date: Mapped[Date | None] = mapped_column(Date())

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )
    events: Mapped[list["OrderEvent"]] = relationship(
        back_populates="order", cascade="all, delete-orphan",
        order_by="OrderEvent.created_at",
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def is_cancellable_by_customer(self) -> bool:
        """Unpaid and not yet picked. A paid order is cancelled by staff so
        the refund is handled deliberately rather than as a side effect."""
        return self.payment_status == "pending" and self.fulfilment_status in ("pending", "processing")


class OrderItem(Base, TimestampMixin):
    """A line, frozen at checkout.

    Product name, SKU and image are copied, not joined. A product renamed or
    archived next year must not change what a past invoice says was bought.
    """

    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    order: Mapped[Order] = relationship(back_populates="items")

    # Nullable so archiving a product never orphans an order.
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("product_variants.id", ondelete="SET NULL"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))

    product_name: Mapped[str] = mapped_column(String(240))
    variant_label: Mapped[str | None] = mapped_column(String(160))
    sku: Mapped[str] = mapped_column(String(64))
    image_url: Mapped[str | None] = mapped_column(String(500))

    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


class OrderEvent(Base, TimestampMixin):
    """Append-only history. Every status change writes one, so "who marked
    this dispatched and when" is answerable without reading the audit log."""

    __tablename__ = "order_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    order: Mapped[Order] = relationship(back_populates="events")

    kind: Mapped[str] = mapped_column(String(32))  # status | payment | note | notification
    message: Mapped[str] = mapped_column(String(400))
    from_value: Mapped[str | None] = mapped_column(String(40))
    to_value: Mapped[str | None] = mapped_column(String(40))
    staff_user_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"))
    staff_name: Mapped[str | None] = mapped_column(String(160))
    # True when the customer was told - keeps staff from double-notifying.
    customer_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('initiated','succeeded','failed','refunded')", name="ck_payment_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    order: Mapped[Order] = relationship(back_populates="payments")

    # "mock" in Docker, "phonepe" in production. Stored on the row so a
    # ledger restored from a provider switch still says who took the money.
    provider: Mapped[str] = mapped_column(String(32))
    provider_reference: Mapped[str | None] = mapped_column(String(120), index=True)
    method: Mapped[str | None] = mapped_column(String(40))  # upi, card, netbanking
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="initiated", nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String(300))
    raw_response: Mapped[dict | None] = mapped_column(JSONB)


class Coupon(Base, TimestampMixin):
    __tablename__ = "coupons"
    __table_args__ = (
        CheckConstraint("discount_type IN ('percent', 'fixed')", name="ck_coupon_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(300))

    discount_type: Mapped[str] = mapped_column(String(10), nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Caps a percentage coupon. Without it "20% off" on a ten-lakh order is
    # a two-lakh giveaway nobody signed off on.
    max_discount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    min_order_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    usage_limit: Mapped[int | None] = mapped_column(Integer)
    usage_limit_per_customer: Mapped[int | None] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CouponRedemption(Base, TimestampMixin):
    """Needed for per-customer limits; `used_count` alone cannot answer
    "has this person used it already"."""

    __tablename__ = "coupon_redemptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    coupon_id: Mapped[int] = mapped_column(ForeignKey("coupons.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


class ShippingRate(Base, TimestampMixin):
    """Flat rate per zone, free above a threshold.

    Furniture shipping is really priced by volume and destination; this is
    the smallest model that is honest about what it charges, and the fields
    a volumetric rate needs (boxed dimensions) already exist on the variant
    for when that day comes.
    """

    __tablename__ = "shipping_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    # Comma-separated postcode prefixes. Empty means "everywhere else" -
    # the fallback rate, and there should be exactly one.
    postcode_prefixes: Mapped[str] = mapped_column(String(500), default="")
    rate: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    free_above: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    estimated_days_min: Mapped[int | None] = mapped_column(Integer)
    estimated_days_max: Mapped[int | None] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
