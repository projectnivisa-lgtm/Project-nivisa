"use client";

import Link from "next/link";
import { cn, formatMoney } from "@/lib/utils";
import { ProductImage } from "@/components/commerce/ProductImage";
import { QuantityStepper } from "@/components/product/BuyPanel";
import type { CartLine } from "@/types/cart";

/**
 * One cart line.
 *
 * Quantity, remove and save-for-later sit under the item rather than in a
 * trailing column: on a phone a right-aligned control column collapses into an
 * unreadable stack, and the actions belong with the thing they act on.
 *
 * The line total is shown per line, but it is display arithmetic only — the
 * payable figure is the server's `total` in the summary, never a sum computed
 * here (see `types/cart.ts`).
 */
export function CartLineRow({
  line,
  onQuantityChange,
  onRemove,
  onSaveForLater,
  isBusy,
}: {
  line: CartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onSaveForLater?: () => void;
  isBusy?: boolean;
}) {
  const isUnavailable = line.stockState === "out-of-stock";

  return (
    <li
      className={cn(
        "flex gap-4 py-6 sm:gap-6",
        isBusy && "opacity-60 transition-opacity duration-fast",
      )}
    >
      <Link
        href={line.slug ? `/product/${line.slug}` : "#"}
        className="w-24 shrink-0 sm:w-32"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProductImage src={line.imageUrl} alt="" aspect="aspect-4/3" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h3 className="font-sans text-base font-medium tracking-normal">
              <Link
                href={line.slug ? `/product/${line.slug}` : "#"}
                className="hover:text-accent"
              >
                {line.name}
              </Link>
            </h3>

            {line.variantLabels.length > 0 ? (
              <p className="mt-1 text-xs text-ink-muted">
                {line.variantLabels.join(" · ")}
              </p>
            ) : null}

            <p data-price className="mt-1 text-xs text-ink-muted">
              {formatMoney(line.unitPrice)} each
            </p>

            {isUnavailable ? (
              <p className="mt-2 text-xs text-destructive">
                Out of stock — remove it to continue to checkout.
              </p>
            ) : line.stockState === "low-stock" ? (
              <p className="mt-2 text-xs text-warning">
                Only {line.maxQuantity} left
              </p>
            ) : null}
          </div>

          <p data-price className="shrink-0 text-base font-semibold">
            {formatMoney(line.lineTotal)}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <QuantityStepper
            value={line.quantity}
            max={Math.max(line.quantity, line.maxQuantity)}
            disabled={isBusy || isUnavailable}
            onChange={onQuantityChange}
          />

          {onSaveForLater ? (
            <button
              type="button"
              onClick={onSaveForLater}
              disabled={isBusy}
              className="min-h-11 text-xs text-ink-muted underline-offset-4 transition-colors duration-fast hover:text-ink hover:underline"
            >
              Save for later
            </button>
          ) : null}

          <button
            type="button"
            onClick={onRemove}
            disabled={isBusy}
            className="min-h-11 text-xs text-ink-muted underline-offset-4 transition-colors duration-fast hover:text-destructive hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
