"""Audit trail."""
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    """Who did what, to which row, from where.

    `actor_name` and `actor_email` are copied rather than joined: a staff
    account deleted next year must not erase the record of what it did.
    """

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)

    actor_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"), index=True)
    actor_name: Mapped[str | None] = mapped_column(String(160))
    actor_email: Mapped[str | None] = mapped_column(String(190))

    action: Mapped[str] = mapped_column(String(60), index=True)  # create | update | delete | login | ...
    entity: Mapped[str] = mapped_column(String(60), index=True)  # products, orders, staff_users
    entity_id: Mapped[str | None] = mapped_column(String(60), index=True)
    summary: Mapped[str | None] = mapped_column(String(400))

    # Only the fields that actually changed, as {field: [before, after]}.
    # A full before/after row would put customer phone numbers and addresses
    # into a table with a much broader read permission than they deserve.
    changes: Mapped[dict | None] = mapped_column(JSONB)

    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(16), default="success", nullable=False)
    response_status: Mapped[int | None] = mapped_column(Integer)
