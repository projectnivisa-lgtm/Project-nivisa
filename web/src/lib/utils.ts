import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Money } from "@/types/product";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Indian rupee formatting with lakh/crore digit grouping (₹1,24,999).
 *
 * Furniture prices are whole rupees; paise on a ₹42,000 sofa is visual noise,
 * so fractions are dropped unless the amount genuinely has them.
 */
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

export function formatMoney(value: Money | number): string {
  const amount = typeof value === "number" ? value : value.amount;
  return Number.isInteger(amount) ? inr.format(amount) : inrWithPaise.format(amount);
}

/** "12 Aug 2026" — unambiguous for Indian readers, unlike 08/12/26. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Centimetres to a display string, e.g. "210 × 90 × 80 cm". */
export function formatDimensions(d: {
  widthCm?: number;
  depthCm?: number;
  heightCm?: number;
  raw?: string;
}): string | null {
  const parts = [d.widthCm, d.depthCm, d.heightCm].filter(
    (n): n is number => typeof n === "number" && n > 0,
  );
  if (parts.length >= 2) return `${parts.join(" × ")} cm`;
  return d.raw ?? null;
}
