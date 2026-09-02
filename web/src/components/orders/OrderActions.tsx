"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orderSource, startPayment } from "@/lib/orderSource";
import { ApiError } from "@/api/client";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { formatMoney } from "@/lib/utils";
import { useStore } from "@/hooks/useStore";
import {
  canRetryPayment,
  isCancellable,
  needsSupportToCancel,
  type Order,
} from "@/types/order";

/**
 * What the customer can still do with this order.
 *
 * Every control here is gated on the backend's actual rules, not on what looks
 * plausible. Cancellation in particular is a PAYMENT-state rule: unpaid orders
 * can be cancelled by the customer, paid ones only by staff so a refund can be
 * handled. Showing a Cancel button on a paid order would produce a 409 the
 * moment it was pressed.
 *
 * A paid order therefore gets a phone number rather than a dead button — the
 * customer still needs to cancel, and the honest answer is who to ask.
 */
export function OrderActions({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = useMutation({
    mutationFn: () =>
      // The API requires a reason and shows it on the order. "Cancelled by
      // the customer" is the truthful one for this button; a free-text box
      // here would be a form between someone and an action they have already
      // confirmed.
      orderSource.cancel(order.orderNumber, "Cancelled by the customer"),
    onSuccess: () => {
      setIsConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["order", order.orderNumber] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (cause) => {
      setIsConfirming(false);
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "We could not cancel this order. Please call us.",
      );
    },
  });

  const showCancel = isCancellable(order);
  const showSupport = needsSupportToCancel(order);
  const { store } = useStore();
  const supportPhone = store?.phone ?? null;
  const showPay = canRetryPayment(order) && !IS_DEMO_CONTENT;

  if (!showCancel && !showSupport && !showPay && !error) return null;

  return (
    <section className="mt-10 rounded-sm border border-border bg-surface p-6">
      <h2 className="font-sans text-base font-medium tracking-normal">
        Need to change this order?
      </h2>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-sm bg-destructive-soft px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {showPay ? (
        <div className="mt-4">
          <p className="text-sm text-ink-muted">
            This order is saved but unpaid. You can pay for it without
            rebuilding your cart.
          </p>
          <button
            type="button"
            onClick={() => startPayment(order.orderNumber)}
            className="mt-3 inline-flex min-h-12 items-center rounded-sm bg-primary px-6 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
          >
            Pay {formatMoney(order.total)}
          </button>
        </div>
      ) : null}

      {showCancel ? (
        <div className="mt-5 border-t border-border pt-5">
          <p className="text-sm text-ink-muted">
            Nothing has been charged, so you can cancel this order yourself.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsConfirming(true);
            }}
            className="mt-3 inline-flex min-h-11 items-center rounded-sm border border-border-interactive px-5 text-sm transition-colors duration-fast hover:border-destructive hover:text-destructive"
          >
            Cancel this order
          </button>
        </div>
      ) : null}

      {showSupport ? (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-ink-muted">
            This order has been paid for, so cancelling it means arranging a
            refund.{" "}
            {/* The support number comes from the store record rather than
                being written here. This paragraph is on the refund path — the
                moment a customer most needs to reach a human — so a number
                that has gone stale because it lived in a component is the
                most expensive place to be wrong. */}
            {supportPhone ? (
              <>
                Call us on{" "}
                <a
                  href={`tel:${supportPhone.replace(/\s+/g, "")}`}
                  className="tabular text-accent underline-offset-4 hover:underline"
                >
                  {supportPhone}
                </a>{" "}
              </>
            ) : (
              <>Get in touch </>
            )}
            with order{" "}
            <span className="tabular text-ink">{order.orderNumber}</span> and we
            will sort it out. Monday to Saturday, 9am–7pm.
          </p>
        </div>
      ) : null}

      {isConfirming ? (
        <ConfirmCancel
          orderNumber={order.orderNumber}
          isBusy={cancel.isPending}
          onConfirm={() => cancel.mutate()}
          onDismiss={() => setIsConfirming(false)}
        />
      ) : null}
    </section>
  );
}

/**
 * Cancellation confirmation.
 *
 * Irreversible and re-ordering is not automatic, so it is confirmed rather
 * than offered with an undo. The dismissing action is focused by default: on a
 * destructive dialog, the safe choice should be the one a stray Enter takes.
 */
function ConfirmCancel({
  orderNumber,
  isBusy,
  onConfirm,
  onDismiss,
}: {
  orderNumber: string;
  isBusy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        aria-describedby="cancel-body"
        className="relative w-full max-w-md rounded-t-lg bg-canvas p-6 shadow-pop sm:rounded-sm"
      >
        <h2
          id="cancel-title"
          className="font-sans text-lg font-medium tracking-normal"
        >
          Cancel order {orderNumber}?
        </h2>
        <p id="cancel-body" className="mt-2 text-sm leading-relaxed text-ink-muted">
          This cannot be undone. Nothing has been charged, and the pieces go
          back into stock — if you change your mind you will need to order them
          again at the price showing then.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="min-h-11 flex-1 rounded-sm bg-destructive px-5 text-sm font-medium text-canvas disabled:cursor-wait"
          >
            {isBusy ? "Cancelling…" : "Yes, cancel it"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            autoFocus
            className="min-h-11 flex-1 rounded-sm border border-border-interactive px-5 text-sm transition-colors duration-fast hover:border-ink"
          >
            Keep my order
          </button>
        </div>
      </div>
    </div>
  );
}
