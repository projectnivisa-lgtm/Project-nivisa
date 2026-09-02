"""Check a deployment box before Passenger touches it.

Run this from the cPanel terminal, in the application root, with the app's
virtualenv active:

    python preflight.py

WHY IT EXISTS
    Passenger reports a failed import as a bare 500 in the browser and buries
    the real cause in a log you have to go looking for. Every check below is
    something that has actually gone wrong on a shared host, phrased so the
    output tells you what to change rather than what threw.

It reads the same settings the application reads, so it fails for the same
reasons - and it never writes anything anywhere.
"""
from __future__ import annotations

import os
import socket
import sys
from pathlib import Path

PASS, FAIL, WARN = "  ok  ", " FAIL ", " warn "
problems: list[str] = []


def report(status: str, label: str, detail: str = "") -> None:
    print(f"[{status}] {label}" + (f" — {detail}" if detail else ""))
    if status is FAIL:
        problems.append(label)


def check_python() -> None:
    v = sys.version_info
    if v < (3, 10):
        report(FAIL, f"Python {v.major}.{v.minor}",
               "3.10 is the floor - the code uses `str | None` annotations, "
               "which are a SyntaxError before it. Pick a newer interpreter "
               "in Setup Python App.")
    else:
        report(PASS, f"Python {v.major}.{v.minor}.{v.micro}")


def check_layout() -> None:
    here = Path(__file__).resolve().parent
    for name in ("main.py", "app", "requirements.txt", "passenger_wsgi.py"):
        if not (here / name).exists():
            report(FAIL, f"{name} missing",
                   "the application root is not the folder holding the API")
            return
    report(PASS, "project layout", str(here))

    if not (here / ".env").exists():
        report(WARN, ".env not found",
               "fine if you set the variables in the cPanel UI instead; "
               "otherwise every setting falls back to its Docker default")


def check_imports() -> None:
    try:
        import a2wsgi  # noqa: F401
    except ImportError:
        report(FAIL, "a2wsgi not installed",
               "pip install -r requirements.txt, with THIS virtualenv active")
        return
    try:
        import fastapi, sqlalchemy, asyncpg, httpx  # noqa: F401
    except ImportError as exc:
        report(FAIL, f"dependency missing: {exc.name}",
               "pip install -r requirements.txt")
        return
    report(PASS, "dependencies importable")


def check_app() -> None:
    try:
        from main import app  # noqa: F401
    except Exception as exc:  # noqa: BLE001 - the whole point is to show it
        report(FAIL, f"the app does not import: {type(exc).__name__}", str(exc)[:180])
        return
    report(PASS, "main:app imports")

    try:
        from passenger_wsgi import application  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        report(FAIL, f"passenger_wsgi does not import: {type(exc).__name__}", str(exc)[:180])
        return
    report(PASS, "passenger_wsgi:application ready")


def check_settings() -> None:
    try:
        from app.core.config import settings
    except Exception as exc:  # noqa: BLE001
        report(FAIL, "settings failed to load", str(exc)[:180])
        return

    report(PASS, f"APP_ENV={settings.APP_ENV}",
           f"payments={settings.PAYMENT_PROVIDER} storage={settings.STORAGE_PROVIDER} "
           f"sms={settings.SMS_PROVIDER}")

    if settings.SECRET_KEY == "change-me-in-production":
        report(FAIL, "SECRET_KEY is the shipped default",
               'python -c "import secrets; print(secrets.token_urlsafe(48))"')
    else:
        report(PASS, "SECRET_KEY is set")

    if settings.is_production:
        stand_ins = [
            n for n, v in (("PAYMENT_PROVIDER", settings.PAYMENT_PROVIDER),
                           ("SMS_PROVIDER", settings.SMS_PROVIDER))
            if v in ("mock", "console")
        ]
        if stand_ins:
            report(FAIL, "APP_ENV=production with stand-in providers: " + ", ".join(stand_ins),
                   "the API will refuse to start. Use APP_ENV=staging until the "
                   "client supplies real accounts.")

    if "localhost" in settings.PUBLIC_API_URL:
        report(WARN, "PUBLIC_API_URL still points at localhost",
               "payment redirects and emailed links will be unreachable")
    if "localhost" in settings.CORS_ORIGINS:
        report(WARN, "CORS_ORIGINS still contains localhost",
               "the deployed storefront and dashboard will be blocked")


def check_database() -> None:
    try:
        from app.core.config import settings
        import asyncio
        import asyncpg
    except Exception:  # noqa: BLE001
        return

    url = settings.DATABASE_URL

    # The driver is chosen by the scheme, and getting it wrong fails a long
    # way from the cause: `postgresql://` selects SQLAlchemy's sync dialect,
    # which imports psycopg2 and reports a missing module rather than a wrong
    # URL. The dashboard hands you exactly that scheme, so this is the single
    # most likely thing to be wrong on a first deploy.
    if url.startswith("postgresql://") or url.startswith("postgres://"):
        report(FAIL, "DATABASE_URL uses the sync driver",
               "change the scheme to postgresql+asyncpg:// - `postgresql://` makes "
               "SQLAlchemy import psycopg2, which this app does not use")
    elif not url.startswith("postgresql+asyncpg://"):
        report(WARN, "DATABASE_URL has an unexpected scheme", url.split("://")[0] + "://")

    # Show how the URL actually parses, password masked. A DSN that looks
    # right and resolves to the wrong host is otherwise invisible - most often
    # because a password contains a character that has meaning in a URL and
    # was not percent-encoded, so the host is read from the wrong side of it.
    from urllib.parse import urlsplit, unquote
    try:
        parts = urlsplit(url.replace("postgresql+asyncpg://", "postgresql://"))
        shown = parts.password or ""
        report(PASS, "connection string parses",
               f"user={parts.username} host={parts.hostname} port={parts.port or 5432} "
               f"db={parts.path.lstrip('/').split('?')[0]} password={'*' * len(shown)}")
        risky = set(shown) & set("@:/?#[]%& ")
        if risky:
            report(FAIL, "the password contains characters that need URL-encoding",
                   "".join(sorted(risky)) + " — percent-encode them, or the host is "
                   "parsed from the wrong part of the string")
        if parts.username and "." not in parts.username and "pooler.supabase.com" in (parts.hostname or ""):
            report(FAIL, "pooler user must include the project ref",
                   f"expected postgres.<project-ref>, got {parts.username}")
    except Exception as exc:  # noqa: BLE001
        report(FAIL, "connection string could not be parsed", str(exc)[:120])
        return

    host = parts.hostname or ""
    if not host:
        report(FAIL, "no host in DATABASE_URL")
        return

    # The failure this catches: Supabase's direct host is IPv6-only and most
    # shared hosts have no IPv6 route, so the connection dies at the socket
    # with a message that says nothing about either fact.
    try:
        families = {i[0] for i in socket.getaddrinfo(host, None)}
    except socket.gaierror as exc:
        report(FAIL, f"cannot resolve {host}", str(exc))
        return

    has_v4 = socket.AF_INET in families
    has_v6 = socket.AF_INET6 in families
    if not has_v4 and has_v6:
        report(WARN, f"{host} is IPv6-only",
               "if the connection below fails, this box has no IPv6 route and "
               "you need the Supabase POOLER host instead (Connect → Session pooler)")
    else:
        report(PASS, f"{host} resolves", "IPv4" if has_v4 else "IPv6")

    plain = url.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]

    async def probe() -> str:
        conn = await asyncpg.connect(plain, ssl="require", statement_cache_size=0, timeout=20)
        try:
            version = await conn.fetchval("select version()")
            tables = await conn.fetchval(
                "select count(*) from information_schema.tables where table_schema='public'")
            return f"{version.split(',')[0]}, {tables} tables"
        finally:
            await conn.close()

    try:
        report(PASS, "database reachable", asyncio.run(probe()))
    except Exception as exc:  # noqa: BLE001
        text = str(exc)
        # Three distinct failures that look alike in a traceback and have
        # nothing to do with each other.
        if "unreachable" in text.lower() or "no route" in text.lower():
            hint = ("no route to this host. If it resolved IPv6-only above, this box "
                    "has no IPv6 - use the Supabase pooler string instead.")
        elif "rejected SSL" in text or "server does not support SSL" in text:
            hint = ("the server does not speak TLS. Drop ?ssl=require - correct for a "
                    "local Postgres, and never correct for Supabase.")
        elif "password authentication" in text.lower() or "auth" in type(exc).__name__.lower():
            hint = "the credentials are wrong, or the password needs URL-encoding."
        else:
            hint = ""
        report(FAIL, f"database connection failed: {type(exc).__name__}",
               (text[:130] + (" — " + hint if hint else "")))


def check_storage() -> None:
    try:
        from app.core.config import settings
        from app.providers.storage import get_storage
    except Exception:  # noqa: BLE001
        return

    if settings.STORAGE_PROVIDER == "local":
        root = Path(settings.MEDIA_ROOT)
        try:
            root.mkdir(parents=True, exist_ok=True)
            report(PASS, f"local storage writable at {root}")
        except OSError as exc:
            report(FAIL, f"MEDIA_ROOT is not writable: {root}", str(exc)[:120])
        return

    try:
        provider = get_storage()
    except RuntimeError as exc:
        report(FAIL, "storage provider not configured", str(exc)[:160])
        return

    report(PASS, f"storage provider = {provider.name}")

    if settings.STORAGE_PROVIDER == "bunny":
        import httpx
        base = settings.BUNNY_PUBLIC_BASE_URL.rstrip("/")
        try:
            r = httpx.head(base, timeout=20, follow_redirects=True)
            report(PASS, "pull zone answers", f"{base} → HTTP {r.status_code}")
        except Exception as exc:  # noqa: BLE001
            report(WARN, "pull zone did not answer", str(exc)[:120])
        if "storage.bunnycdn.com" in base:
            report(FAIL, "BUNNY_PUBLIC_BASE_URL points at the storage host",
                   "it must be the PULL ZONE, or every file is served uncached "
                   "from origin")


def main() -> int:
    print(f"Nivisa API preflight — {os.getcwd()}\n")
    check_python()
    check_layout()
    check_imports()
    check_app()
    check_settings()
    check_database()
    check_storage()

    print()
    if problems:
        print(f"{len(problems)} blocking problem(s). Fix these before restarting the app:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("Ready. Restart the application in cPanel and hit /api/v1/health.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
