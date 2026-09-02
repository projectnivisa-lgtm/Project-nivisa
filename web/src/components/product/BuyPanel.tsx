"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatMoney } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { ApiError } from "@/api/client";
import { recordArAssistedAdd } from "@/components/product/ArButton";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import type { Product } from "@/types/product";

/**
 * Purchase controls.
 *
 * The whole page exists to get someone here with enough confidence to press a
 * button, so this component's job is to remove every remaining reason to
 * hesitate: what it costs, whether it is in stock, what happens after the
 * order, and how to undo the decision.
 *
 * Two actions, ranked. "Add to cart" is primary because furniture is usually
 * bought as more than one piece; "Buy now" is the outline button for someone
 * who is done deciding. Both are disabled — not hidden — when out of stock, so
 * the page does not silently rearrange itself.
 */
export function BuyPanel({ product }: { product: Product }) {
  const router = useRouter();
  const { cart, addItem } = useCart();

  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<
    { kind: "added" } | { kind: "error"; message: string } | null
  >(null);

  const variant = product.variants.find((v) => v.id === variantId);
  const isOutOfStock = product.stockState === "out-of-stock";

  // Cap at what is on hand: the backend rejects an over-quantity add, and a
  // stepper that simply stops is better than an error toast after the fact.
  // Counted per VARIANT, not per product — two walnut chairs in the cart say
  // nothing about how many ink ones are left.
  const inCart = cart.lines
    .filter((line) => line.variantId === variantId)
    .reduce((sum, line) => sum + line.quantity, 0);
  const maxAddable = Math.max(1, product.stockQuantity - inCart);

  async function add(): Promise<boolean> {
    setFeedback(null);
    try {
      if (!variantId) {
        setFeedback({ kind: "error", message: "Choose an option first." });
        return false;
      }
      await addItem.mutateAsync({ variantId, quantity });
      // Attributes the sale to AR when this session opened it on this piece.
      // Recorded after the add succeeds, so a failed add is never counted.
      recordArAssistedAdd(product.id);
      setFeedback({ kind: "added" });
      return true;
    } catch (cause) {
      setFeedback({
        kind: "error",
        message:
          cause instanceof ApiError
            ? cause.message
            : "We could not add that to your cart. Please try again.",
      });
      return false;
    }
  }

  /**
   * Buy Now routes through the cart rather than `/orders/direct`, so the
   * customer sees one checkout with one set of totals. The direct-order
   * endpoint exists but bypasses cart-level coupon and shipping rules, which
   * would show a different price here than at checkout.
   */
  async function buyNow() {
    if (await add()) router.push("/checkout");
  }

  const isBusy = addItem.isPending;

  return (
    <div id="buy-panel" className="buy-stack space-y-(--buy-stack-gap)">
      <div>
        <PriceDisplay price={product.price} size="lg" />
        <p className="mt-1.5 text-xs text-ink-muted">
          Inclusive of all taxes. Delivery and assembly included.
        </p>
      </div>

      <StockLine product={product} />

      {/* Variants render only when there is a genuine choice. The adapter
          emits a single implicit variant for every product, and a selector
          with one option is a control that cannot be used. */}
      {product.variants.length > 1 ? (
        <fieldset>
          <legend className="text-sm font-medium">
            {product.variants[0].axis}
            <span className="ml-2 font-normal text-ink-muted">
              {variant?.label}
            </span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.variants.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setVariantId(option.id)}
                disabled={!option.available}
                aria-pressed={option.id === variantId}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-sm border px-3 text-sm transition-colors duration-fast",
                  option.id === variantId
                    ? "border-ink"
                    : "border-border hover:border-border-interactive",
                  !option.available && "cursor-not-allowed opacity-45",
                )}
              >
                {option.swatchHex ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: option.swatchHex }}
                  />
                ) : null}
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Quantity</span>
        <QuantityStepper
          value={quantity}
          max={maxAddable}
          disabled={isOutOfStock}
          onChange={setQuantity}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={add}
          disabled={isOutOfStock || isBusy}
          className={cn(
            "inline-flex min-h-12 flex-1 items-center justify-center rounded-sm px-6 text-sm font-medium transition-colors duration-fast",
            isOutOfStock
              ? "cursor-not-allowed bg-surface-sunken text-ink-subtle"
              : "bg-primary text-on-primary hover:bg-primary-hover",
          )}
        >
          {isBusy ? "Adding…" : isOutOfStock ? "Out of stock" : "Add to cart"}
        </button>

        <button
          type="button"
          onClick={buyNow}
          disabled={isOutOfStock || isBusy}
          className={cn(
            "inline-flex min-h-12 flex-1 items-center justify-center rounded-sm border px-6 text-sm font-medium transition-colors duration-fast",
            isOutOfStock
              ? "cursor-not-allowed border-border text-ink-subtle"
              : "border-border-interactive hover:border-ink",
          )}
        >
          Buy now
        </button>

        <WishlistButton
          productId={product.id}
          productName={product.name}
          className="border border-border-interactive"
        />
      </div>

      {/* One live region for both outcomes, so a screen reader hears the
          result of the tap without the focus moving anywhere. */}
      <div role="status" aria-live="polite">
        {feedback?.kind === "added" ? (
          <p className="rounded-sm bg-success-soft px-4 py-3 text-sm text-success">
            Added to your cart — {formatMoney(product.price.selling)} ×{" "}
            {quantity}.
          </p>
        ) : feedback?.kind === "error" ? (
          <p className="rounded-sm bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {feedback.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StockLine({ product }: { product: Product }) {
  if (product.stockState === "out-of-stock") {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Dot className="bg-lime-500" />
        Out of stock. Tell us where to reach you and we will let you know when
        it is back.
      </p>
    );
  }

  if (product.stockState === "low-stock") {
    return (
      <p className="flex items-center gap-2 text-sm text-warning">
        <Dot className="bg-warning" />
        {/* A real number, not "hurry!". Scarcity is only persuasive when it
            is checkable. */}
        Only {product.stockQuantity} left in stock
      </p>
    );
  }

  return (
    <p className="flex items-center gap-2 text-sm text-success">
      <Dot className="bg-success" />
      In stock, ready to dispatch
    </p>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", className)}
    />
  );
}

export function QuantityStepper({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-sm border border-border-interactive">
      <StepButton
        label="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <path d="M5 12h14" />
      </StepButton>
      <span
        aria-live="polite"
        className="min-w-10 text-center text-sm tabular"
      >
        {value}
      </span>
      <StepButton
        label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <path d="M12 5v14M5 12h14" />
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 items-center justify-center transition-colors duration-fast",
        disabled ? "cursor-not-allowed text-lime-400" : "hover:bg-surface-sunken",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}
