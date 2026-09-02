import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/listing/Breadcrumbs";
import { loadPage, loadStore } from "@/lib/contentSource";
import { Prose } from "@/components/content/Prose";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Call, email or visit a Nivisa showroom. Monday to Saturday, 9am–7pm.",
  alternates: { canonical: "/contact" },
};

/**
 * Contact.
 *
 * A phone number first, and it is a real link. Someone on a contact page has a
 * problem and wants a person — a form that promises a reply "within 48 hours"
 * is what a company builds to avoid being called.
 *
 * There is no contact-form endpoint on the backend, and rather than a form
 * that posts nowhere, this page routes people to channels that work.
 *
 * The number and address come from the shop's own settings, so changing them
 * is a dashboard edit rather than a release. Nothing is invented if the fetch
 * fails: a missing number renders as absent, because a made-up one is a
 * customer calling nobody.
 */
export default async function ContactPage() {
  const [store, page] = await Promise.all([loadStore(), loadPage("contact")]);

  const phones = store?.phone ? [store.phone] : [];
  const emails = store?.email ? [store.email] : [];

  return (
    <div className="container-page py-8 lg:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="text-3xl lg:text-4xl">Talk to us</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          A real person answers, and they can see your order. If it is about a
          delivery, have your order number ready.
        </p>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div className="space-y-8">
          <section>
            <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Call
            </h2>
            <ul className="mt-3 space-y-1">
              {phones.map((phone) => (
                <li key={phone}>
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                    className="flex min-h-11 items-center text-lg tabular text-accent underline-offset-4 hover:underline"
                  >
                    {phone}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-sm text-ink-muted">
              Monday to Saturday, 9am–7pm.
            </p>
          </section>

          <section>
            <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Email
            </h2>
            <ul className="mt-3 space-y-1">
              {emails.map((email) => (
                <li key={email}>
                  <a
                    href={`mailto:${email}`}
                    className="flex min-h-11 items-center text-accent underline-offset-4 hover:underline"
                  >
                    {email}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              About an order
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Your order page shows its current status and tracking without
              needing to call.
            </p>
            <Link
              href="/orders"
              className="mt-3 inline-flex min-h-11 items-center rounded-sm border border-border-interactive px-5 text-sm transition-colors duration-fast hover:border-ink"
            >
              View your orders
            </Link>
          </section>
        </div>

        <div className="space-y-10">
          {store?.address ? (
            <section>
              <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                Visit
              </h2>
              <address className="mt-4 rounded-sm border border-border bg-surface p-5 text-sm not-italic leading-relaxed text-ink-muted">
                {store.address}
              </address>
            </section>
          ) : null}

          {/* Whatever staff have written on the Contact page in the dashboard.
              Absent, the section does not render — an empty heading is worse
              than no heading. */}
          {page?.html.trim() ? (
            <section>
              <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                More
              </h2>
              <div className="mt-4">
                <Prose html={page.html} />
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
