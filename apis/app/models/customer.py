"""Customers and their addresses."""
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Phone is the account identifier - OTP login, no password. Stored
    # normalised to bare national digits so "+91 98765 43210" and
    # "9876543210" cannot become two accounts.
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(160))
    email: Mapped[str | None] = mapped_column(String(190), index=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    addresses: Mapped[list["Address"]] = relationship(
        back_populates="customer", cascade="all, delete-orphan", lazy="selectin"
    )


class Address(Base, TimestampMixin):
    """One table for shipping and billing.

    The copied backend used three near-identical tables and a
    `default_address` pointer that only the server could resolve to the right
    one. `kind` plus `is_default` says the same thing and can be queried.
    """

    __tablename__ = "addresses"
    __table_args__ = (
        CheckConstraint("kind IN ('shipping', 'billing')", name="ck_address_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    customer: Mapped[Customer] = relationship(back_populates="addresses")

    kind: Mapped[str] = mapped_column(String(16), default="shipping", nullable=False)
    label: Mapped[str | None] = mapped_column(String(40))  # Home, Office

    full_name: Mapped[str] = mapped_column(String(160))
    phone: Mapped[str] = mapped_column(String(20))
    line1: Mapped[str] = mapped_column(String(240))
    line2: Mapped[str | None] = mapped_column(String(240))
    landmark: Mapped[str | None] = mapped_column(String(160))
    city: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(120))
    postal_code: Mapped[str] = mapped_column(String(12))
    country: Mapped[str] = mapped_column(String(2), default="IN", nullable=False)

    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Soft delete. An order references an address by id, so a hard delete
    # would blank the shipping address on a past order.
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class OtpChallenge(Base, TimestampMixin):
    """A pending phone verification.

    Rows are kept after use so a replayed code can be rejected explicitly
    rather than by absence, and so repeated requests from one number are
    countable.
    """

    __tablename__ = "otp_challenges"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0, nullable=False)
