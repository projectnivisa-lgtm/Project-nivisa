import { api } from "./client";
import type { ContentPage, StoreProfile } from "@/types/content";

/**
 * Editorial and policy content.
 *
 * Pages are HTML, sanitised by the API when they are *written* — a strict
 * tag/attribute allowlist, scripts and inline styles stripped, in
 * `app/admin/routes/content.py`. Sanitising on write rather than on read is
 * what makes this safe to render: the storefront, an email and a PDF all get
 * the same already-safe markup instead of each having to remember to escape
 * it, and there is no path by which unsanitised markup reaches the database.
 */

/** Live slugs, matching what the seeder creates. */
export const PAGE_SLUGS = {
  privacy: "privacy-policy",
  terms: "terms-of-use",
  shipping: "shipping-delivery",
  returns: "returns-refunds",
  warranty: "warranty",
  care: "care-guide",
  about: "about-us",
  contact: "contact",
} as const;

interface ApiPage {
  id: number;
  slug: string;
  title: string;
  body: string;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  updated_at: string;
}

/**
 * A plain-text excerpt, for a meta description.
 *
 * Tags are stripped rather than rendered, because a meta description is read
 * by a crawler as text — markup in it is noise that eats the character budget.
 */
function excerpt(html: string, length = 155): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export const contentApi = {
  /**
   * The shop's own contact details.
   *
   * Fetched rather than hardcoded, so changing the phone number is a dashboard
   * edit and not a release in two front ends.
   */
  async getStore(): Promise<StoreProfile> {
    const raw = await api.get<{
      name: string;
      email: string;
      phone: string;
      address: string | null;
      gstin: string | null;
      free_delivery_above: number | null;
      announcement: string | null;
    }>("/store", { auth: false, next: { revalidate: 600 } });

    return {
      name: raw.name,
      email: raw.email,
      phone: raw.phone,
      address: raw.address,
      gstin: raw.gstin,
      freeDeliveryAbove: raw.free_delivery_above,
      announcement: raw.announcement,
    };
  },

  async getPage(slug: string): Promise<ContentPage> {
    const raw = await api.get<ApiPage>(`/pages/${encodeURIComponent(slug)}`, {
      auth: false,
      // Policy pages change rarely and are read on every footer click.
      next: { revalidate: 300 },
    });

    return {
      slug: raw.slug,
      title: raw.title,
      html: raw.body ?? "",
      metaTitle: raw.meta_title ?? undefined,
      metaDescription: raw.meta_description ?? excerpt(raw.body ?? ""),
      updatedAt: raw.updated_at,
    };
  },
};
