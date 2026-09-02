"""Cart arithmetic: discounts, shipping and tax.

One module owns every figure the customer is shown, because a cart total
computed in two places eventually disagrees with itself, and the version the
customer saw is the one they will hold you to.

Rounding rule, applied everywhere: quantise to two places with ROUND_HALF_UP
at each step, never at the end. Carrying full precision through and rounding
once produces a grand total that is a paisa off the sum of the lines shown
above it, which reads as a bug on the invoice.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import ProductVariant
from app.models.commerce import Coupon, CouponRedemption, ShippingRate

TWO_PLACES = Decimal("0.01")
ZERO = Decimal("0.00")


def money(value: Decimal | int | float) -> Decimal:
    return Decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


@dataclass
class LinePrice:
    variant_id: int
    unit_price: Decimal
    quantity: int
    discount_amount: Decimal = ZERO
    tax_rate: Decimal = ZERO
    tax_amount: Decimal = ZERO
    line_total: Decimal = ZERO


@dataclass
class Quote:
    lines: list[LinePrice] = field(default_factory=list)
    subtotal: Decimal = ZERO
    discount_total: Decimal = ZERO
    shipping_total: Decimal = ZERO
    tax_total: Decimal = ZERO
    grand_total: Decimal = ZERO
    item_count: int = 0
    coupon_code: str | None = None
    coupon_message: str | None = None


class CouponError(ValueError):
    """Rejected coupon. The message is written to be shown to a customer."""


async def resolve_coupon(
    db: AsyncSession, code: str, *, subtotal: Decimal, customer_id: int | None
) -> Coupon:
    now = datetime.now(timezone.utc)
    result = await db.execute(select(Coupon).where(func.lower(Coupon.code) == code.strip().lower()))
    coupon = result.scalars().first()

    # Every rejection says the same thing for a code that does not exist and
    # one that is inactive or expired: distinguishing them turns the endpoint
    # into an oracle for enumerating live promo codes.
    if coupon is None or not coupon.is_active:
        raise CouponError("That code is not valid.")
    if coupon.starts_at and coupon.starts_at > now:
        raise CouponError("That code is not valid.")
    if coupon.ends_at and coupon.ends_at < now:
        raise CouponError("That code has expired.")
    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        raise CouponError("That code has been fully redeemed.")
    if subtotal < coupon.min_order_value:
        raise CouponError(f"Spend {money(coupon.min_order_value)} or more to use this code.")

    if coupon.usage_limit_per_customer is not None and customer_id is not None:
        used = await db.scalar(
            select(func.count(CouponRedemption.id)).where(
                CouponRedemption.coupon_id == coupon.id,
                CouponRedemption.customer_id == customer_id,
            )
        )
        if (used or 0) >= coupon.usage_limit_per_customer:
            raise CouponError("You have already used this code.")

    return coupon


def coupon_discount(coupon: Coupon, subtotal: Decimal) -> Decimal:
    if coupon.discount_type == "percent":
        amount = subtotal * (coupon.discount_value / Decimal("100"))
        if coupon.max_discount is not None:
            amount = min(amount, coupon.max_discount)
    else:
        amount = coupon.discount_value
    # A discount larger than the cart would make the total negative and the
    # gateway would reject the charge; cap it at the cart.
    return money(min(amount, subtotal))


async def shipping_for(db: AsyncSession, *, subtotal: Decimal, postal_code: str | None) -> tuple[Decimal, ShippingRate | None]:
    """The most specific matching rate wins, then the fallback.

    "Most specific" is the longest matching prefix, so a rule for 5600
    (Bengaluru) beats one for 56 (Karnataka) without anyone having to order
    the rows correctly by hand.
    """
    result = await db.execute(
        select(ShippingRate).where(ShippingRate.is_active.is_(True)).order_by(ShippingRate.position)
    )
    rates = list(result.scalars().all())
    if not rates:
        return ZERO, None

    chosen: ShippingRate | None = None
    best_prefix = -1
    fallback: ShippingRate | None = None

    for rate in rates:
        prefixes = [p.strip() for p in (rate.postcode_prefixes or "").split(",") if p.strip()]
        if not prefixes:
            fallback = fallback or rate
            continue
        if not postal_code:
            continue
        for prefix in prefixes:
            if postal_code.startswith(prefix) and len(prefix) > best_prefix:
                chosen, best_prefix = rate, len(prefix)

    rate = chosen or fallback
    if rate is None:
        return ZERO, None
    if rate.free_above is not None and subtotal >= rate.free_above:
        return ZERO, rate
    return money(rate.rate), rate


async def quote(
    db: AsyncSession,
    *,
    items: list[tuple[ProductVariant, int]],
    coupon_code: str | None = None,
    customer_id: int | None = None,
    postal_code: str | None = None,
) -> Quote:
    """Price a basket. Pure arithmetic plus two lookups; writes nothing.

    Called from the cart view, from checkout, and from the admin order
    preview - the same numbers every time, by construction.
    """
    result = Quote()

    for variant, quantity in items:
        unit = money(variant.price)
        line = LinePrice(
            variant_id=variant.id,
            unit_price=unit,
            quantity=quantity,
            tax_rate=variant.tax_rate,
            line_total=money(unit * quantity),
        )
        result.lines.append(line)
        result.subtotal += line.line_total
        result.item_count += quantity

    result.subtotal = money(result.subtotal)

    if coupon_code and result.subtotal > 0:
        try:
            coupon = await resolve_coupon(
                db, coupon_code, subtotal=result.subtotal, customer_id=customer_id
            )
            result.discount_total = coupon_discount(coupon, result.subtotal)
            result.coupon_code = coupon.code
        except CouponError as exc:
            # A coupon that has stopped being valid must not block the cart
            # from loading. It is dropped, and the reason is returned so the
            # customer is told rather than left wondering where it went.
            result.coupon_message = str(exc)

    # Apportion the discount across lines so each line's tax is charged on
    # what was actually paid for it. Applying the discount only to the total
    # would over-collect tax on a discounted cart.
    discounted_subtotal = result.subtotal - result.discount_total
    if result.subtotal > 0 and result.discount_total > 0:
        allocated = ZERO
        for index, line in enumerate(result.lines):
            if index == len(result.lines) - 1:
                # The last line absorbs the rounding remainder, so the parts
                # always sum exactly to the whole.
                line.discount_amount = money(result.discount_total - allocated)
            else:
                share = result.discount_total * (line.line_total / result.subtotal)
                line.discount_amount = money(share)
                allocated += line.discount_amount

    shipping, _rate = await shipping_for(db, subtotal=discounted_subtotal, postal_code=postal_code)
    result.shipping_total = shipping

    # Prices are tax-inclusive (Indian retail convention: the shelf price is
    # what you pay). Tax is therefore extracted from the line, not added to
    # it - adding it would inflate every total by 18%.
    for line in result.lines:
        net = line.line_total - line.discount_amount
        rate = line.tax_rate or ZERO
        line.tax_amount = money(net - (net / (Decimal("1") + rate / Decimal("100")))) if rate else ZERO
        result.tax_total += line.tax_amount

    result.tax_total = money(result.tax_total)
    result.grand_total = money(discounted_subtotal + result.shipping_total)
    return result
