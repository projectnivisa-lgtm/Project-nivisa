"use client";

import { useState } from "react";
import { ApiError } from "@/api/client";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { DEMO_COUPON_CODES } from "@/lib/demo/cart";

/**
 * Coupon entry.
 *
 * Collapsed behind a link until asked for. An open, empty "promo code" box is
 * one of the most reliably damaging things on a checkout page: it tells people
 * a discount exists that they do not have, and sends them off to search for
 * one — frequently never coming back.
 *
 * A rejected code shows the backend's own reason inline, beside the field, so
 * "this coupon has expired" is distinguishable from "this code does not exist".
 */
export function CouponField({
  appliedCode,
  onApply,
  isBusy,
}: {
  appliedCode?: string;
  onApply: (code: string) => Promise<unknown>;
  isBusy?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(Boolean(appliedCode));
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-sm bg-success-soft px-4 py-3">
        <p className="text-sm text-success">
          <span className="font-medium">{appliedCode}</span> applied
        </p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="min-h-11 text-sm text-accent underline-offset-4 hover:underline"
      >
        Have a discount code?
      </button>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        try {
          await onApply(code.trim());
          setCode("");
        } catch (cause) {
          setError(
            cause instanceof ApiError || cause instanceof Error
              ? cause.message
              : "That code could not be applied.",
          );
        }
      }}
    >
      <label htmlFor="coupon" className="block text-sm font-medium">
        Discount code
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="coupon"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={error ? "coupon-error" : undefined}
          aria-invalid={error ? true : undefined}
          className="h-11 min-w-0 flex-1 rounded-sm border border-border-interactive bg-canvas px-3 text-sm uppercase tracking-wide focus:border-accent"
        />
        <button
          type="submit"
          disabled={!code.trim() || isBusy}
          className="h-11 shrink-0 rounded-sm border border-border-interactive px-5 text-sm font-medium transition-colors duration-fast hover:border-ink disabled:cursor-not-allowed disabled:text-ink-subtle"
        >
          Apply
        </button>
      </div>

      {error ? (
        <p id="coupon-error" role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {IS_DEMO_CONTENT ? (
        <p className="mt-2 text-2xs text-ink-muted">
          Demo codes:{" "}
          {DEMO_COUPON_CODES.map((c) => c.code).join(", ")}
        </p>
      ) : null}
    </form>
  );
}
