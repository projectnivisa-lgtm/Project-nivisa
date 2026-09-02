"""Nivisa Commerce API."""
import logging
import mimetypes
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, Request, Response, status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.admin.router import admin_router
from app.core import supabase
from app.core.config import settings
from app.core.database import engine
from app.storefront.router import storefront_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
logger = logging.getLogger("nivisa")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Starting %s [%s] - payments=%s storage=%s email=%s sms=%s",
        settings.APP_NAME, settings.APP_ENV, settings.PAYMENT_PROVIDER,
        settings.STORAGE_PROVIDER, settings.EMAIL_PROVIDER, settings.SMS_PROVIDER,
    )

    # Fail loudly at boot rather than at the first request. A production box
    # running on the default secret is a forgeable-token box, and the moment
    # to find that out is startup, not after the first order.
    if settings.is_production:
        problems = []
        if settings.SECRET_KEY == "change-me-in-production":
            problems.append("SECRET_KEY is still the default")
        if settings.PAYMENT_PROVIDER == "mock":
            problems.append("PAYMENT_PROVIDER is still mock")
        if settings.SMS_PROVIDER == "console":
            problems.append("SMS_PROVIDER is still console")
        if problems:
            raise RuntimeError("Refusing to start in production: " + "; ".join(problems))

    yield
    logger.info("Shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description=(
        "Furniture commerce API for the Nivisa storefront and staff dashboard. "
        "Every admin endpoint declares the permission it requires."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


def server_error_response(request: Request, exc: Exception) -> JSONResponse:
    """Everything unexpected: full detail to the log, a reference to the user.

    Exception text can carry SQL, file paths and internal structure. The
    caller gets an id short enough to read over the phone and long enough to
    grep the log for.
    """
    error_id = uuid.uuid4().hex[:12]
    logger.exception("Unhandled error [%s] on %s %s", error_id, request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": (
                "Something went wrong at our end. Please try again, or call us on "
                f"{settings.STORE_PHONE} quoting reference {error_id}."
            ),
            "error_id": error_id,
        },
    )


class ServerErrorsAreCorsErrors(BaseHTTPMiddleware):
    """Turn an unhandled exception into a response *inside* the middleware stack.

    Starlette runs `@app.exception_handler(Exception)` in ServerErrorMiddleware,
    which sits outside every middleware added here - CORSMiddleware included.
    So a 500 goes back with no Access-Control-Allow-Origin, and the browser
    reports "blocked by CORS policy" instead of the 500 that actually happened.
    The reference number the response carries never reaches the console, and
    an hour goes into the CORS configuration, which was never wrong.

    Catching here produces an ordinary response that the middleware above
    still sees, so the error arrives at the front end as a readable 500.
    This middleware must therefore be added BEFORE CORSMiddleware: Starlette
    inserts each at the front of the list, so the last one added is the
    outermost, and CORS has to be outside this one to header its output.
    """

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:  # noqa: BLE001 - deliberately everything
            return server_error_response(request, exc)


app.add_middleware(ServerErrorsAreCorsErrors)

app.add_middleware(
    CORSMiddleware,
    # Explicit origins, never "*". The API is called with an Authorization
    # header from two known front ends; a wildcard buys nothing and would
    # let any page on the internet make authenticated calls on a user's
    # behalf if a token ever landed somewhere reachable.
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Cart-Token"],
    # The cart token is minted server-side and handed back in a header;
    # browser JS cannot read it unless it is listed here.
    expose_headers=["X-Cart-Token"],
)

app.include_router(storefront_router, prefix=settings.API_PREFIX)
app.include_router(admin_router, prefix=f"{settings.API_PREFIX}/admin")

# Python's mimetypes table predates both 3D formats, so a .glb is served as
# text/plain and a .usdz as application/octet-stream. Android's Scene Viewer
# tolerates that; iOS AR Quick Look does not - it silently declines to open a
# USDZ that does not arrive as model/vnd.usdz+zip, and the customer gets a
# blank screen with nothing to explain it.
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("model/gltf+json", ".gltf")
mimetypes.add_type("model/vnd.usdz+zip", ".usdz")

if settings.STORAGE_PROVIDER == "local":
    # Serving uploads from the API is a development convenience. In
    # production STORAGE_PROVIDER=s3 puts them on a CDN and this mount does
    # not exist.
    Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
    app.mount(
        settings.MEDIA_URL_PREFIX,
        StaticFiles(directory=settings.MEDIA_ROOT),
        name="media",
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Raised deliberately by the application, with a message written to be
    # read by whoever hit it. Safe to pass through unchanged.
    return JSONResponse(
        status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return await request_validation_exception_handler(request, exc)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Backstop for anything raised above ServerErrorsAreCorsErrors.

    The middleware catches almost everything and is the path that gets CORS
    headers. This stays for the remainder - an exception raised by a
    middleware outside it - so the response shape is the same either way.
    """
    return server_error_response(request, exc)


@app.get("/", include_in_schema=False, response_class=HTMLResponse)
async def root(request: Request) -> str:
    """A human-readable root, in HTML.

    An API has nothing to say at `/`, and FastAPI's answer is a 404 in
    application/json. That is correct and it breaks cPanel: after installing
    modules, cPanel re-probes the application URL and compares the content
    type against what it saw before. Placeholder `text/html` becoming
    `application/json` is reported as

        "check availability of application has failed ... content type before
         operation text/html doesn't equal to content type after operation
         application/json"

    which reads like a failed deploy and is not one - the same message says
    the operation was performed and the application responds. Serving HTML
    here makes the comparison match, and gives whoever opens the bare domain
    somewhere to go instead of a raw 404 payload.

    Every link below is built from `root_path`, not written as an absolute
    path. This deployment is mounted at a sub-path - /nivisa - so a hardcoded
    href="/api/v1/health" resolves against the DOMAIN and lands on the web
    server's own 404, never reaching Python at all. The page then reads as a
    dead API to the one person most likely to be opening it: whoever is
    trying to work out why it is down. Mounted at the root, root_path is ""
    and these are unchanged.
    """
    # Trailing slashes stripped so the f-string below can join with a leading
    # one and never produce "//api/v1/health", which some proxies redirect and
    # others 404.
    base = request.scope.get("root_path", "").rstrip("/")

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{settings.APP_NAME}</title>
<meta name="robots" content="noindex, nofollow">
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 34rem; margin: 4rem auto;
         padding: 0 1.5rem; line-height: 1.6; color: #1c2530; background: #fbfcfd; }}
  h1 {{ font-size: 1.35rem; margin: 0 0 .25rem; }}
  p  {{ color: #55616f; margin: .25rem 0 1.5rem; }}
  a  {{ color: #2e5aa8; }}
  code {{ background: #eef1f5; padding: .1rem .35rem; border-radius: 3px; }}
</style></head>
<body>
  <h1>{settings.APP_NAME}</h1>
  <p>This is the API. There is no website here.</p>
  <ul>
    <li><a href="{base}/docs">API reference</a></li>
    <li><a href="{base}{settings.API_PREFIX}/health">Health check</a></li>
    <li><a href="{base}{settings.API_PREFIX}/health/db">Database check</a> &mdash; the
        one to open when every endpoint but the health check is a 500</li>
  </ul>
  <p>The shop itself lives at <code>{settings.STOREFRONT_URL}</code>.</p>
</body></html>"""


@app.get(f"{settings.API_PREFIX}/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "providers": {
            "payments": settings.PAYMENT_PROVIDER,
            "storage": settings.STORAGE_PROVIDER,
            "email": settings.EMAIL_PROVIDER,
            "sms": settings.SMS_PROVIDER,
        },
    }


# Failures this has actually produced on a shared host, and what each one
# means.
#
# Matched against the exception's CLASS NAME as well as its text, because the
# text is not portable: a refused connection is "[Errno 111] Connect call
# failed" on the Linux box this deploys to and "[WinError 1225] The remote
# computer refused the network connection" on a developer's laptop, and
# neither contains the tidy phrase you would think to search for. The class
# name - ConnectionRefusedError - is the same on both, and `detail` below is
# built to start with it.
#
# First match wins, so the specific entries precede the general ones.
_DB_HINTS: list[tuple[tuple[str, ...], str]] = [
    (("cannot assign requested address", "errno 99"),
     ("The direct Supabase host is IPv6-only and this box has no IPv6 route. "
      "Use the SESSION POOLER string from Supabase > Connect.")),
    (("connectionrefused", "connection refused", "errno 111"),
     ("Nothing is listening, or the host firewall blocks outbound 5432. Shared "
      "cPanel plans commonly allow only 80/443 outbound - ask the host to open it.")),
    (("timeout",),
     ("The packets are going nowhere, which is a firewall dropping rather than "
      "refusing them. Same fix as connection refused.")),
    (("tenant", "enoidentifier"),
     ("The pooler routes by the tenant encoded in the username: it must be "
      "postgres.<project-ref>, not postgres.")),
    (("password authentication failed", "invalidpassword"),
     ("The password is wrong or was rotated. If it now contains @ : / ? # or a "
      "space it must be percent-encoded, or the driver parses the host out of "
      "the wrong half of the string.")),
    (("psycopg2",),
     ("DATABASE_URL is postgresql://, which selects SQLAlchemy's sync dialect. "
      "It must be postgresql+asyncpg://.")),
    (("does not exist", "invalidcatalogname"),
     "Connected, but that database name is wrong. On Supabase it is postgres."),
    (("name or service not known", "nodename nor servname", "getaddrinfo"),
     ("The hostname does not resolve from this box. Check it for a typo, and "
      "that the box has working DNS.")),
    (("ssl", "certificate"),
     ("TLS was refused. The pooler needs ?ssl=require - not sslmode=require, "
      "which asyncpg does not read.")),
]


def _hint_for(detail: str) -> str | None:
    lowered = detail.lower()
    return next(
        (hint for keys, hint in _DB_HINTS if any(k in lowered for k in keys)),
        None,
    )


@app.get(f"{settings.API_PREFIX}/health/db", tags=["Health"])
async def health_db(response: Response):
    """Whether the database is actually reachable, and if not, why.

    `/health` deliberately touches nothing, so it answers 200 on a box that
    cannot reach Postgres at all - which is exactly the shape of the failure
    that is hardest to diagnose: every real endpoint 500s while the health
    check a monitor watches stays green.

    The 500s those endpoints return carry an error id and nothing else, by
    design: the message a customer sees must not include SQL or hostnames. On
    a shared host that leaves whoever is deploying with an id and no way to
    look it up, because reading the log needs SSH they may not have. This
    endpoint is the way to see the cause in a browser.

    The password is stripped from anything returned, and outside `staging` and
    `local` the reason is withheld entirely - a production box should not
    narrate its own connection settings to the internet.
    """
    started = time.perf_counter()

    # Which path is checked follows DATA_BACKEND, or this reports on a
    # connection the deployment does not use: the cPanel box cannot open 5432
    # at all, so a Postgres probe there is always red and says nothing about
    # whether the API can actually read anything.
    if settings.DATA_BACKEND == "supabase":
        ok, detail = await supabase.health()
        if ok:
            return {
                "database": "ok",
                "via": "supabase-postgrest",
                "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            }
        logger.error("Supabase health check failed: %s", detail)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        body: dict[str, object] = {"database": "unreachable", "via": "supabase-postgrest"}
        if settings.APP_ENV in ("staging", "local"):
            body |= {"error": detail, "dialled": settings.SUPABASE_URL}
        return body

    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - the point is to report anything
        detail = f"{type(exc).__name__}: {exc}"

        # The URL carries the password. Nothing derived from the exception is
        # returned before this runs over it.
        password = urlsplit(settings.DATABASE_URL).password
        if password:
            detail = detail.replace(password, "***")

        logger.error("Database health check failed: %s", detail)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        body = {"database": "unreachable", "via": "postgres"}

        if settings.APP_ENV in ("staging", "local"):
            target = urlsplit(settings.DATABASE_URL)
            body |= {
                "error": detail,
                "hint": _hint_for(detail),
                # Which host it DIALLED, which is how a stale .env is spotted:
                # the answer here is the whole diagnosis when someone uploaded
                # an older file than they think they did.
                "dialled": f"{target.hostname}:{target.port or 5432}",
                "driver": target.scheme,
            }
        return body

    return {
        "database": "ok",
        "via": "postgres",
        "latency_ms": round((time.perf_counter() - started) * 1000, 1),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
