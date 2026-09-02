"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { orderSource, startPayment } from "@/lib/orderSource";
import { customerSource } from "@/lib/customerSource";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { cn, formatMoney } from "@/lib/utils";
import { ApiError } from "@/api/client";
import { OtpForm } from "@/components/auth/OtpForm";
import { AddressForm, type AddressFormValues } from "@/components/checkout/AddressForm";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { ProductImage } from "@/components/commerce/ProductImage";
import { PaymentReturn } from "@/components/checkout/PaymentReturn";

/**
 * Checkout.
 *
 * A single page with sequential sections rather than separate routes. Each
 * completed step collapses to a summary line with an Edit link, so the
 * customer can always see what they have already decided without leaving the
 * page — and a mistyped address is one click to fix rather than a back-button
 * gamble against a form that may not have kept its values.
 *
 * Three steps, because three is what the backend actually needs: who you are,
 * where it goes, and payment. A separate "review" step would be a page whose
 * only content is a summary that is already visible in the sidebar.
 */

type Step = "identify" | "address" | "pay";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [address, setAddress] = useState<AddressFormValues | null>(null);

  // Priced against the address the customer entered, so the total on the pay
  // button is the total the order will be created with. Priced without one,
  // the cart falls back to the "rest of India" zone, and a Bengaluru customer
  // is quoted a delivery fee they will not be charged - which is the harmless
  // direction of a discrepancy that can just as easily run the other way.
  const { cart, isLoading } = useCart(address?.pincode);
  const { isAuthenticated, customer } = useAuth();

  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The gateway returns the browser here with only the order number. That
  // return is a different page state entirely, so it is handled before any of
  // the checkout steps render — and the outcome is discovered by reading the
  // order, never from the URL.
  const returningOrderNumber =
    searchParams.get("order") ?? searchParams.get("orderNumber");
  if (returningOrderNumber) {
    return <PaymentReturn orderNumber={returningOrderNumber} />;
  }

  const step: Step = !isAuthenticated
    ? "identify"
    : address === null
      ? "address"
      : "pay";

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <div className="skeleton h-8 w-48 rounded-xs" aria-hidden="true" />
        <div className="skeleton mt-8 h-96 rounded-sm" aria-hidden="true" />
        <span className="sr-only" role="status">
          Loading checkout
        </span>
      </div>
    );
  }

  // An empty cart at checkout is a dead end, not an error — most often it
  // means the order was already placed in another tab.
  if (cart.lines.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl">There is nothing to check out</h1>
        <p className="mx-auto mt-4 max-w-md text-ink-muted">
          Your cart is empty. If you have just placed an order, you will find it
          under your orders.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/shop"
            className="inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
          >
            Continue shopping
          </Link>
          <Link
            href="/orders"
            className="inline-flex min-h-12 items-center rounded-sm border border-border-interactive px-7 text-sm font-medium transition-colors duration-fast hover:border-ink"
          >
            View orders
          </Link>
        </div>
      </div>
    );
  }

  async function placeOrder() {
    if (!address) return;
    setError(null);
    setIsPlacing(true);

    try {
      // The address is saved before the order is placed, because an order
      // references a saved address rather than carrying a copy of a form.
      // That is the better outcome anyway: it ends up in the customer's
      // address book instead of vanishing into one order's payload.
      const saved = await customerSource.createAddress("shipping", {
        recipientName: address.recipientName,
        phone: address.phone,
        line1: address.line1,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        isDefault: true,
      });

      // The coupon is already on the server-side cart, so it is not resent:
      // the order is priced from the cart, and passing it twice would be two
      // places that could disagree about which code applied.
      const order = await orderSource.place({
        shippingAddressId: String(saved.id),
      });

      if (IS_DEMO_CONTENT) {
        // No gateway in demo mode; the order is already marked paid.
        router.push(`/order/${order.orderNumber}`);
        return;
      }

      // Hands the browser to the payment gateway. Nothing after this runs.
      await startPayment(order.orderNumber);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "We could not place your order. Please try again.",
      );
      setIsPlacing(false);
    }
  }

  return (
    <div className="container-page py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl">Checkout</h1>

      <div className="mt-8 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-12 xl:gap-16">
        <div className="space-y-4">
          {/* ------------------------------------------------ 1. Identify */}
          <StepCard
            index={1}
            title="Your details"
            isActive={step === "identify"}
            isDone={isAuthenticated}
            summary={customer ? `+91 ${customer.phone}` : undefined}
          >
            {step === "identify" ? (
              <>
                <p className="mb-5 text-sm text-ink-muted">
                  We need a number to send delivery updates to. No password.
                </p>
                <OtpForm onSuccess={() => undefined} />
              </>
            ) : null}
          </StepCard>

          {/* ------------------------------------------------- 2. Address */}
          <StepCard
            index={2}
            title="Delivery address"
            isActive={step === "address"}
            isDone={address !== null}
            summary={
              address
                ? `${address.recipientName}, ${address.line1}, ${address.city} ${address.pincode}`
                : undefined
            }
            onEdit={address ? () => setAddress(null) : undefined}
          >
            {step === "address" ? (
              <AddressForm
                initialValues={{ phone: customer?.phone ?? "" }}
                onSubmit={setAddress}
              />
            ) : null}
          </StepCard>

          {/* ----------------------------------------------------- 3. Pay */}
          <StepCard
            index={3}
            title="Payment"
            isActive={step === "pay"}
            isDone={false}
          >
            {step === "pay" ? (
              <>
                {IS_DEMO_CONTENT ? (
                  <p className="mb-5 rounded-sm bg-warning-soft px-4 py-3 text-sm text-warning">
                    Demo mode — no payment is taken and no card details are
                    collected. Placing the order records it locally so you can
                    see the confirmation.
                  </p>
                ) : (
                  <p className="mb-5 text-sm text-ink-muted">
                    You will be taken to our payment partner to pay by UPI, card or net
                    banking, then returned here. We never see or store your
                    card details.
                  </p>
                )}

                {error ? (
                  <p
                    role="alert"
                    className="mb-5 rounded-sm bg-destructive-soft px-4 py-3 text-sm text-destructive"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={isPlacing}
                  className="flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-6 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover disabled:cursor-wait sm:w-auto sm:min-w-64"
                >
                  {isPlacing
                    ? "Placing your order…"
                    : `Pay ${formatMoney(cart.total)}`}
                </button>

                <p className="mt-4 text-xs text-ink-muted">
                  By placing this order you agree to our{" "}
                  <Link
                    href="/pages/terms-of-use"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    terms
                  </Link>
                  .
                </p>
              </>
            ) : null}
          </StepCard>
        </div>

        {/* ------------------------------------------------------ Summary */}
        <aside className="mt-10 lg:sticky lg:top-8 lg:mt-0">
          <div className="rounded-sm border border-border bg-surface p-6">
            <h2 className="font-sans text-lg font-medium tracking-normal">
              Your order
            </h2>

            <ul className="mt-5 space-y-4 border-b border-border pb-5">
              {cart.lines.map((line) => (
                <li key={line.id} className="flex gap-3">
                  <div className="w-14 shrink-0">
                    <ProductImage
                      src={line.imageUrl}
                      alt=""
                      aspect="aspect-4/3"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{line.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted tabular">
                      Qty {line.quantity}
                    </p>
                  </div>
                  <p data-price className="shrink-0 text-sm">
                    {formatMoney(line.lineTotal)}
                  </p>
                </li>
              ))}
            </ul>

            <OrderSummary cart={cart} className="mt-5" />
          </div>

          <ul className="mt-6 space-y-2.5 text-xs text-ink-muted">
            <Reassurance>Delivered and assembled by our own team</Reassurance>
            <Reassurance>Seven-day returns, no questions asked</Reassurance>
            <Reassurance>Ten-year structural warranty</Reassurance>
          </ul>
        </aside>
      </div>
    </div>
  );
}

function StepCard({
  index,
  title,
  isActive,
  isDone,
  summary,
  onEdit,
  children,
}: {
  index: number;
  title: string;
  isActive: boolean;
  isDone: boolean;
  summary?: string;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-sm border bg-surface transition-colors duration-fast",
        isActive ? "border-ink" : "border-border",
      )}
      aria-current={isActive ? "step" : undefined}
    >
      <div className="flex items-center gap-3 px-6 py-5">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular",
            isDone
              ? "bg-success text-on-secondary"
              : isActive
                ? "bg-primary text-on-primary"
                : "bg-surface-sunken text-ink-subtle",
          )}
        >
          {isDone ? "✓" : index}
        </span>

        <h2 className="flex-1 font-sans text-base font-medium tracking-normal">
          {title}
        </h2>

        {onEdit && !isActive ? (
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 text-sm text-accent underline-offset-4 hover:underline"
          >
            Edit
          </button>
        ) : null}
      </div>

      {summary && !isActive ? (
        <p className="border-t border-border px-6 py-4 text-sm text-ink-muted">
          {summary}
        </p>
      ) : null}

      {isActive && children ? (
        <div className="border-t border-border px-6 py-6">{children}</div>
      ) : null}
    </section>
  );
}

function Reassurance({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-4 w-4 shrink-0 text-success"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12.5l5 5L20 7" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="container-page py-20" />}>
      <CheckoutContent />
    </Suspense>
  );
}
