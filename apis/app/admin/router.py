from fastapi import APIRouter

from app.admin.routes import (
    ar, auth, content, customers, insights, marketing, orders, products, roles,
    staff, taxonomy,
)

admin_router = APIRouter()

# Auth first so /auth/login is reachable without a token; every other router
# below carries its own per-endpoint permission guard.
admin_router.include_router(auth.router)
admin_router.include_router(insights.router)
admin_router.include_router(products.router)
admin_router.include_router(taxonomy.router)
admin_router.include_router(ar.router)
admin_router.include_router(orders.router)
admin_router.include_router(customers.router)
admin_router.include_router(marketing.router)
admin_router.include_router(content.router)
admin_router.include_router(staff.router)
admin_router.include_router(roles.router)
