"""Authentication and permission guards.

Every admin endpoint declares what it needs:

    @router.post("", dependencies=[Depends(require("products.write"))])

`require` returns a dependency rather than a decorator so the permission is
visible in the OpenAPI schema and in the route table - a guard applied inside
a function body is a guard nobody can audit by reading the router.

The staff row is re-read from the database on every request rather than
trusted from the token. A role edited or an account deactivated must take
effect immediately; a token minted an hour ago would otherwise carry stale
permissions until it expired.
"""
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import permissions as perms
from app.core.database import get_db
from app.core.security import ADMIN_AUDIENCE, CUSTOMER_AUDIENCE, decode_token
from app.models.customer import Customer
from app.models.rbac import StaffUser

bearer = HTTPBearer(auto_error=False)
optional_bearer = HTTPBearer(auto_error=False)


@dataclass
class AdminPrincipal:
    user: StaffUser
    granted: frozenset[str]

    def can(self, permission: str) -> bool:
        return permission in self.granted

    @property
    def is_super_admin(self) -> bool:
        return perms.WILDCARD in (self.user.role.permissions or [])


def _unauthorised(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_staff(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> AdminPrincipal:
    if credentials is None:
        raise _unauthorised("Sign in to continue.")
    try:
        payload = decode_token(credentials.credentials, ADMIN_AUDIENCE)
    except jwt.ExpiredSignatureError:
        raise _unauthorised("Your session has expired. Sign in again.")
    except jwt.PyJWTError:
        raise _unauthorised("Invalid session.")

    result = await db.execute(select(StaffUser).where(StaffUser.id == int(payload["sub"])))
    user = result.scalars().first()
    if user is None:
        raise _unauthorised("This account no longer exists.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

    return AdminPrincipal(user=user, granted=perms.expand(user.role.permissions or []))


def require(*required: str):
    """Dependency factory. All listed permissions must be held."""
    for permission in required:
        if not perms.is_valid(permission):
            # A typo here would produce an endpoint nobody can ever call.
            # Failing at import time makes that a five-second fix.
            raise ValueError(f"Unknown permission: {permission!r}")

    async def guard(principal: AdminPrincipal = Depends(get_current_staff)) -> AdminPrincipal:
        missing = [p for p in required if p not in principal.granted]
        if missing:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Your role does not include: {', '.join(missing)}.",
            )
        return principal

    return guard


def require_any(*options: str):
    """Holds if the caller has at least one of the listed permissions."""
    for permission in options:
        if not perms.is_valid(permission):
            raise ValueError(f"Unknown permission: {permission!r}")

    async def guard(principal: AdminPrincipal = Depends(get_current_staff)) -> AdminPrincipal:
        if not any(p in principal.granted for p in options):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Your role does not include any of: {', '.join(options)}.",
            )
        return principal

    return guard


# --- Storefront -------------------------------------------------------------


async def get_current_customer(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    if credentials is None:
        raise _unauthorised("Sign in to continue.")
    try:
        payload = decode_token(credentials.credentials, CUSTOMER_AUDIENCE)
    except jwt.ExpiredSignatureError:
        raise _unauthorised("Your session has expired. Sign in again.")
    except jwt.PyJWTError:
        raise _unauthorised("Invalid session.")

    result = await db.execute(select(Customer).where(Customer.id == int(payload["sub"])))
    customer = result.scalars().first()
    if customer is None or not customer.is_active:
        raise _unauthorised("This account is unavailable.")
    return customer


async def get_optional_customer(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    db: AsyncSession = Depends(get_db),
) -> Customer | None:
    """For endpoints that work signed out but personalise when signed in.
    A bad token is treated as signed out rather than as an error - the
    browsing path must never 401 a shopper out of the catalogue."""
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials, CUSTOMER_AUDIENCE)
    except jwt.PyJWTError:
        return None
    result = await db.execute(select(Customer).where(Customer.id == int(payload["sub"])))
    customer = result.scalars().first()
    return customer if customer and customer.is_active else None


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
