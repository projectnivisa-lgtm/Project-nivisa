from fastapi import APIRouter

from app.storefront.routes import (
    account, auth, cart, catalog, content, mock_checkout, orders,
)

storefront_router = APIRouter()

storefront_router.include_router(auth.router)
storefront_router.include_router(catalog.router)
storefront_router.include_router(cart.router)
storefront_router.include_router(orders.router)
storefront_router.include_router(account.router)
storefront_router.include_router(content.router)

# The mock payment screen. Its routes are only registered outside production
# - see the module - so this include is a no-op on a live box.
storefront_router.include_router(mock_checkout.router)
