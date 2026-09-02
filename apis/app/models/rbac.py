"""Staff accounts and the roles that gate what they can do."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text())

    # A flat list of permission keys from app.core.permissions, or ["*"].
    # A join table would buy referential integrity against a permissions
    # table, but permissions are code constants rather than data - a row for
    # each would go stale the moment a capability is renamed in the registry.
    permissions: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    # System roles ship with the product: they cannot be deleted, and the
    # super admin's permission list cannot be edited. Everything else is
    # tenant-defined and fully editable.
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    staff: Mapped[list["StaffUser"]] = relationship(back_populates="role")


class StaffUser(Base, TimestampMixin):
    __tablename__ = "staff_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(190), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255))

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"), index=True)
    role: Mapped[Role] = relationship(back_populates="staff", lazy="joined")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Set when an admin resets someone's password. The dashboard forces a
    # change on next login rather than leaving a known password in place.
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
