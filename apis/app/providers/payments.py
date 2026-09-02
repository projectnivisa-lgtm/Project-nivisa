"""Payment gateway, behind one interface.

`mock` completes a checkout end to end with no merchant account, so the whole
order lifecycle - place, pay, fulfil, refund - is exercised in Docker today.
`phonepe` is the production implementation. Switching is `PAYMENT_PROVIDER`
in the environment; no call site changes, and the mock path stays in the
codebase as the thing the test suite runs against.

The mock is refused outright when APP_ENV is production, so a missing
variable on a live box cannot hand out free orders.
"""
import hashlib
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class PaymentSession:
    """What the client needs to take the customer to a payment screen."""

    reference: str
    redirect_url: str
    provider: str


@dataclass
class PaymentResult:
    reference: str
    succeeded: bool
    method: str | None = None
    failure_reason: str | None = None
    raw: dict | None = None


class PaymentProvider(ABC):
    name: str

    @abstractmethod
    async def create_session(self, *, order_number: str, amount: Decimal, customer_phone: str | None) -> PaymentSession:
        ...

    @abstractmethod
    async def verify(self, *, reference: str, order_number: str) -> PaymentResult:
        ...

    @abstractmethod
    async def refund(self, *, reference: str, amount: Decimal) -> PaymentResult:
        ...


class MockPaymentProvider(PaymentProvider):
    """Deterministic, offline, and obvious about being fake.

    The redirect URL points back at this API's own `/checkout/mock` screen,
    where a developer picks success or failure. That is closer to the real
    flow than auto-approving would be: the client still navigates away, still
    comes back with only an order number, and still learns the outcome by
    re-reading the order - which is exactly what PhonePe requires.
    """

    name = "mock"

    # reference -> did the developer press Pay or Decline. In-process, which
    # is right for what this is: a single dev container, and an outcome that
    # only has to survive the seconds between the redirect and the order
    # being re-read. A restart mid-payment leaves the reference unknown,
    # which `verify` reports as still pending rather than as paid.
    _outcomes: dict[str, bool] = {}

    @classmethod
    def record_outcome(cls, reference: str, *, succeeded: bool) -> None:
        cls._outcomes[reference] = succeeded

    async def create_session(self, *, order_number: str, amount: Decimal, customer_phone: str | None) -> PaymentSession:
        reference = f"MOCK-{uuid.uuid4().hex[:16].upper()}"
        # Absolute, exactly as a real gateway returns. A relative path would
        # resolve against the storefront's own origin and 404 there - and
        # would mean the mock's shape differs from production in precisely the
        # way a mock exists to rule out.
        redirect = (
            f"{settings.PUBLIC_API_URL}{settings.API_PREFIX}/checkout/mock"
            f"?reference={reference}&order={order_number}&amount={amount}"
        )
        logger.info("Mock payment session %s for order %s (%s)", reference, order_number, amount)
        return PaymentSession(reference=reference, redirect_url=redirect, provider=self.name)

    async def verify(self, *, reference: str, order_number: str) -> PaymentResult:
        outcome = self._outcomes.get(reference)
        if outcome is None:
            # Nobody has pressed anything yet. Reported as a failure with no
            # reason so the caller leaves the payment in flight rather than
            # marking the order paid or failed on a customer who is still on
            # the payment screen.
            return PaymentResult(
                reference=reference, succeeded=False, failure_reason=None,
                raw={"provider": "mock", "state": "pending", "order": order_number},
            )
        return PaymentResult(
            reference=reference,
            succeeded=outcome,
            method="upi" if outcome else None,
            failure_reason=None if outcome else "Payment declined at the mock gateway.",
            raw={"provider": "mock", "state": "completed" if outcome else "declined", "order": order_number},
        )

    async def refund(self, *, reference: str, amount: Decimal) -> PaymentResult:
        return PaymentResult(reference=f"{reference}-REFUND", succeeded=True, raw={"amount": str(amount)})


class PhonePeProvider(PaymentProvider):
    """PhonePe hosted checkout.

    One deliberate difference from the backend this project started from:
    the redirect is created by an authenticated POST that returns a URL,
    rather than a GET carrying the customer's session JWT in a query string.
    That original design put a live full-scope token into browser history,
    the Referer sent to PhonePe, and every intermediary log. The client here
    calls `POST /orders/{n}/pay` with an Authorization header and then
    navigates to the URL it gets back, so no token ever enters a URL.
    """

    name = "phonepe"
    _BASE = {
        "SANDBOX": "https://api-preprod.phonepe.com/apis/pg-sandbox",
        "PRODUCTION": "https://api.phonepe.com/apis/hermes",
    }

    def __init__(self) -> None:
        missing = [
            key for key in ("PHONEPE_MERCHANT_ID", "PHONEPE_CLIENT_ID", "PHONEPE_CLIENT_SECRET")
            if not getattr(settings, key)
        ]
        if missing:
            raise RuntimeError(
                "PAYMENT_PROVIDER=phonepe but these are unset: " + ", ".join(missing)
            )
        self._base = self._BASE[settings.PHONEPE_ENV]

    async def _token(self) -> str:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self._base}/v1/oauth/token",
                data={
                    "client_id": settings.PHONEPE_CLIENT_ID,
                    "client_secret": settings.PHONEPE_CLIENT_SECRET,
                    "client_version": settings.PHONEPE_CLIENT_VERSION,
                    "grant_type": "client_credentials",
                },
            )
            response.raise_for_status()
            return response.json()["access_token"]

    async def create_session(self, *, order_number: str, amount: Decimal, customer_phone: str | None) -> PaymentSession:
        reference = f"NIV{order_number.replace('-', '')}{uuid.uuid4().hex[:6].upper()}"
        token = await self._token()
        payload = {
            "merchantOrderId": reference,
            # PhonePe works in paise, and the conversion is the classic place
            # to lose a factor of 100. Quantize first so a Decimal with more
            # than two places cannot silently truncate.
            "amount": int(amount.quantize(Decimal("0.01")) * 100),
            "paymentFlow": {
                "type": "PG_CHECKOUT",
                "merchantUrls": {"redirectUrl": f"{settings.STOREFRONT_URL}/checkout?order={order_number}"},
            },
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{self._base}/checkout/v2/pay",
                json=payload,
                headers={"Authorization": f"O-Bearer {token}", "Content-Type": "application/json"},
            )
            response.raise_for_status()
            body = response.json()
        return PaymentSession(reference=reference, redirect_url=body["redirectUrl"], provider=self.name)

    async def verify(self, *, reference: str, order_number: str) -> PaymentResult:
        token = await self._token()
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self._base}/checkout/v2/order/{reference}/status",
                headers={"Authorization": f"O-Bearer {token}"},
            )
            response.raise_for_status()
            body = response.json()
        state = body.get("state")
        return PaymentResult(
            reference=reference,
            succeeded=state == "COMPLETED",
            method=(body.get("paymentDetails") or [{}])[0].get("paymentMode"),
            failure_reason=None if state == "COMPLETED" else f"PhonePe reported {state}.",
            raw=body,
        )

    async def refund(self, *, reference: str, amount: Decimal) -> PaymentResult:
        token = await self._token()
        refund_id = f"RF{hashlib.sha1(reference.encode()).hexdigest()[:12].upper()}"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{self._base}/payments/v2/refund",
                json={
                    "merchantRefundId": refund_id,
                    "originalMerchantOrderId": reference,
                    "amount": int(amount.quantize(Decimal("0.01")) * 100),
                },
                headers={"Authorization": f"O-Bearer {token}"},
            )
            response.raise_for_status()
            body = response.json()
        return PaymentResult(reference=refund_id, succeeded=body.get("state") != "FAILED", raw=body)


_provider: PaymentProvider | None = None


def get_payment_provider() -> PaymentProvider:
    global _provider
    if _provider is None:
        if settings.PAYMENT_PROVIDER == "phonepe":
            _provider = PhonePeProvider()
        else:
            if settings.is_production:
                raise RuntimeError(
                    "PAYMENT_PROVIDER=mock is refused in production. "
                    "Set PAYMENT_PROVIDER=phonepe and supply the credentials."
                )
            _provider = MockPaymentProvider()
    return _provider
