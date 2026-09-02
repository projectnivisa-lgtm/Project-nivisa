from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ApiModel

FulfilmentStatus = Literal[
    "pending", "processing", "packed", "dispatched", "delivered", "cancelled", "returned"
]
PaymentStatus = Literal["pending", "paid", "failed", "refunded", "partially_refunded"]


# --- Cart -------------------------------------------------------------------


class CartItemIn(BaseModel):
    variant_id: int
    quantity: int = Field(1, ge=1, le=99)


class CartItemQuantity(BaseModel):
    """Updating an existing line changes only how many.

    A separate model from CartItemIn because the line already knows which
    variant it is - requiring the caller to resend it invites a mismatch
    nobody would notice until the wrong thing shipped.
    """

    quantity: int = Field(ge=1, le=99)


class CartItemOut(ApiModel):
    id: int
    variant_id: int
    product_id: int
    product_name: str
    product_slug: str
    variant_label: str | None
    sku: str
    image_url: str | None
    unit_price: Decimal
    quantity: int
    line_total: Decimal
    in_stock: bool
    # How many can actually be bought right now. The cart shows this rather
    # than silently trimming the quantity the customer chose.
    available_quantity: int
    lead_time_days: int | None


class CartTotals(ApiModel):
    subtotal: Decimal
    discount_total: Decimal
    shipping_total: Decimal
    tax_total: Decimal
    grand_total: Decimal
    item_count: int


class CartOut(ApiModel):
    id: int
    items: list[CartItemOut]
    totals: CartTotals
    coupon_code: str | None
    coupon_message: str | None = None
    currency: str


class CouponApply(BaseModel):
    code: str = Field(min_length=1, max_length=40)


# --- Checkout and orders ----------------------------------------------------


class CheckoutRequest(BaseModel):
    shipping_address_id: int
    billing_address_id: int | None = None
    customer_note: str | None = Field(None, max_length=1000)


class OrderItemOut(ApiModel):
    id: int
    product_id: int | None
    variant_id: int | None
    product_name: str
    variant_label: str | None
    sku: str
    image_url: str | None
    unit_price: Decimal
    quantity: int
    tax_amount: Decimal
    line_total: Decimal


class OrderEventOut(ApiModel):
    id: int
    kind: str
    message: str
    from_value: str | None
    to_value: str | None
    staff_name: str | None
    created_at: datetime


class OrderSummary(ApiModel):
    id: int
    order_number: str
    fulfilment_status: str
    payment_status: str
    grand_total: Decimal
    currency: str
    item_count: int
    placed_at: datetime | None
    created_at: datetime


class OrderDetail(ApiModel):
    id: int
    order_number: str
    fulfilment_status: str
    payment_status: str
    subtotal: Decimal
    discount_total: Decimal
    shipping_total: Decimal
    tax_total: Decimal
    grand_total: Decimal
    refunded_total: Decimal
    currency: str
    coupon_code: str | None
    shipping_address: dict
    billing_address: dict | None
    customer_note: str | None
    courier_name: str | None
    tracking_number: str | None
    tracking_url: str | None
    expected_delivery_date: date | None
    placed_at: datetime | None
    paid_at: datetime | None
    dispatched_at: datetime | None
    delivered_at: datetime | None
    cancelled_at: datetime | None
    cancellation_reason: str | None
    items: list[OrderItemOut]
    is_cancellable: bool
    created_at: datetime


class AdminOrderDetail(OrderDetail):
    customer_id: int | None
    customer_name: str | None
    customer_phone: str | None
    customer_email: str | None
    staff_note: str | None
    events: list[OrderEventOut]
    # What this order is legally allowed to become next, computed from the
    # flow table. The dashboard renders buttons from this rather than
    # keeping its own copy of the ladder.
    allowed_transitions: list[str]


class PaymentSessionOut(ApiModel):
    order_number: str
    reference: str
    redirect_url: str
    provider: str


class OrderStatusUpdate(BaseModel):
    status: FulfilmentStatus
    note: str | None = Field(None, max_length=400)
    notify_customer: bool = True


class OrderDispatch(BaseModel):
    courier_name: str = Field(min_length=1, max_length=120)
    tracking_number: str = Field(min_length=1, max_length=120)
    tracking_url: str | None = Field(None, max_length=500)
    expected_delivery_date: date | None = None


class OrderCancel(BaseModel):
    reason: str = Field(min_length=1, max_length=300)
    restock: bool = True


class OrderRefund(BaseModel):
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=1, max_length=300)


class OrderNote(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


# --- Discounts --------------------------------------------------------------


class CouponWrite(BaseModel):
    code: str = Field(min_length=3, max_length=40)
    description: str | None = Field(None, max_length=300)
    discount_type: Literal["percent", "fixed"]
    discount_value: Decimal = Field(gt=0)
    max_discount: Decimal | None = Field(None, gt=0)
    min_order_value: Decimal = Field(Decimal("0"), ge=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    usage_limit: int | None = Field(None, ge=1)
    usage_limit_per_customer: int | None = Field(None, ge=1)
    is_active: bool = True


class CouponOut(ApiModel):
    id: int
    code: str
    description: str | None
    discount_type: str
    discount_value: Decimal
    max_discount: Decimal | None
    min_order_value: Decimal
    starts_at: datetime | None
    ends_at: datetime | None
    usage_limit: int | None
    usage_limit_per_customer: int | None
    used_count: int
    is_active: bool


class ShippingRateWrite(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    postcode_prefixes: str = ""
    rate: Decimal = Field(Decimal("0"), ge=0)
    free_above: Decimal | None = Field(None, ge=0)
    estimated_days_min: int | None = Field(None, ge=0, le=180)
    estimated_days_max: int | None = Field(None, ge=0, le=180)
    position: int = 0
    is_active: bool = True


class ShippingRateOut(ApiModel):
    id: int
    name: str
    postcode_prefixes: str
    rate: Decimal
    free_above: Decimal | None
    estimated_days_min: int | None
    estimated_days_max: int | None
    position: int
    is_active: bool
