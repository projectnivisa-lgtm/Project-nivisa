import type { Metadata } from "next";

/**
 * The cart page is a client component, which cannot export metadata — so the
 * title lives in a thin layout instead. Without it every one of these pages
 * inherits the site default, and a browser history full of identical
 * "Nivisa — Furniture for the way you live" entries is unnavigable.
 */
export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: true },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
