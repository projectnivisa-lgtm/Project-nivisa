"""Email and SMS, behind one interface each.

In Docker: SMS goes to the log, email goes to Mailpit (a real SMTP server
with a web inbox at http://localhost:8025). Both paths therefore exercise
the same code production will, and the templates are actually visible while
being written - which a no-op stub would not give you.
"""
import logging
import smtplib
from abc import ABC, abstractmethod
from email.message import EmailMessage

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# --- SMS --------------------------------------------------------------------


class SmsProvider(ABC):
    name: str

    @abstractmethod
    async def send_otp(self, *, phone: str, code: str) -> None:
        ...


class ConsoleSms(SmsProvider):
    """Writes the OTP to the application log.

    Paired with `OTP_CONSOLE_CODE`, which makes every code the same known
    value in local development, so a login does not require reading logs at
    all. The auth route refuses to use the fixed code outside `local`.
    """

    name = "console"

    async def send_otp(self, *, phone: str, code: str) -> None:
        logger.warning("[SMS:console] OTP for %s is %s", phone, code)


class Msg91Sms(SmsProvider):
    name = "msg91"

    def __init__(self) -> None:
        if not settings.MSG91_AUTH_KEY:
            raise RuntimeError("SMS_PROVIDER=msg91 but MSG91_AUTH_KEY is unset.")

    async def send_otp(self, *, phone: str, code: str) -> None:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://control.msg91.com/api/v5/otp",
                params={
                    "template_id": settings.MSG91_TEMPLATE_ID,
                    "mobile": f"91{phone}",
                    "otp": code,
                    "sender": settings.MSG91_SENDER_ID,
                },
                headers={"authkey": settings.MSG91_AUTH_KEY},
            )
            response.raise_for_status()


# --- Email ------------------------------------------------------------------


class EmailProvider(ABC):
    name: str

    @abstractmethod
    async def send(self, *, to: str, subject: str, html: str, text: str | None = None) -> None:
        ...


class ConsoleEmail(EmailProvider):
    name = "console"

    async def send(self, *, to: str, subject: str, html: str, text: str | None = None) -> None:
        logger.info("[EMAIL:console] to=%s subject=%s\n%s", to, subject, text or html)


class SmtpEmail(EmailProvider):
    name = "smtp"

    async def send(self, *, to: str, subject: str, html: str, text: str | None = None) -> None:
        message = EmailMessage()
        message["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
        message["To"] = to
        message["Subject"] = subject
        message.set_content(text or "This message requires an HTML-capable mail client.")
        message.add_alternative(html, subtype="html")

        # smtplib is blocking. At this volume - a handful of transactional
        # messages per order - a thread is the wrong shape of fix; callers
        # send these from a BackgroundTask so the request has already
        # returned by the time this runs.
        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                if settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(message)
        except Exception:
            # A failed receipt email must never fail the order that triggered
            # it. The order is placed; the customer can be re-notified.
            logger.exception("Failed to send email to %s (%s)", to, subject)


_sms: SmsProvider | None = None
_email: EmailProvider | None = None


def get_sms() -> SmsProvider:
    global _sms
    if _sms is None:
        _sms = Msg91Sms() if settings.SMS_PROVIDER == "msg91" else ConsoleSms()
    return _sms


def get_email() -> EmailProvider:
    global _email
    if _email is None:
        _email = SmtpEmail() if settings.EMAIL_PROVIDER == "smtp" else ConsoleEmail()
    return _email
