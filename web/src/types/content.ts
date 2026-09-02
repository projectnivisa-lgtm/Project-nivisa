/**
 * Editorial and policy content.
 *
 * A page body is HTML, sanitised by the API when it is written: a strict
 * tag and attribute allowlist, scripts and inline styles stripped. Sanitising
 * on write is what makes it safe to render, and it means there is exactly one
 * place responsible for it rather than one per surface.
 *
 * The alternative — a structured JSON column typeset by the design system —
 * reads better in principle but cannot carry a table or a link list, which is
 * what a shipping policy and a warranty page actually need.
 */

export interface ContentPage {
  slug: string;
  title: string;
  /** Sanitised HTML. See the note above before rendering this anywhere new. */
  html: string;
  metaTitle?: string;
  metaDescription?: string;
  updatedAt?: string;
}

/** The shop's own details, edited under Settings in the dashboard. */
export interface StoreProfile {
  name: string;
  email: string;
  phone: string;
  address: string | null;
  gstin: string | null;
  /**
   * Order value above which delivery is free, derived by the API from the
   * live shipping zones. Null when no zone offers free delivery, in which
   * case nothing should claim it does.
   */
  freeDeliveryAbove: number | null;
  /** The announcement bar's message. Null means show no bar. */
  announcement: string | null;
}
