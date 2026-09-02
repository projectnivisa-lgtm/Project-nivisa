"use client";

import { useEffect, useRef, useState } from "react";
import { catalogApi } from "@/api/catalog";
import { cn } from "@/lib/utils";
import type { OrderAddress } from "@/types/order";

/**
 * Delivery address.
 *
 * Field order follows how an Indian address is written and how people recall
 * it: who and how to reach them, then pincode, then the locality the pincode
 * fills in, then the street detail. Putting pincode above city means one
 * lookup can fill two fields the customer would otherwise type.
 *
 * The pincode lookup NEVER blocks. It fills city and state when it can, and
 * when it cannot the fields stay editable and the form stays submittable —
 * the API contract is explicit that clients must not gate on it, and a
 * checkout that refuses to proceed because a lookup service hiccuped is a
 * lost order.
 */

export interface AddressFormValues extends OrderAddress {
  landmark: string;
}

const EMPTY: AddressFormValues = {
  recipientName: "",
  phone: "",
  line1: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

type Errors = Partial<Record<keyof AddressFormValues, string>>;

/**
 * The order the summary lists problems in. Deliberately not `Object.keys` of
 * the errors, which follows `validate`'s order — a summary that lists the
 * street before the pincode sends people up and down the form.
 */
const FIELD_ORDER: (keyof AddressFormValues)[] = [
  "recipientName",
  "phone",
  "pincode",
  "city",
  "state",
  "line1",
];

function validate(values: AddressFormValues): Errors {
  const errors: Errors = {};
  if (!values.recipientName.trim()) errors.recipientName = "Enter a name.";
  if (!/^[6-9]\d{9}$/.test(values.phone))
    errors.phone = "Enter a 10-digit mobile number.";
  if (values.line1.trim().length < 8)
    errors.line1 = "Enter the flat, building and street.";
  if (!/^\d{6}$/.test(values.pincode)) errors.pincode = "Enter a 6-digit pincode.";
  if (!values.city.trim()) errors.city = "Enter a city.";
  if (!values.state.trim()) errors.state = "Enter a state.";
  return errors;
}

export function AddressForm({
  initialValues,
  onSubmit,
  isBusy,
  submitLabel = "Continue to payment",
}: {
  initialValues?: Partial<AddressFormValues>;
  onSubmit: (values: AddressFormValues) => void;
  isBusy?: boolean;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<AddressFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});
  const [lookup, setLookup] = useState<"idle" | "checking" | "filled" | "miss">(
    "idle",
  );

  // A failed submit has to *announce* itself. Without moving focus, the errors
  // appear above a submit button that still holds focus, so a screen reader
  // user is told nothing at all and a magnified viewport shows no change.
  // The counter (rather than a boolean) re-fires focus on every failed
  // attempt, including the second one in a row.
  const summary = useRef<HTMLDivElement>(null);
  const [failures, setFailures] = useState(0);

  useEffect(() => {
    if (failures > 0) summary.current?.focus();
  }, [failures]);

  function set<K extends keyof AddressFormValues>(
    key: K,
    value: AddressFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear the error as soon as the field is being corrected — leaving it
    // under a field the customer is actively fixing is just nagging.
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onPincodeSettled(pincode: string) {
    if (!/^\d{6}$/.test(pincode)) return;
    setLookup("checking");
    const result = await catalogApi.lookupPincode(pincode);
    if (result && (result.city || result.state)) {
      setValues((current) => ({
        ...current,
        city: result.city ?? current.city,
        state: result.state ?? current.state,
      }));
      setLookup("filled");
    } else {
      setLookup("miss");
    }
  }

  const listed = FIELD_ORDER.filter((key) => errors[key]);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const found = validate(values);
        setErrors(found);
        setTouched(
          Object.fromEntries(Object.keys(values).map((k) => [k, true])),
        );
        if (Object.keys(found).length === 0) onSubmit(values);
        else setFailures((count) => count + 1);
      }}
      className="space-y-5"
    >
      {/* Complements the inline errors, never replaces them: each item links
          to the field it belongs to, so the fix is one tap away on a phone
          where the offending field may be off screen.

          The title is a paragraph, not a heading. Headings here would inject
          themselves into the page outline — and would do it only on failure,
          so the outline would change shape between submits. `aria-labelledby`
          names the region without that cost, the same trade the mega-menu
          group labels make. */}
      {listed.length > 0 ? (
        <div
          ref={summary}
          role="alert"
          tabIndex={-1}
          aria-labelledby="address-problems"
          className="rounded-sm border border-destructive bg-destructive-soft p-4"
        >
          <p id="address-problems" className="text-sm font-medium text-destructive">
            {listed.length === 1
              ? "There is a problem with this address"
              : `There are ${listed.length} problems with this address`}
          </p>
          <ul className="mt-2 space-y-1">
            {listed.map((key) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  className="text-xs text-destructive underline underline-offset-2"
                >
                  {errors[key]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="recipientName"
          label="Full name"
          autoComplete="name"
          value={values.recipientName}
          error={touched.recipientName ? errors.recipientName : undefined}
          onChange={(v) => set("recipientName", v)}
          onBlur={() => setTouched((t) => ({ ...t, recipientName: true }))}
        />

        <Field
          id="phone"
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          prefix="+91"
          value={values.phone}
          error={touched.phone ? errors.phone : undefined}
          onChange={(v) => set("phone", v.replace(/\D/g, "").slice(0, 10))}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          help="For delivery updates and the driver's call."
        />
      </div>

      <Field
        id="pincode"
        label="Pincode"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={6}
        value={values.pincode}
        error={touched.pincode ? errors.pincode : undefined}
        onChange={(v) => {
          const next = v.replace(/\D/g, "").slice(0, 6);
          set("pincode", next);
          setLookup("idle");
          if (next.length === 6) void onPincodeSettled(next);
        }}
        onBlur={() => {
          setTouched((t) => ({ ...t, pincode: true }));
          void onPincodeSettled(values.pincode);
        }}
        help={
          lookup === "checking"
            ? "Looking up your area…"
            : lookup === "filled"
              ? "City and state filled in — correct them if they are wrong."
              : lookup === "miss"
                ? "We could not look that up. Enter your city and state below."
                : undefined
        }
        className="sm:max-w-48"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="city"
          label="City"
          autoComplete="address-level2"
          value={values.city}
          error={touched.city ? errors.city : undefined}
          onChange={(v) => set("city", v)}
          onBlur={() => setTouched((t) => ({ ...t, city: true }))}
        />
        <Field
          id="state"
          label="State"
          autoComplete="address-level1"
          value={values.state}
          error={touched.state ? errors.state : undefined}
          onChange={(v) => set("state", v)}
          onBlur={() => setTouched((t) => ({ ...t, state: true }))}
        />
      </div>

      <Field
        id="line1"
        label="Flat, building, street"
        autoComplete="address-line1"
        multiline
        value={values.line1}
        error={touched.line1 ? errors.line1 : undefined}
        onChange={(v) => set("line1", v)}
        onBlur={() => setTouched((t) => ({ ...t, line1: true }))}
      />

      <Field
        id="landmark"
        label="Landmark"
        optional
        autoComplete="address-line2"
        value={values.landmark}
        onChange={(v) => set("landmark", v)}
        help="Furniture deliveries arrive by truck — a landmark genuinely helps."
      />

      <button
        type="submit"
        disabled={isBusy}
        className="flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-6 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover sm:w-auto sm:min-w-64"
      >
        {isBusy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  help,
  optional,
  multiline,
  prefix,
  className,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  help?: string;
  optional?: boolean;
  multiline?: boolean;
  prefix?: string;
  className?: string;
  // `onChange` and `value` are ours, taking a plain string rather than an
  // event — omitted from the passthrough so the two definitions cannot
  // collide.
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  const describedBy = [error ? `${id}-error` : null, help ? `${id}-help` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {/* A real label, always visible. Placeholder-as-label disappears the
          moment someone starts typing, which is exactly when they need it. */}
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {optional ? (
          <span className="ml-1.5 font-normal text-ink-subtle">(optional)</span>
        ) : null}
      </label>

      <div
        className={cn(
          "mt-2 flex items-stretch rounded-sm border bg-canvas focus-within:border-accent",
          error ? "border-destructive" : "border-border-interactive",
        )}
      >
        {prefix ? (
          <span
            aria-hidden="true"
            className="flex items-center border-r border-border px-3 text-sm text-ink-muted tabular"
          >
            {prefix}
          </span>
        ) : null}

        {multiline ? (
          <textarea
            id={id}
            rows={2}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            className="min-h-12 w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none"
          />
        ) : (
          <input
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            {...input}
          />
        )}
      </div>

      {/* Errors sit beside the field they belong to. Deliberately NOT a live
          region: the summary at the top of the form is the one announcement,
          and six simultaneous `role="alert"` messages would talk over it and
          over each other. This text is still reached programmatically — it is
          in the field's `aria-describedby`, so it is read the moment focus
          arrives from the summary link. */}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="mt-1.5 text-xs text-ink-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
