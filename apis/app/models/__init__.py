"""Every model, imported here so `Base.metadata` is complete.

Importing this module is what makes create_all and Alembic autogenerate see
the full schema; a model that is only imported by the router that uses it
will be missing from a fresh database.
"""
from app.models.ar import AR_STATUSES, DIMENSION_TOLERANCE, ArEvent, ProductArAsset
from app.models.base import Base, TimestampMixin
from app.models.catalog import (
    Attribute, Brand, Category, Collection, CollectionProduct, InventoryMovement,
    Product, ProductAttribute, ProductImage, ProductRoom, ProductVariant,
    RecentlyViewed, Review, Room, Wishlist, PRODUCT_STATUSES,
)
from app.models.commerce import (
    Cart, CartItem, Coupon, CouponRedemption, FULFILMENT_FLOW,
    FULFILMENT_STATUSES, Order, OrderEvent, OrderItem, PAYMENT_STATUSES,
    Payment, ShippingRate,
)
from app.models.content import Banner, HomepageSection, Page, Setting
from app.models.customer import Address, Customer, OtpChallenge
from app.models.rbac import Role, StaffUser
from app.models.system import AuditLog

__all__ = [
    "Base", "TimestampMixin",
    "AR_STATUSES", "DIMENSION_TOLERANCE", "ArEvent", "ProductArAsset",
    "Attribute", "Brand", "Category", "Collection", "CollectionProduct",
    "InventoryMovement", "Product", "ProductAttribute", "ProductImage",
    "ProductRoom", "ProductVariant", "RecentlyViewed", "Review", "Room",
    "Wishlist", "PRODUCT_STATUSES",
    "Cart", "CartItem", "Coupon", "CouponRedemption", "FULFILMENT_FLOW",
    "FULFILMENT_STATUSES", "Order", "OrderEvent", "OrderItem",
    "PAYMENT_STATUSES", "Payment", "ShippingRate",
    "Banner", "HomepageSection", "Page", "Setting",
    "Address", "Customer", "OtpChallenge",
    "Role", "StaffUser",
    "AuditLog",
]
