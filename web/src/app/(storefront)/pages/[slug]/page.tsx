import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/listing/Breadcrumbs";
import { Prose } from "@/components/content/Prose";
import { loadPage } from "@/lib/contentSource";

/**
 * Policy and information pages.
 *
 * One route over `/catalog/pages/{slug}` rather than a file per policy: these
 * are operator-editable content, and hardcoding a route per page would mean a
 * deploy every time someone adds a returns policy.
 *
 * No `loading.tsx` in this segment — a Suspense boundary flushes 200 headers
 * before `notFound()` can throw, turning an unknown slug into a soft 404. See
 * category/[slug]/README-no-loading.md.
 */

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: { canonical: `/pages/${slug}` },
  };
}

export default async function ContentPageRoute({ params }: RouteProps) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  return (
    <div className="container-page py-8 lg:py-14">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: page.title }]}
      />

      <h1 className="mt-6 max-w-(--container-prose) text-3xl lg:text-4xl">
        {page.title}
      </h1>

      <div className="mt-10">
        <Prose html={page.html} />
      </div>

      <p className="mt-14 max-w-(--container-prose) border-t border-border pt-6 text-xs text-ink-muted">
        Questions about this? Call us on +91 80 2216 1900, Monday to Saturday,
        9am–7pm.
      </p>
    </div>
  );
}
