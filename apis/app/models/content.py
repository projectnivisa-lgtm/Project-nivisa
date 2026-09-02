"""Editable storefront content: pages, banners, homepage rails, settings."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Page(Base, TimestampMixin):
    """Legal and informational pages, addressed by slug.

    `body` is HTML from the dashboard's rich-text editor and is sanitised on
    write, not on read - a page rendered by the storefront, an email or a PDF
    must not each have to remember to sanitise.
    """

    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text(), default="")
    meta_title: Mapped[str | None] = mapped_column(String(200))
    meta_description: Mapped[str | None] = mapped_column(String(400))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # System pages are linked from the footer and checkout; the dashboard
    # lets staff edit them but not delete them out from under those links.
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Banner(Base, TimestampMixin):
    __tablename__ = "banners"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    subtitle: Mapped[str | None] = mapped_column(String(300))
    image_url: Mapped[str] = mapped_column(String(500))
    # Phones crop a 21:9 hero into nonsense; a separate asset is the only
    # honest fix. Null falls back to image_url.
    mobile_image_url: Mapped[str | None] = mapped_column(String(500))
    alt_text: Mapped[str] = mapped_column(String(300), default="")
    link_url: Mapped[str | None] = mapped_column(String(500))
    cta_label: Mapped[str | None] = mapped_column(String(60))
    placement: Mapped[str] = mapped_column(String(32), default="home_hero", nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class HomepageSection(Base, TimestampMixin):
    """One row per band on the front page, ordered and switchable.

    `config` holds the band's own arguments - which collection a rail shows,
    how many tiles a category grid renders - because those differ per `kind`
    and a column per kind would be mostly nulls.
    """

    __tablename__ = "homepage_sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    # hero | collection_rail | category_grid | room_grid | banner | editorial | reviews
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    subtitle: Mapped[str | None] = mapped_column(String(300))
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Setting(Base, TimestampMixin):
    """Key/value store settings, edited in the dashboard.

    Anything a non-developer should be able to change at 9pm lives here
    rather than in the environment, where changing it means a redeploy.
    Secrets stay in the environment.
    """

    __tablename__ = "settings"
    __table_args__ = (UniqueConstraint("key", name="uq_setting_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), index=True)
    value: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    label: Mapped[str] = mapped_column(String(160), default="")
    group: Mapped[str] = mapped_column(String(40), default="general", nullable=False)
