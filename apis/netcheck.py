"""Find out what this box is allowed to connect OUT to.

WHY THIS EXISTS SEPARATELY FROM preflight.py
    preflight checks that the deployment is configured correctly - the right
    driver, a parseable DSN, a pooler username with the project ref in it. It
    answers "is this set up right".

    This answers a different question: "is this box ALLOWED to reach the
    database at all". Those look identical from the browser - every endpoint
    500s either way - and the fix for one is a file, while the fix for the
    other is a support ticket. A configuration you cannot fault and a
    connection that is refused is the point at which people start editing the
    settings again, which cannot help.

WHAT IT PROVES
    Shared hosting commonly allows outbound 80 and 443 and nothing else.
    Postgres is 5432, so the box resolves the hostname, gets real addresses,
    and is then refused on every one of them. This script separates that from
    the alternatives by testing the same host on a port that is normally
    allowed, and a normally-allowed host on the port that is failing:

        DB host on 5432 fails, DB host on 443 works   -> the PORT is blocked
        DB host fails on everything, others work      -> the HOST is blocked
        everything fails                              -> no outbound at all
        everything works                              -> not the network; the
                                                         fault is in the app

    Run it, paste the output into the ticket, and the host support desk has
    what it needs without a conversation about what a pooler is.

USAGE
    In the cPanel terminal, in the application root:

        python netcheck.py

    It reads apis/.env for DATABASE_URL if that file is present, so it tests
    the host this deployment actually dials rather than one typed here. It
    needs nothing installed - standard library only - so it runs whether or
    not the virtualenv is active. It only opens TCP connections and sends
    nothing, so it is safe to run on a live box.
"""
from __future__ import annotations

import os
import socket
from pathlib import Path
from urllib.parse import urlsplit

TIMEOUT = 10.0


def load_env_file() -> None:
    """Read DATABASE_URL out of .env without needing pydantic installed."""
    path = Path(__file__).resolve().parent / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        os.environ.setdefault(name.strip(), value.strip())


def resolve(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except OSError as exc:
        print(f"  DNS FAILED for {host}: {exc}")
        return []
    addresses = sorted({i[4][0] for i in infos})
    families = {("IPv6" if ":" in a else "IPv4") for a in addresses}
    print(f"  {host} resolves to {', '.join(addresses)}  [{', '.join(sorted(families))}]")
    if families == {"IPv6"}:
        print("  ^ IPv6 only. If this box has no IPv6 route every connection to it")
        print("    fails as 'Cannot assign requested address'. Use the pooler host.")
    return addresses


def probe(host: str, port: int, label: str) -> bool:
    """Open a TCP connection and close it. Nothing is sent."""
    try:
        sock = socket.create_connection((host, port), timeout=TIMEOUT)
    except OSError as exc:
        # errno matters more than the text, which differs per platform.
        reason = f"{type(exc).__name__}: {exc}"
        print(f"  [BLOCKED] {label:<44} {host}:{port}")
        print(f"            {reason}")
        return False
    sock.close()
    print(f"  [  OK   ] {label:<44} {host}:{port}")
    return True


def main() -> int:
    load_env_file()
    print("Nivisa outbound connectivity check\n")

    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("DATABASE_URL is not set and no .env was found beside this script.")
        print("Run this from the application root, or export DATABASE_URL first.")
        return 2

    parts = urlsplit(url.replace("postgresql+asyncpg://", "postgresql://"))
    db_host = parts.hostname or ""
    db_port = parts.port or 5432
    print(f"Database host from DATABASE_URL: {db_host}:{db_port}\n")

    print("DNS")
    resolve(db_host)

    print("\nThe database, on the port it is configured for")
    configured = probe(db_host, db_port, "configured port")

    print("\nThe same database host, on other ports")
    # 6543 is Supabase's transaction pooler. 443 is the control: if the host
    # answers there, the machine can reach it and only the port is the problem.
    alt_pooler = probe(db_host, 6543, "supabase transaction pooler") if db_port != 6543 else False
    same_host_443 = probe(db_host, 443, "same host over HTTPS (control)")

    print("\nSomewhere unrelated, to see if outbound works at all")
    generic_443 = probe("api.github.com", 443, "HTTPS to a well-known host")
    generic_80 = probe("example.com", 80, "HTTP to a well-known host")

    print("\n" + "-" * 68)
    if configured:
        print("VERDICT  The database port is reachable from this box.")
        print("         The network is not the problem - if the API still 500s,")
        print("         the cause is in the application or the credentials.")
        print("         Open /api/v1/health/db, which reports the real exception.")
        return 0

    if not (generic_443 or generic_80):
        print("VERDICT  This box has NO outbound access at all, not even HTTP.")
        print("         Nothing in the application can work around that. The host")
        print("         has to enable outbound traffic.")
        return 1

    if same_host_443 or generic_443:
        print(f"VERDICT  Outbound works, but port {db_port} is blocked.")
        print("         This is a firewall rule on the hosting account, not a")
        print("         misconfiguration - the settings are right and the packets")
        print("         are being refused.")
        print()
        print("         Ask the host, quoting this output:")
        print("           'Please allow outbound TCP to ports 5432 and 6543 for")
        print("            this account. They are the PostgreSQL ports for our")
        print(f"            managed database at {db_host}.'")
        if alt_pooler:
            print()
            print("         Port 6543 IS open. Change only the port in")
            print("         DATABASE_URL to 6543 and restart - the app already")
            print("         sets statement_cache_size=0, which is what makes it")
            print("         safe behind the transaction pooler.")
        return 1

    print("VERDICT  This box cannot reach that host on any port tested, though")
    print("         other hosts are reachable. The database host may be behind an")
    print("         IP allowlist: check Supabase > Settings > Database >")
    print("         Network Restrictions.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
