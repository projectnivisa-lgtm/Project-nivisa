import { cn, formatMoney } from "@/lib/utils";
import type { ProductPrice } from "@/types/product";

/**
 * Price.
 *
 * One component so a rupee figure looks identical on a card, the product page,
 * the cart and an order. Three rules it enforces:
 *   - the payable price is always the most prominent number;
 *   - the struck-through MRP only appears when it is genuinely higher;
 *   - the discount is stated as a word plus a number ("23% off"), never as
 *     colour alone, so it survives greyscale and colour-blindness.
 */
export function PriceDisplay({
  price,
  size = "md",
  className,
}: {
  price: ProductPrice;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hasDiscount =
    price.discountPercent > 0 && price.mrp.amount > price.selling.amount;

  const sellingSize =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  const mrpSize = size === "lg" ? "text-base" : "text-sm";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span data-price className={cn("font-semibold", sellingSize)}>
        {formatMoney(price.selling)}
      </span>

      {hasDiscount ? (
        <>
          <span
            data-price
            className={cn("text-ink-subtle line-through", mrpSize)}
            // The struck price is supplementary; announcing it inline confuses
            // a screen reader into reading two prices as one figure.
            aria-label={`Was ${formatMoney(price.mrp)}`}
          >
            {formatMoney(price.mrp)}
          </span>
          <span className={cn("font-medium text-sale", mrpSize)}>
            {price.discountPercent}% off
          </span>
        </>
      ) : null}
    </div>
  );
}
