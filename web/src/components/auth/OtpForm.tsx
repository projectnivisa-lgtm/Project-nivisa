"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/api/client";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { cn } from "@/lib/utils";

/**
 * OTP sign-in.
 *
 * Two steps in one component, because they are one task. The phone number
 * stays visible at the code step with an "change" affordance — mistyping the
 * last digit and being unable to see what you typed is the most common way
 * this flow fails.
 *
 * The resend timer starts immediately rather than offering resend up front:
 * an instantly-available resend button gets pressed before the first SMS
 * arrives, and the second code invalidates the first.
 */
const RESEND_SECONDS = 30;

export function OtpForm({ onSuccess }: { onSuccess: () => void }) {
  const { requestOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  const isPhoneValid = /^[6-9]\d{9}$/.test(phone);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  function describe(cause: unknown): string {
    if (cause instanceof ApiError || cause instanceof Error) return cause.message;
    return "Something went wrong. Please try again.";
  }

  async function sendCode() {
    setError(null);
    setIsBusy(true);
    try {
      await requestOtp(phone);
      setStep("code");
      setSecondsLeft(RESEND_SECONDS);
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setIsBusy(false);
    }
  }

  async function submitCode() {
    setError(null);
    setIsBusy(true);
    try {
      await verifyOtp(phone, otp);
      onSuccess();
    } catch (cause) {
      setError(describe(cause));
      setOtp("");
      codeInput.current?.focus();
    } finally {
      setIsBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isPhoneValid) void sendCode();
        }}
      >
        <label htmlFor="phone" className="block text-sm font-medium">
          Mobile number
        </label>
        <div className="mt-2 flex items-stretch rounded-sm border border-border-interactive focus-within:border-accent">
          <span
            aria-hidden="true"
            className="flex items-center border-r border-border px-3 text-sm text-ink-muted tabular"
          >
            +91
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            value={phone}
            onChange={(event) =>
              setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
            }
            aria-describedby="phone-help"
            aria-invalid={error ? true : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base tabular outline-none"
          />
        </div>
        <p id="phone-help" className="mt-2 text-xs text-ink-muted">
          We will text you a 6-digit code. No password to remember.
        </p>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!isPhoneValid || isBusy}
          className={cn(
            "mt-6 flex min-h-12 w-full items-center justify-center rounded-sm text-sm font-medium transition-colors duration-fast",
            isPhoneValid
              ? "bg-primary text-on-primary hover:bg-primary-hover"
              : "cursor-not-allowed bg-surface-sunken text-ink-subtle",
          )}
        >
          {isBusy ? "Sending…" : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (otp.length === 6) void submitCode();
      }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor="otp" className="block text-sm font-medium">
          Enter the code
        </label>
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setOtp("");
            setError(null);
          }}
          className="min-h-11 text-xs text-accent underline-offset-4 hover:underline"
        >
          Change number
        </button>
      </div>

      <p className="mt-1 text-xs text-ink-muted tabular">Sent to +91 {phone}</p>

      <input
        ref={codeInput}
        id="otp"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={otp}
        onChange={(event) =>
          setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        aria-invalid={error ? true : undefined}
        className="mt-3 h-12 w-full rounded-sm border border-border-interactive bg-canvas px-3 text-center text-xl tracking-[0.4em] tabular focus:border-accent"
      />

      {IS_DEMO_CONTENT ? (
        <p className="mt-2 text-2xs text-warning">
          Demo mode — no SMS is sent. Any 6 digits will sign you in.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={otp.length !== 6 || isBusy}
        className={cn(
          "mt-6 flex min-h-12 w-full items-center justify-center rounded-sm text-sm font-medium transition-colors duration-fast",
          otp.length === 6
            ? "bg-primary text-on-primary hover:bg-primary-hover"
            : "cursor-not-allowed bg-surface-sunken text-ink-subtle",
        )}
      >
        {isBusy ? "Verifying…" : "Verify and continue"}
      </button>

      <div className="mt-4 text-center">
        {secondsLeft > 0 ? (
          <p className="text-xs text-ink-muted tabular">
            Resend in {secondsLeft}s
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={isBusy}
            className="min-h-11 text-xs text-accent underline-offset-4 hover:underline"
          >
            Resend code
          </button>
        )}
      </div>
    </form>
  );
}
