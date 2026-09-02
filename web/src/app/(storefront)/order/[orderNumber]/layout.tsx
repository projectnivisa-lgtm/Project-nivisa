import type { Metadata } from "next";

/** Orders are private: never indexed, never followed. */
export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
