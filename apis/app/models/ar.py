"""AR and 3D assets.

One asset per product, versioned. Furniture is the case AR is actually good
for — the question "will this fit, and will it look right here" is the one a
photograph cannot answer — so the rules below are stricter than a generic
3D-model feature would need:

- **Scale is not negotiable.** A model shown at the wrong size in someone's
  living room is worse than no model at all: it produces a confident wrong
  answer to the only question being asked. `scale_mode` defaults to fixed and
  the publish check refuses a model whose real-world size disagrees with the
  variant's own dimensions.
- **Only a validated model is ever advertised.** `status` has a single value
  that puts the AR button on the storefront. Everything else — uploaded but
  unchecked, failed, superseded — is invisible to customers.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

AR_STATUSES = ("unavailable", "processing", "ready", "failed", "deprecated")

# How far a model's stated real-world size may differ from the variant's
# recorded dimensions before publishing is refused. Five per cent covers
# honest modelling slack — a rounded cushion, a chamfered edge — without
# letting a model that is simply the wrong size through.
DIMENSION_TOLERANCE = 0.05


class ProductArAsset(Base, TimestampMixin):
    __tablename__ = "product_ar_assets"
    __table_args__ = (
        UniqueConstraint("product_id", name="uq_ar_asset_product"),
        CheckConstraint(
            "status IN ('unavailable','processing','ready','failed','deprecated')",
            name="ck_ar_status",
        ),
        CheckConstraint("scale_mode IN ('fixed','manual')", name="ck_ar_scale_mode"),
        CheckConstraint("placement IN ('floor','wall')", name="ck_ar_placement"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    product: Mapped["object"] = relationship("Product", lazy="joined")

    status: Mapped[str] = mapped_column(String(16), default="unavailable", nullable=False, index=True)

    # Two files, because the two platforms take different formats and neither
    # converts the other. Android's Scene Viewer and WebXR read glTF binary;
    # iOS AR Quick Look reads USDZ only. A product with one but not the other
    # is publishable — it simply has AR on one platform, which the storefront
    # reflects rather than hiding the feature from everyone.
    model_url: Mapped[str | None] = mapped_column(String(500))       # .glb / .gltf
    ios_model_url: Mapped[str | None] = mapped_column(String(500))   # .usdz
    poster_url: Mapped[str | None] = mapped_column(String(500))

    # Millimetres, matching every other dimension in this schema. The publish
    # check compares these against the variant's own width/depth/height.
    real_width_mm: Mapped[int | None] = mapped_column(Integer)
    real_height_mm: Mapped[int | None] = mapped_column(Integer)
    real_depth_mm: Mapped[int | None] = mapped_column(Integer)

    # Furniture is locked to actual size. "manual" exists because a decorative
    # object occasionally is not, but it is never the default and the UI warns.
    scale_mode: Mapped[str] = mapped_column(String(8), default="fixed", nullable=False)
    placement: Mapped[str] = mapped_column(String(8), default="floor", nullable=False)

    # Incremented on every new model upload, so a replacement can be rolled
    # back to and a cached viewer can be busted.
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Why validation refused it. Shown to whoever uploaded the model, because
    # "failed" with no reason is a support ticket.
    validation_note: Mapped[str | None] = mapped_column(Text())

    uploaded_by: Mapped[int | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def has_any_model(self) -> bool:
        return bool(self.model_url or self.ios_model_url)


class ArEvent(Base, TimestampMixin):
    """What actually happened, and nothing that did not.

    The storefront hands AR to the operating system — iOS Quick Look, Android
    Scene Viewer — and neither reports back. So this records what the page can
    genuinely observe: that the AR button was pressed, and that a cart add
    followed in the same session. It does NOT record whether the model was
    placed in a room, or how long it was looked at; those would be invented
    numbers, and a dashboard tile nobody can trace is worse than one fewer.
    """

    __tablename__ = "ar_events"
    __table_args__ = (
        CheckConstraint("kind IN ('opened','added_to_cart')", name="ck_ar_event_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16), index=True)
    # Anonymous, client-generated, per browser session. Not a customer id and
    # not joined to one: this measures whether AR helps, which needs no
    # identity attached to it.
    session_token: Mapped[str] = mapped_column(String(64), index=True)
    # ios | android | desktop — which path was offered, so a platform that
    # never converts can be told apart from one that has no model.
    platform: Mapped[str | None] = mapped_column(String(16))
