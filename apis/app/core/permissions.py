"""The permission registry - the single source of truth for RBAC.

A permission is a `<group>.<action>` string. Roles hold a flat list of them;
the admin UI renders the groups below as checkbox sections, so adding a
capability here is all it takes for it to become grantable. Nothing else in
the codebase may invent a permission string that is not listed here - the
seeder validates every role against this registry.

`*` is the super-admin wildcard and is deliberately not grantable per-group:
a role either is the super admin or enumerates what it can do.
"""
from dataclasses import dataclass

WILDCARD = "*"


@dataclass(frozen=True)
class Permission:
    key: str
    label: str
    description: str


@dataclass(frozen=True)
class PermissionGroup:
    key: str
    label: str
    permissions: tuple[Permission, ...]


def _p(key: str, label: str, description: str) -> Permission:
    return Permission(key=key, label=label, description=description)


PERMISSION_GROUPS: tuple[PermissionGroup, ...] = (
    PermissionGroup("dashboard", "Dashboard", (
        _p("dashboard.view", "View dashboard", "Trading summary, alerts and recent activity."),
    )),
    PermissionGroup("catalog", "Catalogue", (
        _p("products.read", "View products", "Browse products, variants and stock."),
        _p("products.write", "Create and edit products", "Add products, edit copy, pricing, images and variants."),
        _p("products.delete", "Delete products", "Archive a product out of the catalogue."),
        _p("products.publish", "Publish and unpublish", "Control whether a product is visible in the shop."),
        _p("inventory.write", "Adjust stock", "Change on-hand quantities and low-stock thresholds."),
        _p("ar.manage", "Manage AR models", "Upload 3D models, check their scale, and publish AR."),
    )),
    PermissionGroup("taxonomy", "Taxonomy and attributes", (
        _p("taxonomy.read", "View taxonomy", "Categories, rooms, collections, brands, materials, finishes."),
        _p("taxonomy.write", "Manage taxonomy", "Create and edit any catalogue master."),
    )),
    PermissionGroup("orders", "Orders", (
        _p("orders.read", "View orders", "Order list, detail, invoices and packing slips."),
        _p("orders.fulfil", "Advance fulfilment", "Move orders through picking, packing and dispatch."),
        _p("orders.cancel", "Cancel orders", "Cancel an order on the customer's behalf."),
        _p("orders.refund", "Record refunds", "Record a refund against a paid order."),
    )),
    PermissionGroup("customers", "Customers", (
        _p("customers.read", "View customers", "Customer list, addresses and order history."),
        _p("customers.write", "Edit customers", "Edit customer details and suspend accounts."),
    )),
    PermissionGroup("marketing", "Marketing", (
        _p("coupons.read", "View discounts", "Coupons and automatic discount rules."),
        _p("coupons.write", "Manage discounts", "Create, edit and expire discounts."),
        _p("reviews.moderate", "Moderate reviews", "Approve, reject and reply to customer reviews."),
    )),
    PermissionGroup("content", "Content", (
        _p("content.read", "View content", "Pages, banners and homepage sections."),
        _p("content.write", "Manage content", "Edit pages, banners and the homepage."),
    )),
    PermissionGroup("reports", "Reports", (
        _p("reports.view", "View reports", "Sales, product, customer and fulfilment reporting."),
        _p("reports.export", "Export reports", "Download report data as CSV."),
    )),
    PermissionGroup("system", "System", (
        _p("staff.read", "View staff", "See staff accounts and their roles."),
        _p("staff.write", "Manage staff", "Invite, edit, deactivate and reset staff accounts."),
        _p("roles.read", "View roles", "See roles and what each one grants."),
        _p("roles.write", "Manage roles", "Create roles and change their permissions."),
        _p("audit.read", "View audit log", "Read the record of who changed what."),
        _p("settings.write", "Manage settings", "Store details, shipping rules and tax."),
    )),
)

ALL_PERMISSIONS: tuple[str, ...] = tuple(
    p.key for group in PERMISSION_GROUPS for p in group.permissions
)

PERMISSION_SET = frozenset(ALL_PERMISSIONS)


def is_valid(permission: str) -> bool:
    return permission == WILDCARD or permission in PERMISSION_SET


def normalise(permissions: list[str] | None) -> list[str]:
    """Drop unknown strings and de-duplicate, preserving registry order.

    Unknown permissions are dropped rather than rejected because they are
    almost always the residue of a capability that has since been removed;
    keeping them would let a role claim something no guard checks.
    """
    if not permissions:
        return []
    given = set(permissions)
    if WILDCARD in given:
        return [WILDCARD]
    return [p for p in ALL_PERMISSIONS if p in given]


def expand(permissions: list[str]) -> frozenset[str]:
    """Resolve a role's stored list into everything it actually allows."""
    if WILDCARD in permissions:
        return PERMISSION_SET
    return frozenset(permissions) & PERMISSION_SET


# Roles created by scripts/seed.py. `is_system` roles cannot be deleted and
# the super admin's permissions cannot be edited away - otherwise the last
# account able to fix a mistake can lock itself out.
SYSTEM_ROLES: tuple[dict, ...] = (
    {
        "slug": "super_admin",
        "name": "Super Admin",
        "description": "Unrestricted access, including staff and roles.",
        "permissions": [WILDCARD],
        "is_system": True,
    },
    {
        "slug": "store_manager",
        "name": "Store Manager",
        "description": "Runs the shop day to day. Everything except staff, roles and settings.",
        "permissions": [
            "dashboard.view",
            "products.read", "products.write", "products.publish", "inventory.write",
            "ar.manage",
            "taxonomy.read", "taxonomy.write",
            "orders.read", "orders.fulfil", "orders.cancel", "orders.refund",
            "customers.read", "customers.write",
            "coupons.read", "coupons.write", "reviews.moderate",
            "content.read", "content.write",
            "reports.view", "reports.export",
            "audit.read",
        ],
        "is_system": True,
    },
    {
        "slug": "catalogue_manager",
        "name": "Catalogue Manager",
        "description": "Owns products, taxonomy and merchandising. No access to orders or customers.",
        "permissions": [
            "dashboard.view",
            "products.read", "products.write", "products.publish", "products.delete",
            "inventory.write", "ar.manage", "taxonomy.read", "taxonomy.write",
            "content.read", "content.write", "reviews.moderate",
            "reports.view",
        ],
        "is_system": True,
    },
    {
        "slug": "order_manager",
        "name": "Order Manager",
        "description": "Fulfilment desk. Orders and customers, read-only catalogue.",
        "permissions": [
            "dashboard.view",
            "products.read", "taxonomy.read",
            "orders.read", "orders.fulfil", "orders.cancel",
            "customers.read",
            "reports.view",
        ],
        "is_system": True,
    },
    {
        "slug": "support_agent",
        "name": "Support Agent",
        "description": "Answers customers. Can read orders and reply to reviews, cannot change stock or pricing.",
        "permissions": [
            "dashboard.view",
            "products.read", "taxonomy.read",
            "orders.read",
            "customers.read", "customers.write",
            "reviews.moderate",
        ],
        "is_system": True,
    },
    {
        "slug": "viewer",
        "name": "Viewer",
        "description": "Read-only across the dashboard. Useful for finance and stakeholders.",
        "permissions": [
            "dashboard.view",
            "products.read", "taxonomy.read", "orders.read", "customers.read",
            "coupons.read", "content.read", "reports.view", "reports.export",
        ],
        "is_system": True,
    },
)
