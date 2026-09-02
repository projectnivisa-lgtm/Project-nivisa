import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/**
 * The living design-system reference.
 *
 * This page renders from the same tokens the product uses, so it cannot drift
 * from reality: change a token and this page changes with it. It exists to
 * settle arguments about "which grey" before a component is written.
 */

const NEUTRALS = [
  ["lime-50", "#FDFBF7"],
  ["lime-100", "#FBF8F3"],
  ["lime-200", "#F4EFE6"],
  ["lime-300", "#E9E1D3"],
  ["lime-400", "#D8CCB8"],
  ["lime-500", "#B9AA92"],
  ["lime-600", "#8C7F6C"],
  ["lime-700", "#5F574E"],
  ["lime-800", "#3A342E"],
  ["lime-900", "#1F1B17"],
  ["lime-950", "#14110E"],
] as const;

const SEMANTIC = [
  ["primary", "#14110E", "Buttons, the one loud action per screen"],
  ["accent", "#B2503A", "Brand voice — links, badges, editorial rules"],
  ["secondary", "#2F5D4F", "Trust, availability, delivery promises"],
  ["sale", "#9E2B25", "Reduced prices and discount percentages only"],
  ["warning", "#8A6116", "Low stock, pending payment"],
  ["destructive", "#B42318", "Cancel, remove, delete"],
] as const;

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-14">
      <h2 className="text-2xl">{title}</h2>
      {note ? (
        <p className="mt-2 max-w-prose text-ink-muted">{note}</p>
      ) : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main id="main" className="container-page py-16">
      <header className="pb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-subtle">
          Nivisa
        </p>
        <h1 className="mt-4 text-4xl">Design system</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-muted">
          Warm contemporary interiors. An ivory ground, ink type and a rationed
          terracotta accent. Every value below is a token — components never
          write a hex.
        </p>
      </header>

      <Section
        title="Neutrals"
        note="One warm ramp does all the work. There is no blue-grey anywhere in this product: a cool grey next to ivory reads as a rendering bug."
      >
        <div className="flex flex-wrap gap-3">
          {NEUTRALS.map(([name, hex]) => (
            <div key={name} className="w-28">
              <div
                className="h-16 rounded-xs border border-border"
                style={{ backgroundColor: hex }}
              />
              <p className="mt-2 text-xs">{name}</p>
              <p className="text-2xs text-ink-subtle tabular">{hex}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Semantic colour"
        note="Primary is ink, not the accent. Near-black buttons read as premium retail; a terracotta button on every card reads as a discount store."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SEMANTIC.map(([name, hex, use]) => (
            <li
              key={name}
              className="flex gap-4 rounded-sm border border-border bg-surface p-4"
            >
              <span
                className="mt-1 h-10 w-10 shrink-0 rounded-xs"
                style={{ backgroundColor: hex }}
              />
              <span>
                <span className="block text-sm font-medium">{name}</span>
                <span className="block text-2xs text-ink-subtle tabular">
                  {hex}
                </span>
                <span className="mt-1 block text-xs text-ink-muted">
                  {use}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Typography"
        note="Fraunces for display, Instrument Sans for everything a customer has to read carefully. Body never drops below 15px; prices always use tabular figures."
      >
        <div className="space-y-6">
          <p className="text-6xl">Make room</p>
          <p className="text-4xl">Thoughtful pieces, built to last</p>
          <p className="text-2xl">Shop by room</p>
          <p className="max-w-prose text-base text-ink-muted">
            Solid sheesham frame with a hand-rubbed oil finish. Seats three
            comfortably, and the cushions are reversible so they wear evenly
            over the years you will own it.
          </p>
          <p className="flex items-baseline gap-3">
            <span data-price className="text-2xl font-semibold">
              ₹42,999
            </span>
            <span
              data-price
              className="text-base text-ink-subtle line-through"
            >
              ₹56,000
            </span>
            <span className="rounded-xs bg-sale-soft px-2 py-0.5 text-xs font-medium text-sale">
              23% off
            </span>
          </p>
        </div>
      </Section>

      <Section
        title="Controls"
        note="Every interactive target is at least 44×44px. Control outlines use border-interactive (3.7:1), not the decorative border token, and focus is a terracotta ring that is never removed."
      >
        <div className="flex flex-wrap items-center gap-4">
          <button className="min-h-11 rounded-sm bg-primary px-6 text-on-primary transition-colors duration-fast hover:bg-primary-hover">
            Add to cart
          </button>
          <button className="min-h-11 rounded-sm border border-border-interactive bg-surface px-6 transition-colors duration-fast hover:border-ink">
            Buy now
          </button>
          <button className="min-h-11 rounded-sm px-6 text-accent underline-offset-4 transition-colors duration-fast hover:underline">
            View in your room
          </button>
          <span className="inline-flex items-center gap-2 rounded-xs bg-success-soft px-3 py-1.5 text-xs text-success">
            {/* Status is never carried by colour alone — the word does the work. */}
            In stock · delivered in 5 days
          </span>
        </div>
      </Section>

      <Section
        title="Loading"
        note="Skeletons hold the exact dimensions of the content they replace, so nothing shifts when the data lands."
      >
        <div className="grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="skeleton aspect-4/3 rounded-xs" />
              <div className="skeleton mt-3 h-4 w-3/4 rounded-xs" />
              <div className="skeleton mt-2 h-4 w-1/3 rounded-xs" />
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
