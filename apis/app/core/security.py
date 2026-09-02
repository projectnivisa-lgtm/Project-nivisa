"""Password hashing and JWT issuing/verification.

Admin and customer tokens are signed with the same key, so every token
carries an `aud` claim and every guard checks it. Without that check a
customer's token would authenticate against the admin API.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import settings

ADMIN_AUDIENCE = "admin"
CUSTOMER_AUDIENCE = "customer"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


def create_token(subject: str, audience: str, ttl_minutes: int, claims: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "aud": audience,
        "iat": now,
        "exp": now + timedelta(minutes=ttl_minutes),
        **(claims or {}),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, audience: str) -> dict[str, Any]:
    """Raises jwt.PyJWTError on anything wrong, including a wrong audience."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        audience=audience,
    )
