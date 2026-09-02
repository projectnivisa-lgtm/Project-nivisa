import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { env } from "@/config/env";
import { Providers } from "./providers";
import "@/styles/globals.css";

/**
 * Fraunces carries the display voice.
 *
 * `opsz` only. It is the one axis that does anything here: browsers apply
 * optical sizing automatically, so headings get the heavier-cut drawing at
 * large sizes without a line of CSS.
 *
 * `SOFT` and `WONK` used to be requested too, and nothing ever varied them -
 * no rule in the stylesheet sets `font-variation-settings`, so both shipped
 * at their default value and rendered exactly as they do now. They were 40%
 * of the largest font file on the site, spent on nothing. Reinstate them
 * alongside a rule that actually moves them, or not at all.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  // No `weight` list: Fraunces is variable, so the full wght range ships.
  // Listing weights would pin it to statics.
  axes: ["opsz"],
});

/** Instrument Sans handles all UI, forms, prices and tables. */
const instrument = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Nivisa — Furniture for the way you live",
    template: "%s · Nivisa",
  },
  description:
    "Considered furniture and home pieces for Indian homes. Made to last, priced to live with, delivered and installed.",
  // One source of truth with canonicals and structured data.
  metadataBase: new URL(env.siteUrl),
  openGraph: {
    type: "website",
    siteName: "Nivisa",
    locale: "en_IN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${instrument.variable}`}>
      <body>
        {/* Keyboard users land here first; it is the only way past a mega-menu
            without tabbing through every category link. */}
        <a href="#main" className="sr-focusable">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
