"""Writing the audit trail."""
import logging
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import AdminPrincipal, client_ip
from app.models.system import AuditLog

logger = logging.getLogger(__name__)

# Never recorded in `changes`, whatever the caller passes. A password hash in
# an audit row is a credential in a table half the staff can read.
REDACTED_FIELDS = {"password", "password_hash", "token", "secret", "otp", "code_hash"}


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, list[Any]]:
    """{field: [old, new]} for changed fields only."""
    changed: dict[str, list[Any]] = {}
    for key, new_value in after.items():
        if key in REDACTED_FIELDS:
            continue
        old_value = before.get(key)
        if old_value != new_value:
            changed[key] = [_safe(old_value), _safe(new_value)]
    return changed


def _safe(value: Any) -> Any:
    """JSONB accepts a limited set of types; anything else is stringified
    rather than raising at commit time and losing the audit row entirely."""
    if value is None or isinstance(value, (str, int, float, bool, list, dict)):
        return value
    return str(value)


async def record(
    db: AsyncSession,
    *,
    action: str,
    entity: str,
    entity_id: str | int | None = None,
    summary: str | None = None,
    changes: dict[str, Any] | None = None,
    principal: AdminPrincipal | None = None,
    request: Request | None = None,
    status: str = "success",
    response_status: int | None = None,
) -> None:
    """Add an audit row to the caller's session.

    Deliberately does not commit: the audit entry and the change it describes
    belong to one transaction. A trail that survives a rolled-back write is
    worse than no trail, because it says something happened that did not.

    A failure to write the audit row must not fail the request that succeeded,
    so anything unexpected is logged and swallowed.
    """
    try:
        entry = AuditLog(
            actor_id=principal.user.id if principal else None,
            actor_name=principal.user.name if principal else None,
            actor_email=principal.user.email if principal else None,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            summary=summary,
            changes={k: v for k, v in (changes or {}).items() if k not in REDACTED_FIELDS} or None,
            ip_address=client_ip(request) if request else None,
            user_agent=(request.headers.get("user-agent") or "")[:300] if request else None,
            status=status,
            response_status=response_status,
        )
        db.add(entry)
    except Exception:
        logger.exception("Failed to record audit entry for %s %s", action, entity)
