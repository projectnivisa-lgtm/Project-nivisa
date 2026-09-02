import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/listing/Breadcrumbs";
import { loadOptionalPage } from "@/lib/contentSource";
import { Prose } from "@/components/content/Prose";

export const metadata: Metadata = {
  title: "About Nivisa",
  description:
    "We make furniture measured for real Indian rooms, named material by material, and delivered assembled by people we employ.",
  alternates: { canonical: "/about" },
};

/**
 * About.
 *
 * The body is whatever staff have written on the About page in the dashboard.
 * The old backend had a bespoke "about" table shaped like a publisher's — it
 * counted titles published — and this page had to pick the few fields that
 * meant anything. An editable page says more, and says it in the shop's own
 * words rather than in a schema's.
 */
export default async function AboutPage() {
  const about = await loadOptionalPage("about-us");

  return (
    <div className="container-page py-8 lg:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />

      <header className="mt-6 max-w-3xl">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">
          About us
        </p>
        <h1 className="mt-3 text-3xl lg:text-5xl">
          Furniture measured for the rooms people actually have.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-muted">
          Measured for real rooms, named material by material, and delivered
          assembled by people we employ.
        </p>
      </header>

      {about?.html.trim() ? (
        <div className="mt-14">
          <Prose html={about.html} />
        </div>
      ) : null}

      <div className="mt-16 flex flex-wrap gap-3 border-t border-border pt-10">
        <Link
          href="/shop"
          className="inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Shop all furniture
        </Link>
        <Link
          href="/contact"
          className="inline-flex min-h-12 items-center rounded-sm border border-border-interactive px-7 text-sm font-medium transition-colors duration-fast hover:border-ink"
        >
          Talk to us
        </Link>
      </div>
    </div>
  );
}
