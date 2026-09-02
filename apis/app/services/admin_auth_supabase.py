"""Staff sign-in and session resolution, over PostgREST.

The gateway to the whole admin API: `login` mints the token and
`staff_principal` turns that token back into a StaffUser on every subsequent
request. Nothing else in the dashboard can be reached until both work, which
is why they are ported before the screens they guard.

WHAT IS DELIBERATELY NOT DIFFERENT
    The password check, the token, the permission expansion and the failure
    messages are the SAME code as the Postgres path. Only the two lookups
    change. Authentication is the last place to keep a second implementation:
    a difference here is not a wrong total, it is the wrong person signed in.

    In particular the constant-time behaviour is preserved - a wrong email
    still costs a password hash - because timing that varies by whether an
    address exists enumerates the staff list.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

from app.core import permissions as perms
from app.core import supabase
from app.core.security import hash_password, verify_password

# The role comes back embedded, because every request needs it: the permission
# set is on the role, and a principal without it can do nothing. One request
# rather than two, on the hot path of every admin call.
_STAFF_SELECT = (
    "id,name,email,phone,password_hash,role_id,is_active,last_login_at,"
    "must_change_password,roles(id,slug,name,permissions)"
)


def _as_user(row: dict[str, Any]) -> SimpleNamespace:
    """A PostgREST row shaped like the StaffUser the rest of the code expects.

    `_me()` and `AdminPrincipal` reach for `.role.permissions`, `.role.slug`
    and so on. PostgREST names the embed after the table - `roles` - so it is
    renamed here rather than teaching every reader of a principal that the
    attribute is called something else on one deployment.
    """
    role = row.get("roles") or {}
    user = SimpleNamespace(**{k: v for k, v in row.items() if k != "roles"})
    user.role = SimpleNamespace(**role)
    # Timestamps arrive as strings. AdminMe declares a datetime, so an
    # unparsed string is a validation error on the response, not on the way in
    # - which is a 500 on a successful login and reads like a password
    # problem to whoever is trying to sign in.
    if isinstance(user.last_login_at, str):
        user.last_login_at = datetime.fromisoformat(user.last_login_at)
    return user


async def find_by_email(email: str) -> SimpleNamespace | None:
    row = await supabase.select_one(
        "staff_users", columns=_STAFF_SELECT, email=f"eq.{email.lower()}"
    )
    return _as_user(row) if row else None


async def find_by_id(staff_id: int) -> SimpleNamespace | None:
    row = await supabase.select_one(
        "staff_users", columns=_STAFF_SELECT, id=f"eq.{staff_id}"
    )
    return _as_user(row) if row else None


async def authenticate(email: str, password: str) -> SimpleNamespace | None:
    """The user if the credentials are right, otherwise None.

    Mirrors the Postgres path exactly, including hashing a throwaway password
    when the account does not exist so that a wrong email and a wrong password
    take the same time.
    """
    user = await find_by_email(email)
    valid = verify_password(password, user.password_hash) if user else False
    if not user:
        await asyncio.to_thread(hash_password, password)
        return None
    return user if valid else None


async def record_login(staff_id: int) -> datetime:
    """Stamp last_login_at, and return what was written.

    Returned rather than re-read: the response carries this value, and asking
    PostgREST for it again would be a second round trip to learn something
    this process already knows.
    """
    now = datetime.now(timezone.utc)
    await supabase.patch(
        "staff_users", {"last_login_at": now.isoformat()}, id=f"eq.{staff_id}"
    )
    return now


def granted_for(user: SimpleNamespace) -> frozenset[str]:
    return perms.expand(getattr(user.role, "permissions", None) or [])
