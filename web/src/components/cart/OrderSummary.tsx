import { cn, formatMoney } from "@/lib/utils";
import type { Cart } from "@/types/cart";

/**
 * Money summary.
 *
 * Every figure here comes from the server's cart response. Nothing is summed
 * locally — coupon and shipping rules live server-side, and a second
 * implementation would eventually disagree with the amount actually charged.
 *
 * Rows appear only when they are non-zero, except the total. A summary listing
 * "Discount ₹0" invites the question of why there is no discount, which is not
 * a question a checkout page should be raising.
 */
export function OrderSummary({
  cart,
  className,
}: {
  cart: Cart;
  className?: string;
}) {
  const hasDiscount = cart.ruleDiscount.amount > 0;
  const hasSavings = cart.savings.amount > 0;
  const isFreeShipping = cart.shippingFee.amount === 0 && cart.lines.length > 0;

  return (
    <dl className={cn("space-y-3 text-sm", className)}>
      <Row
        label={`Subtotal (${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"})`}
        value={formatMoney(cart.subtotal)}
      />

      {hasSavings ? (
        <Row
          label="You save"
          value={`− ${formatMoney(cart.savings)}`}
          tone="sale"
        />
      ) : null}

      {hasDiscount ? (
        <Row
          label={cart.appliedCouponCode ? `Coupon ${cart.appliedCouponCode}` : "Discount"}
          value={`− ${formatMoney(cart.ruleDiscount)}`}
          tone="sale"
        />
      ) : null}

      <Row
        label="Delivery & assembly"
        value={isFreeShipping ? "Free" : formatMoney(cart.shippingFee)}
        tone={isFreeShipping ? "success" : undefined}
      />

      <div className="flex items-baseline justify-between border-t border-border pt-4">
        <dt className="text-base font-medium">Total</dt>
        <dd data-price className="text-xl font-semibold">
          {formatMoney(cart.total)}
        </dd>
      </div>

      <p className="text-2xs text-ink-muted">
        Inclusive of all taxes.
        {isFreeShipping ? " Delivery and assembly included." : null}
      </p>
    </dl>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "sale" | "success";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd
        data-price
        className={cn(
          tone === "sale" && "text-sale",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
