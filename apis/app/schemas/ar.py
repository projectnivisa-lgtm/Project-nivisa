from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ApiModel

ArStatus = Literal["unavailable", "processing", "ready", "failed", "deprecated"]


class ArAssetWrite(BaseModel):
    """The settings, and deliberately NOT the files.

    Models are uploaded through their own endpoint and removed through
    another. Carrying the URLs here as well would mean a settings save that
    omitted them silently deleted the uploads - which is precisely what a form
    that only edits dimensions would do.
    """

    # Millimetres, matching the product's own dimensions so the publish check
    # is a straight comparison rather than a unit conversion that can go wrong.
    real_width_mm: int | None = Field(None, ge=0, le=100_000)
    real_height_mm: int | None = Field(None, ge=0, le=100_000)
    real_depth_mm: int | None = Field(None, ge=0, le=100_000)

    scale_mode: Literal["fixed", "manual"] = "fixed"
    placement: Literal["floor", "wall"] = "floor"


class ArValidationOut(ApiModel):
    ok: bool
    """Blocking. Publishing is refused while any of these stand."""
    problems: list[str]
    """Worth knowing, but not blocking."""
    warnings: list[str]


class ArAssetOut(ApiModel):
    id: int
    product_id: int
    product_name: str
    status: ArStatus
    model_url: str | None
    ios_model_url: str | None
    poster_url: str | None
    real_width_mm: int | None
    real_height_mm: int | None
    real_depth_mm: int | None
    scale_mode: str
    placement: str
    version: int
    validation_note: str | None
    published_at: datetime | None
    updated_at: datetime

    # The dimensions the model is checked against, sent alongside so the
    # admin form can show both numbers side by side instead of making
    # somebody open the product in another tab to compare.
    product_width_mm: int | None = None
    product_height_mm: int | None = None
    product_depth_mm: int | None = None

    validation: ArValidationOut | None = None


class ArAssetRow(ApiModel):
    """The list view: one row per product, whether or not it has AR yet."""

    product_id: int
    product_name: str
    product_slug: str
    product_status: str
    has_asset: bool
    status: ArStatus
    version: int
    has_glb: bool
    has_usdz: bool
    updated_at: datetime | None


class ArEventIn(BaseModel):
    product_id: int
    kind: Literal["opened", "added_to_cart"]
    platform: Literal["ios", "android", "desktop"] | None = None


class ArReportRow(ApiModel):
    product_id: int
    product_name: str
    opened: int
    added_to_cart: int
    """Of the sessions that opened AR, the share that then added to cart."""
    conversion_pct: float | None
