"""Roles: what a set of staff are allowed to do."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core import permissions as perms
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import AdminPrincipal, require
from app.core.slug import slugify
from app.models.rbac import Role, StaffUser
from app.schemas.common import Message
from app.schemas.identity import RoleOut, RoleWrite
from app.services import admin_supabase

router = APIRouter(prefix="/roles", tags=["Admin · Roles"])


async def _staff_counts(db: AsyncSession) -> dict[int, int]:
    result = await db.execute(
        select(StaffUser.role_id, func.count(StaffUser.id)).group_by(StaffUser.role_id)
    )
    return {row[0]: row[1] for row in result.all()}


@router.get("", response_model=list[RoleOut])
async def list_roles(
    _: AdminPrincipal = Depends(require("roles.read")),
    db: AsyncSession = Depends(get_db),
):
    if settings.DATA_BACKEND == "supabase":
        return await admin_supabase.roles()

    counts = await _staff_counts(db)
    roles = (await db.execute(select(Role).order_by(Role.is_system.desc(), Role.name))).scalars().all()
    return [
        RoleOut.model_validate({**role.__dict__, "staff_count": counts.get(role.id, 0)})
        for role in roles
    ]


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("roles.write")),
    db: AsyncSession = Depends(get_db),
):
    slug = slugify(payload.name)
    if (await db.execute(select(Role.id).where(Role.slug == slug))).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"A role called {payload.name} already exists.")

    role = Role(
        slug=slug,
        name=payload.name,
        description=payload.description,
        permissions=payload.permissions,
        is_system=False,
    )
    db.add(role)
    await db.flush()

    await audit.record(
        db, action="create", entity="roles", entity_id=role.id,
        summary=f"Created role {role.name}", changes={"permissions": [[], payload.permissions]},
        principal=principal, request=request,
    )
    await db.commit()
    return RoleOut.model_validate({**role.__dict__, "staff_count": 0})


@router.put("/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: int,
    payload: RoleWrite,
    request: Request,
    principal: AdminPrincipal = Depends(require("roles.write")),
    db: AsyncSession = Depends(get_db),
):
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalars().first()
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That role no longer exists.")

    # The super admin's permission list is the recovery path for every other
    # mistake in this screen. Editing it away is how a shop locks itself out
    # of its own dashboard with no route back except a database console.
    if perms.WILDCARD in (role.permissions or []):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The Super Admin role always has full access and cannot be edited.",
        )

    before = {"name": role.name, "permissions": list(role.permissions or [])}
    role.name = payload.name
    role.description = payload.description
    role.permissions = payload.permissions
    if not role.is_system:
        role.slug = slugify(payload.name)

    await audit.record(
        db, action="update", entity="roles", entity_id=role.id,
        summary=f"Updated role {role.name}",
        changes=audit.diff(before, {"name": role.name, "permissions": role.permissions}),
        principal=principal, request=request,
    )
    await db.commit()

    counts = await _staff_counts(db)
    return RoleOut.model_validate({**role.__dict__, "staff_count": counts.get(role.id, 0)})


@router.delete("/{role_id}", response_model=Message)
async def delete_role(
    role_id: int,
    request: Request,
    principal: AdminPrincipal = Depends(require("roles.write")),
    db: AsyncSession = Depends(get_db),
):
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalars().first()
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That role no longer exists.")
    if role.is_system:
        raise HTTPException(status.HTTP_409_CONFLICT, "Built-in roles cannot be deleted.")

    in_use = await db.scalar(select(func.count(StaffUser.id)).where(StaffUser.role_id == role.id))
    if in_use:
        # Deleting would either orphan those accounts or silently promote
        # them; reassigning is a decision only a person can make.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{in_use} staff member(s) still have this role. Move them to another role first.",
        )

    await audit.record(
        db, action="delete", entity="roles", entity_id=role.id,
        summary=f"Deleted role {role.name}", principal=principal, request=request,
    )
    await db.delete(role)
    await db.commit()
    return Message(message=f"Role {role.name} deleted.")
