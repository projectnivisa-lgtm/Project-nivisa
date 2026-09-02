"""The mock gateway's payment screen.

A real hosted checkout takes the browser away, lets a person decide, and
sends them back with no outcome in the URL. This reproduces that shape so the
storefront's checkout code is the same one production will run - a mock that
auto-approved would let a whole class of redirect bug reach production
unexercised.

The routes only exist outside production. On a live box `PAYMENT_PROVIDER`
must be a real gateway anyway, and `get_payment_provider()` refuses the mock
there, but a screen that hands out free orders should not be reachable at all.
"""
from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, RedirectResponse

from app.core.config import settings
from app.providers.payments import MockPaymentProvider

router = APIRouter(prefix="/checkout", tags=["Shop · Mock payment"])

_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mock payment - Nivisa</title>
<style>
  body {{ font-family: system-ui, sans-serif; background: #f6f4f1; color: #1c1917;
         display: grid; place-items: center; min-height: 100vh; margin: 0; }}
  .card {{ background: #fff; border: 1px solid #e7e2dc; border-radius: 10px;
           padding: 32px; width: min(420px, 90vw); }}
  h1 {{ font-size: 18px; margin: 0 0 4px; }}
  p {{ color: #6b6259; font-size: 14px; margin: 0 0 24px; }}
  dl {{ display: grid; grid-template-columns: auto 1fr; gap: 8px 16px;
        font-size: 14px; margin: 0 0 24px; }}
  dt {{ color: #6b6259; }} dd {{ margin: 0; text-align: right; font-variant-numeric: tabular-nums; }}
  .row {{ display: flex; gap: 12px; }}
  a {{ flex: 1; text-align: center; padding: 12px; border-radius: 8px;
       text-decoration: none; font-size: 14px; font-weight: 500; }}
  .pay {{ background: #1c1917; color: #fff; }}
  .fail {{ background: #fff; color: #1c1917; border: 1px solid #d6cfc7; }}
  .note {{ margin-top: 20px; font-size: 12px; color: #8a8078; }}
</style></head><body>
<div class="card">
  <h1>Mock payment gateway</h1>
  <p>No money moves here. This screen stands in for the real gateway.</p>
  <dl>
    <dt>Order</dt><dd>{order}</dd>
    <dt>Amount</dt><dd>Rs {amount}</dd>
    <dt>Reference</dt><dd>{reference}</dd>
  </dl>
  <div class="row">
    <a class="pay" href="{prefix}/checkout/mock/complete?reference={reference}&order={order}&outcome=success">Pay</a>
    <a class="fail" href="{prefix}/checkout/mock/complete?reference={reference}&order={order}&outcome=failure">Decline</a>
  </div>
  <p class="note">Switch PAYMENT_PROVIDER to phonepe to use the real gateway.</p>
</div></body></html>
"""


if not settings.is_production:

    @router.get("/mock", response_class=HTMLResponse, include_in_schema=False)
    async def mock_screen(reference: str, order: str, amount: str = "0.00"):
        return HTMLResponse(
            _PAGE.format(
                order=order, amount=amount, reference=reference, prefix=settings.API_PREFIX
            )
        )

    @router.get("/mock/complete", include_in_schema=False)
    async def mock_complete(
        reference: str,
        order: str,
        outcome: str = Query("success", pattern="^(success|failure)$"),
    ):
        """Sends the browser back to the storefront exactly as a real gateway
        would: to the checkout page, carrying only the order number.

        The outcome is recorded against the reference on the way through, so
        the storefront discovers it by reading the order - never by trusting
        a query parameter it was handed. That is the property that matters
        here: a client that believed `?outcome=success` would be a client
        anyone could hand a paid order to.
        """
        MockPaymentProvider.record_outcome(reference, succeeded=outcome == "success")
        return RedirectResponse(
            f"{settings.STOREFRONT_URL}/checkout?order={order}", status_code=303
        )
