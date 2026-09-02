"""Customer sign-in by phone OTP."""
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import get_current_customer
from app.core.security import (
    CUSTOMER_AUDIENCE, create_token, hash_password, verify_password,
)
from app.models.customer import Customer, OtpChallenge
from app.schemas.identity import (
    CustomerAuthResponse, CustomerOut, OtpRequest, OtpRequestResponse, OtpVerify,
)
from app.providers.notifications import get_sms
from app.services.cart import merge_guest_cart

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Shop · Auth"])

MAX_ATTEMPTS = 5
RESEND_WINDOW_SECONDS = 60
HOURLY_REQUEST_CAP = 5


def normalise_phone(raw: str) -> str:
    """Bare national digits.

    Without this, +919876543210, 919876543210 and 9876543210 are three
    accounts for one person, and the one holding their orders is whichever
    they typed first.
    """
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter a valid ten-digit Indian mobile number.")
    return digits


@router.post("/otp/request", response_model=OtpRequestResponse)
async def request_otp(payload: OtpRequest, db: AsyncSession = Depends(get_db)):
    phone = normalise_phone(payload.phone)
    now = datetime.now(timezone.utc)

    recent = (
        await db.execute(
            select(OtpChallenge)
            .where(OtpChallenge.phone == phone)
            .order_by(OtpChallenge.created_at.desc())
        )
    ).scalars().first()
    if recent and (now - recent.created_at).total_seconds() < RESEND_WINDOW_SECONDS:
        wait = RESEND_WINDOW_SECONDS - int((now - recent.created_at).total_seconds())
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Please wait {wait}s before asking again.")

    hourly = await db.scalar(
        select(func.count(OtpChallenge.id)).where(
            OtpChallenge.phone == phone, OtpChallenge.created_at >= now - timedelta(hours=1)
        )
    )
    if (hourly or 0) >= HOURLY_REQUEST_CAP:
        # Each SMS costs money and an uncapped endpoint is a way to spend
        # someone else's budget while spamming a stranger's phone.
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many codes requested for this number. Try again in an hour.",
        )

    # The fixed console code only exists when both the provider and the
    # environment say so. Either one alone is not enough - a staging box
    # with SMS_PROVIDER unset must not accept 123456.
    use_fixed = settings.SMS_PROVIDER == "console" and settings.APP_ENV == "local"
    code = settings.OTP_CONSOLE_CODE if use_fixed else f"{secrets.randbelow(1_000_000):06d}"

    db.add(
        OtpChallenge(
            phone=phone,
            # Hashed, not stored plain: this table is readable by anything
            # with database access, and a plaintext OTP there is a live
            # credential.
            code_hash=hash_password(code),
            expires_at=now + timedelta(seconds=settings.OTP_TTL_SECONDS),
        )
    )
    await db.commit()

    await get_sms().send_otp(phone=phone, code=code)

    return OtpRequestResponse(
        message=f"We have sent a code to the number ending {phone[-4:]}.",
        expires_in=settings.OTP_TTL_SECONDS,
        dev_code=code if use_fixed else None,
    )


@router.post("/otp/verify", response_model=CustomerAuthResponse)
async def verify_otp(
    payload: OtpVerify,
    db: AsyncSession = Depends(get_db),
    x_cart_token: str | None = Header(None, alias="X-Cart-Token"),
):
    phone = normalise_phone(payload.phone)
    now = datetime.now(timezone.utc)

    challenge = (
        await db.execute(
            select(OtpChallenge)
            .where(OtpChallenge.phone == phone, OtpChallenge.consumed_at.is_(None))
            .order_by(OtpChallenge.created_at.desc())
        )
    ).scalars().first()

    if challenge is None or challenge.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That code has expired. Ask for a new one.")
    if challenge.attempts >= MAX_ATTEMPTS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Ask for a new code."
        )

    if not verify_password(payload.code, challenge.code_hash):
        challenge.attempts += 1
        await db.commit()
        remaining = MAX_ATTEMPTS - challenge.attempts
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"That code is not right. {remaining} attempt(s) left." if remaining > 0
            else "That code is not right. Ask for a new one.",
        )

    # Consumed before the account work, so a replay of the same code cannot
    # be accepted even if what follows fails.
    challenge.consumed_at = now

    customer = (await db.execute(select(Customer).where(Customer.phone == phone))).scalars().first()
    if customer is None:
        customer = Customer(phone=phone, name=payload.name)
        db.add(customer)
        await db.flush()
    elif payload.name and not customer.name:
        customer.name = payload.name

    if not customer.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is suspended. Please contact us.")

    customer.last_login_at = now

    if x_cart_token:
        await merge_guest_cart(db, customer_id=customer.id, session_token=x_cart_token)

    token = create_token(
        subject=str(customer.id),
        audience=CUSTOMER_AUDIENCE,
        ttl_minutes=settings.CUSTOMER_TOKEN_TTL_MINUTES,
    )
    await db.commit()

    return CustomerAuthResponse(
        access_token=token,
        expires_in=settings.CUSTOMER_TOKEN_TTL_MINUTES * 60,
        customer=CustomerOut.model_validate(customer),
    )


@router.get("/me", response_model=CustomerOut)
async def me(customer: Customer = Depends(get_current_customer)):
    return CustomerOut.model_validate(customer)
