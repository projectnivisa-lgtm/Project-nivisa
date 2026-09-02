"""Application settings.

Every integration that costs money in production (payments, SMS, email,
object storage) is selected by a `*_PROVIDER` variable rather than by an
`if DEBUG` branch. Docker runs the local providers; production swaps the
variable and fills in the credentials. No code changes, no redeploy path
that differs from the one already exercised in development.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=True)

    # ---- Identity -------------------------------------------------------
    APP_NAME: str = "Nivisa Commerce API"
    APP_ENV: Literal["local", "staging", "production"] = "local"
    API_PREFIX: str = "/api/v1"

    # ---- Datastores -----------------------------------------------------
    # Defaults point at the docker-compose services; nothing here is a real
    # credential, so a production box that forgets to set them fails on
    # connect rather than silently reaching a developer's database.
    DATABASE_URL: str = "postgresql+asyncpg://nivisa:nivisa@db:5432/nivisa"

    # How the database is REACHED, which is not the same question as where it
    # is. `postgres` speaks the wire protocol on 5432 and is what everything
    # local and Dockerised uses. `supabase` goes through PostgREST on 443,
    # because the cPanel deployment is on a host that refuses outbound 5432
    # and 6543 and there is nothing the application can do about that.
    #
    # DATABASE_URL stays set either way: seeding and migrations need a real
    # connection and are run from a machine that has one.
    # See docs/CPANEL-SUPABASE-HTTP.md.
    DATA_BACKEND: Literal["postgres", "supabase"] = "postgres"
    SUPABASE_URL: str = ""
    # service_role. Bypasses row-level security entirely, so it is equivalent
    # to full database access - server-side only, never a browser bundle.
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    REDIS_URL: str = "redis://cache:6379/0"
    SQL_ECHO: bool = False

    # Connections are per PROCESS, and how many processes exist is decided by
    # whatever is running the app. Under uvicorn that is one; under cPanel's
    # Passenger it is as many workers as it decides to spawn, each with its
    # own pool. Ten plus twenty apiece is comfortable on a dedicated database
    # and is how you exhaust a pooled Supabase connection limit from a single
    # small app - so the numbers are settings rather than constants.
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    # Recycle before a pooler or a firewall drops an idle connection and the
    # next request inherits a socket that is open at this end only.
    DB_POOL_RECYCLE_SECONDS: int = 1800

    # ---- Auth -----------------------------------------------------------
    SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ADMIN_TOKEN_TTL_MINUTES: int = 60 * 12
    CUSTOMER_TOKEN_TTL_MINUTES: int = 60 * 24 * 30

    # ---- CORS -----------------------------------------------------------
    # Explicit origins, not "*": the API sends credentials, and a wildcard
    # with credentials is rejected by browsers anyway.
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:5174"

    # ---- Storefront -----------------------------------------------------
    STOREFRONT_URL: str = "http://localhost:3001"
    # Where a BROWSER reaches this API. Not the same as where the storefront's
    # server reaches it: any URL handed to a browser - a payment redirect, an
    # emailed link - has to be absolute and externally resolvable, and
    # "http://api:8000" is neither outside the compose network.
    PUBLIC_API_URL: str = "http://localhost:8000"
    STORE_NAME: str = "Nivisa"
    STORE_EMAIL: str = "hello@nivisa.in"
    STORE_PHONE: str = "+91 80 0000 0000"
    CURRENCY: str = "INR"

    # ---- Swappable providers -------------------------------------------
    # local/console/mock keep every flow runnable inside Docker with no
    # account anywhere. See app/providers/.
    PAYMENT_PROVIDER: Literal["mock", "phonepe"] = "mock"
    STORAGE_PROVIDER: Literal["local", "s3", "bunny"] = "local"
    EMAIL_PROVIDER: Literal["console", "smtp"] = "console"
    SMS_PROVIDER: Literal["console", "msg91"] = "console"

    # Local storage: files land on a docker volume and are served back by the
    # API itself at MEDIA_URL_PREFIX.
    MEDIA_ROOT: str = "/data/media"
    MEDIA_URL_PREFIX: str = "/media"
    MAX_UPLOAD_MB: int = 10

    # Console SMS writes the OTP to the log instead of sending it. Any
    # provider other than "console" ignores this entirely.
    OTP_TTL_SECONDS: int = 300
    OTP_CONSOLE_CODE: str = "123456"

    # SMTP (Mailpit in docker-compose — a real SMTP server with a web inbox,
    # so the templates are exercised without mail leaving the machine).
    SMTP_HOST: str = "mail"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = False
    MAIL_FROM: str = "orders@nivisa.in"
    MAIL_FROM_NAME: str = "Nivisa"

    # ---- Production credentials (blank until swapped in) ----------------
    PHONEPE_MERCHANT_ID: str = ""
    PHONEPE_CLIENT_ID: str = ""
    PHONEPE_CLIENT_SECRET: str = ""
    PHONEPE_CLIENT_VERSION: str = "1"
    PHONEPE_ENV: Literal["SANDBOX", "PRODUCTION"] = "SANDBOX"

    S3_ENDPOINT_URL: str = ""
    S3_BUCKET: str = ""
    S3_REGION: str = "ap-south-1"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_PUBLIC_BASE_URL: str = ""

    # Bunny Edge Storage. The zone password is the access key - not the
    # account API key, which cannot write files. BUNNY_STORAGE_HOST is
    # regional: storage.bunnycdn.com is Falkenstein, and sg. / ny. / la. /
    # syd. / uk. / se. / br. / jh. prefixes select the others. It must match
    # the region the zone was created in, or every upload returns 401.
    BUNNY_STORAGE_ZONE: str = ""
    BUNNY_ACCESS_KEY: str = ""
    BUNNY_STORAGE_HOST: str = "storage.bunnycdn.com"
    # The PULL ZONE, e.g. https://nivisa.b-cdn.net or a CNAME onto it. This is
    # what customers' browsers hit, so it is cached and it is public.
    BUNNY_PUBLIC_BASE_URL: str = ""

    MSG91_AUTH_KEY: str = ""
    MSG91_SENDER_ID: str = ""
    MSG91_TEMPLATE_ID: str = ""

    # ---- Bootstrap super admin -----------------------------------------
    # Used once by scripts/seed.py. Changing these after the first seed does
    # nothing; use the Staff screen.
    SUPER_ADMIN_EMAIL: str = "superadmin@nivisa.in"
    SUPER_ADMIN_PASSWORD: str = "Nivisa@2026"
    SUPER_ADMIN_NAME: str = "Super Admin"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
