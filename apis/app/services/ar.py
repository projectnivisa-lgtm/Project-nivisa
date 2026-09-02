"""Deciding whether an AR model may be shown to a customer.

The whole value of AR for furniture is that it answers "will this fit, and
will it look right in my room". A model at the wrong scale answers that
question confidently and wrongly, which is worse than not answering it — the
customer measures nothing, trusts the overlay, and finds out on delivery day.

So publishing is gated, and the gate is arithmetic rather than judgement:
a model's stated real-world size must agree with the dimensions the product
already carries.
"""
from dataclasses import dataclass, field

from app.models.ar import DIMENSION_TOLERANCE, ProductArAsset
from app.models.catalog import Product, ProductVariant


@dataclass
class Validation:
    ok: bool
    problems: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def note(self) -> str | None:
        lines = self.problems + [f"Note: {w}" for w in self.warnings]
        return "\n".join(lines) or None


def reference_variant(product: Product) -> ProductVariant | None:
    """The variant an AR model is measured against.

    The cheapest active one — the same variant whose price and dimensions the
    product card and page already show, so the model matches the thing the
    customer is looking at rather than a different size of it.
    """
    variants = [v for v in product.variants if v.is_active] or list(product.variants)
    return min(variants, key=lambda v: v.price) if variants else None


def _compare(label: str, model_mm: int | None, product_mm: int | None) -> str | None:
    if model_mm is None or product_mm is None or product_mm == 0:
        return None
    drift = abs(model_mm - product_mm) / product_mm
    if drift <= DIMENSION_TOLERANCE:
        return None
    return (
        f"{label}: the model is {model_mm}mm but the product is {product_mm}mm "
        f"({drift * 100:.0f}% out, limit {DIMENSION_TOLERANCE * 100:.0f}%)."
    )


def validate(asset: ProductArAsset, product: Product) -> Validation:
    """Everything that must be true before AR is offered on the storefront."""
    problems: list[str] = []
    warnings: list[str] = []

    if not asset.has_any_model:
        problems.append("No model has been uploaded.")

    if asset.poster_url is None:
        # Not fatal. The poster is the still frame shown before AR launches;
        # without it the button still works, it just looks unfinished.
        warnings.append("No poster image. The AR button will have no preview.")

    if asset.model_url is None:
        warnings.append("No .glb model — Android and WebXR cannot show this piece.")
    if asset.ios_model_url is None:
        warnings.append("No .usdz model — iPhones and iPads cannot show this piece.")

    stated = (asset.real_width_mm, asset.real_height_mm, asset.real_depth_mm)
    if asset.scale_mode == "fixed" and not any(stated):
        problems.append(
            "Fixed scale needs the model's real-world size, so it can be checked "
            "against the product's dimensions."
        )

    variant = reference_variant(product)
    if variant is None:
        problems.append("The product has no variant to measure the model against.")
    elif asset.scale_mode == "fixed":
        for problem in (
            _compare("Width", asset.real_width_mm, variant.width_mm),
            _compare("Height", asset.real_height_mm, variant.height_mm),
            _compare("Depth", asset.real_depth_mm, variant.depth_mm),
        ):
            if problem:
                problems.append(problem)

        if not any((variant.width_mm, variant.height_mm, variant.depth_mm)):
            problems.append(
                "The product has no dimensions recorded, so the model's scale "
                "cannot be checked. Add them on the product first."
            )

    if asset.scale_mode == "manual":
        # Allowed, but it is the setting that lets a customer resize a sofa
        # until it fits, which is precisely the wrong answer.
        warnings.append(
            "Manual scale lets the customer resize the piece. Use it only for "
            "decorative objects, never for anything measured."
        )

    return Validation(ok=not problems, problems=problems, warnings=warnings)


def to_public(asset: ProductArAsset | None) -> dict | None:
    """What the storefront is told.

    Only a `ready` asset is described at all. Everything else — uploaded but
    unchecked, failed validation, superseded by a newer version — is a staff
    concern, and a storefront that could see it would eventually advertise it.
    """
    if asset is None or asset.status != "ready":
        return None

    return {
        "enabled": True,
        "status": "ready",
        "model_url": asset.model_url,
        "ios_model_url": asset.ios_model_url,
        "poster_url": asset.poster_url,
        "real_world_width_cm": asset.real_width_mm / 10 if asset.real_width_mm else None,
        "real_world_height_cm": asset.real_height_mm / 10 if asset.real_height_mm else None,
        "real_world_depth_cm": asset.real_depth_mm / 10 if asset.real_depth_mm else None,
        "scale_mode": asset.scale_mode,
        "placement": asset.placement,
        "version": asset.version,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None,
    }
