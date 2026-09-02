"""Staff sign-in and the session's own account."""
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit, permissions as perms
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, get_current_staff
from app.core.security import ADMIN_AUDIENCE, create_token, hash_password, verify_password
from app.models.rbac import StaffUser
from app.schemas.identity import (
    AdminLogin, AdminLoginResponse, AdminMe, PasswordChange, RoleSummary,
)
from app.schemas.common import Message

router = APIRouter(prefix="/auth", tags=["Admin · Auth"])


def _me(user: StaffUser) -> AdminMe:
    granted = perms.expand(user.role.permissions or [])
    return AdminMe(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=RoleSummary(id=user.role.id, slug=user.role.slug, name=user.role.name),
        # Sorted so the dashboard can compare two permission lists without
        # normalising them first.
        permissions=sorted(granted),
        is_super_admin=perms.WILDCARD in (user.role.permissions or []),
        must_change_password=user.must_change_password,
        last_login_at=user.last_login_at,
    )


@router.post("/login", response_model=AdminLoginResponse)
async def login(payload: AdminLogin, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StaffUser).where(StaffUser.email == payload.email.lower()))
    user = result.scalars().first()

    # The password is verified even when no such account exists, against a
    # throwaway hash, so a wrong email and a wrong password take the same
    # time. Without it, response timing enumerates valid staff addresses.
    valid = verify_password(payload.password, user.password_hash) if user else False
    if not user:
        await asyncio.to_thread(hash_password, payload.password)

    if not user or not valid:
        if user:
            await audit.record(
                db, action="login_failed", entity="staff_users", entity_id=user.id,
                summary=f"Failed sign-in for {user.email}", request=request,
                status="failure", response_status=401,
            )
            await db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

    user.last_login_at = datetime.now(timezone.utc)
    token = create_token(
        subject=str(user.id),
        audience=ADMIN_AUDIENCE,
        ttl_minutes=settings.ADMIN_TOKEN_TTL_MINUTES,
        claims={"email": user.email, "role": user.role.slug},
    )

    principal = AdminPrincipal(user=user, granted=perms.expand(user.role.permissions or []))
    await audit.record(
        db, action="login", entity="staff_users", entity_id=user.id,
        summary=f"{user.name} signed in", principal=principal, request=request,
    )
    await db.commit()

    return AdminLoginResponse(
        access_token=token,
        expires_in=settings.ADMIN_TOKEN_TTL_MINUTES * 60,
        user=_me(user),
    )


@router.get("/me", response_model=AdminMe)
async def me(principal: AdminPrincipal = Depends(get_current_staff)):
    return _me(principal.user)


@router.post("/change-password", response_model=Message)
async def change_password(
    payload: PasswordChange,
    request: Request,
    principal: AdminPrincipal = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, principal.user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect.")
    if verify_password(payload.new_password, principal.user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a password you have not used here before.")

    principal.user.password_hash = hash_password(payload.new_password)
    principal.user.must_change_password = False

    await audit.record(
        db, action="password_change", entity="staff_users", entity_id=principal.user.id,
        summary="Changed their own password", principal=principal, request=request,
    )
    await db.commit()
    return Message(message="Password updated.")


@router.get("/permissions", response_model=list[dict])
async def permission_catalogue(_: AdminPrincipal = Depends(get_current_staff)):
    """The registry, for rendering the role editor.

    Served rather than duplicated in the dashboard: a permission added to the
    backend appears in the role editor without a frontend release, and the
    two can never disagree about what is grantable.
    """
    return [
        {
            "key": group.key,
            "label": group.label,
            "permissions": [
                {"key": p.key, "label": p.label, "description": p.description}
                for p in group.permissions
            ],
        }
        for group in perms.PERMISSION_GROUPS
    ]
