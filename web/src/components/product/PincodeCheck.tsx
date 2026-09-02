"use client";

import { useState } from "react";
import { catalogApi } from "@/api/catalog";
import { cn, formatMoney } from "@/lib/utils";

/**
 * Delivery pincode check.
 *
 * The API answers this from the shipping zones staff maintain, so what is
 * quoted here is the rule that will price the order at checkout — the estimate
 * cannot disagree with the bill.
 *
 * Two things it deliberately does not do. It does not name the city: no PIN
 * database backs this, and a wrong city under a customer's address is worse
 * than none. And a lookup failure is reported as "we could not confirm", never
 * as "we do not deliver there" — the difference between an API hiccup and a
 * lost order.
 */
export function PincodeCheck() {
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | {
        kind: "found";
        zone: string | null;
        fee: number | null;
        freeAbove: number | null;
        daysMin: number | null;
        daysMax: number | null;
      }
    | { kind: "unknown" }
  >({ kind: "idle" });

  const isValid = /^\d{6}$/.test(pincode);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;
    setState({ kind: "checking" });
    const result = await catalogApi.lookupPincode(pincode);
    setState(
      result?.serviceable
        ? {
            kind: "found",
            zone: result.zone,
            fee: result.shippingFee,
            freeAbove: result.freeAbove,
            daysMin: result.estimatedDaysMin,
            daysMax: result.estimatedDaysMax,
          }
        : { kind: "unknown" },
    );
  }

  return (
    <div className="rounded-sm border border-border bg-surface p-4">
      <form onSubmit={check}>
        <label htmlFor="pincode" className="block text-sm font-medium">
          Check delivery
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="pincode"
            name="pincode"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={pincode}
            onChange={(event) => {
              setPincode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setState({ kind: "idle" });
            }}
            placeholder="6-digit pincode"
            aria-describedby="pincode-result"
            className="h-11 min-w-0 flex-1 rounded-sm border border-border-interactive bg-canvas px-3 text-sm tabular focus:border-accent"
          />
          <button
            type="submit"
            disabled={!isValid || state.kind === "checking"}
            className={cn(
              "h-11 shrink-0 rounded-sm px-5 text-sm font-medium transition-colors duration-fast",
              isValid
                ? "bg-primary text-on-primary hover:bg-primary-hover"
                : "cursor-not-allowed bg-surface-sunken text-ink-subtle",
            )}
          >
            {state.kind === "checking" ? "Checking…" : "Check"}
          </button>
        </div>
      </form>

      <div id="pincode-result" role="status" className="mt-2.5 text-xs">
        {state.kind === "found" ? (
          <p className="text-success">
            Yes, we deliver to {pincode}
            {state.daysMin && state.daysMax ? (
              <>
                {" "}
                in <span className="font-medium">
                  {state.daysMin}–{state.daysMax} days
                </span>
              </>
            ) : null}
            .{" "}
            {/* The fee is quoted only when there is one. "Delivery ₹0" is a
                line that makes a reader stop and check rather than relax. */}
            {state.fee !== null && state.fee > 0 ? (
              <>
                Delivery {formatMoney({ amount: state.fee, currency: "INR" })}
                {state.freeAbove
                  ? `, free above ${formatMoney({ amount: state.freeAbove, currency: "INR" })}`
                  : ""}
                .
              </>
            ) : (
              <>Delivery and assembly are included.</>
            )}
          </p>
        ) : state.kind === "unknown" ? (
          <p className="text-ink-muted">
            We could not confirm that pincode automatically. You can still order
            — enter your address at checkout and we will call to arrange
            delivery.
          </p>
        ) : (
          <p className="text-ink-muted">
            Enter your pincode for a delivery estimate.
          </p>
        )}
      </div>
    </div>
  );
}
