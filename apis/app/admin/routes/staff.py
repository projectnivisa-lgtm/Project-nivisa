"""Staff accounts."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core import permissions as perms
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require
from app.core.security import hash_password
from app.models.rbac import Role, StaffUser
from app.schemas.common import Message, Page
from app.schemas.identity import (
    RoleSummary,
    StaffCreate,
    StaffOut,
    StaffPasswordReset,
    StaffUpdate,
)
from app.services import admin_supabase

router = APIRouter(prefix="/staff", tags=["Admin · Staff"])


def _out(user: StaffUser) -> StaffOut:
    return StaffOut(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=RoleSummary(id=user.role.id, slug=user.role.slug, name=user.role.name),
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


async def _get_role(db: AsyncSession, role_id: int) -> Role:
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalars().first()
    if role is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That role does not exist.")
    return role


def _guard_super_admin_target(principal: AdminPrincipal, target: StaffUser) -> None:
    """Only a super admin may touch another super admin.

    Without this, a Store Manager granted `staff.write` could reset the super
    admin's password and take over the shop - a privilege escalation through
    a permission that reads as merely administrative.
    """
    if perms.WILDCARD in (target.role.permissions or []) and not principal.is_super_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only a Super Admin can manage another Super Admin account.",
        )


@router.get("", response_model=Page[StaffOut])
async def list_staff(
    q: str | None = Query(None, description="Match on name or email"),
    role_id: int | None = None,
    is_active: bool | None = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: AdminPrincipal = Depends(require("staff.read")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        rows, total = await admin_supabase.staff(
            q=q, role_id=role_id, is_active=is_active, limit=limit, offset=offset
        )
        return Page[StaffOut](
            items=[
                StaffOut.model_validate({**row, "role": row.get("roles")})
                for row in rows
            ],
            total=total, limit=limit, offset=offset,
        )

    query = select(StaffUser)
    count_query = select(func.count(StaffUser.id))

    filters = []
    if q:
        term = f"%{q.strip()}%"
        filters.append(or_(StaffUser.name.ilike(term), StaffUser.email.ilike(term)))
    if role_id is not None:
        filters.append(StaffUser.role_id == role_id)
    if is_active is not None:
        filters.append(StaffUser.is_active.is_(is_active))
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total = await db.scalar(count_query) or 0
    rows = (
        await db.execute(query.order_by(StaffUser.name).limit(limit).offset(offset))
    ).scalars().all()

    return Page[StaffOut](items=[_out(u) for u in rows], total=total, limit=limit, offset=offset)


@router.post("", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
async def create_staff(
    payload: StaffCreate,
    request: Request,
    principal: AdminPrincipal = Depends(require("staff.write")),
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.lower()
    if (await db.execute(select(StaffUser.id).where(StaffUser.email == email))).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A staff account with that email already exists.")

    role = await _get_role(db, payload.role_id)
    if perms.WILDCARD in (role.permissions or []) and not principal.is_super_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only a Super Admin can create another Super Admin."
        )

    user = StaffUser(
        name=payload.name,
        email=email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role_id=role.id,
        is_active=payload.is_active,
        # The creator knows this password. Forcing a change on first sign-in
        # means the account ends up with a credential only its owner holds.
        must_change_password=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user, ["role"])

    await audit.record(
        db, action="create", entity="staff_users", entity_id=user.id,
        summary=f"Created staff account {user.email} as {role.name}",
        principal=principal, request=request,
    )
    await db.commit()
    return _out(user)


@router.put("/{staff_id}", response_model=StaffOut)
async def update_staff(
    staff_id: int,
    payload: StaffUpdate,
    request: Request,
    principal: AdminPrincipal = Depends(require("staff.write")),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(StaffUser).where(StaffUser.id == staff_id))).scalars().first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That account no longer exists.")
    _guard_super_admin_target(principal, user)

    before = {
        "name": user.name, "email": user.email, "phone": user.phone,
        "role_id": user.role_id, "is_active": user.is_active,
    }

    if payload.role_id is not None and payload.role_id != user.role_id:
        role = await _get_role(db, payload.role_id)
        if perms.WILDCARD in (role.permissions or []) and not principal.is_super_admin:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Only a Super Admin can grant Super Admin."
            )
        # Changing your own role is how an admin accidentally removes their
        # own ability to change it back.
        if user.id == principal.user.id:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "You cannot change your own role. Ask another Super Admin."
            )
        user.role_id = role.id

    if payload.is_active is False and user.id == principal.user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You cannot deactivate your own account.")

    if payload.name is not None:
        user.name = payload.name
    if payload.email is not None:
        email = payload.email.lower()
        clash = (
            await db.execute(select(StaffUser.id).where(StaffUser.email == email, StaffUser.id != user.id))
        ).first()
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "Another account already uses that email.")
        user.email = email
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.flush()
    await db.refresh(user, ["role"])
    after = {
        "name": user.name, "email": user.email, "phone": user.phone,
        "role_id": user.role_id, "is_active": user.is_active,
    }
    await audit.record(
        db, action="update", entity="staff_users", entity_id=user.id,
        summary=f"Updated staff account {user.email}",
        changes=audit.diff(before, after), principal=principal, request=request,
    )
    await db.commit()
    return _out(user)


@router.post("/{staff_id}/reset-password", response_model=Message)
async def reset_password(
    staff_id: int,
    payload: StaffPasswordReset,
    request: Request,
    principal: AdminPrincipal = Depends(require("staff.write")),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(StaffUser).where(StaffUser.id == staff_id))).scalars().first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That account no longer exists.")
    _guard_super_admin_target(principal, user)

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = True

    await audit.record(
        db, action="password_reset", entity="staff_users", entity_id=user.id,
        summary=f"Reset the password for {user.email}", principal=principal, request=request,
    )
    await db.commit()
    return Message(message=f"Password reset. {user.name} must choose a new one at next sign-in.")


@router.delete("/{staff_id}", response_model=Message)
async def deactivate_staff(
    staff_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("staff.write")),
    db: AsyncSession = Depends(get_db),
):
    """Deactivates rather than deletes.

    Audit rows, order events and inventory movements all point at this row.
    Deleting it would blank the name against every action the person ever
    took, which is the opposite of what an audit trail is for.
    """
    user = (await db.execute(select(StaffUser).where(StaffUser.id == staff_id))).scalars().first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That account no longer exists.")
    if user.id == principal.user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You cannot deactivate your own account.")
    _guard_super_admin_target(principal, user)

    user.is_active = False
    await audit.record(
        db, action="deactivate", entity="staff_users", entity_id=user.id,
        summary=f"Deactivated {user.email}", principal=principal, request=request,
    )
    await db.commit()
    return Message(message=f"{user.name} can no longer sign in.")
