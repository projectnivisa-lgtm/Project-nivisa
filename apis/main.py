"""Nivisa Commerce API."""
import logging
import mimetypes
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.admin.router import admin_router
from app.core.config import settings
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
async def root() -> str:
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
    """
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
    <li><a href="/docs">API reference</a></li>
    <li><a href="{settings.API_PREFIX}/health">Health check</a></li>
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
