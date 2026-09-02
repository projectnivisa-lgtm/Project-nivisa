import { contentApi } from "@/api/content";
import { ApiError } from "@/api/client";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { getDemoPage } from "@/lib/demo/content";
import type { ContentPage, StoreProfile } from "@/types/content";

/**
 * Content source.
 *
 * Every function resolves rather than throws, returning `null` for "not found"
 * so a route can call `notFound()` itself and produce a real 404 status. A
 * rejected promise here would replace the page with an error boundary and a
 * 200 — the soft-404 problem recorded in category/[slug]/README-no-loading.md.
 */

export async function loadPage(slug: string): Promise<ContentPage | null> {
  if (IS_DEMO_CONTENT) return getDemoPage(slug);
  try {
    return await contentApi.getPage(slug);
  } catch (cause) {
    if (cause instanceof ApiError && cause.kind === "notFound") return null;
    throw cause;
  }
}

/**
 * The same page, for a route that is not made of it.
 *
 * `loadPage` rethrows anything that is not a 404, which is right for
 * /pages/[slug]: the CMS body IS that route, and turning a 500 into `null`
 * would call notFound() and tell a crawler a page that exists does not.
 *
 * /about and /contact are the other shape. They are written in the codebase
 * and merely ADD an editable section, and both already render correctly when
 * it is absent. For them a 500 should degrade the way `loadStore` already
 * does - a missing section, not a dead route - because those two are
 * prerendered at build time, so a CMS that is briefly unreachable otherwise
 * fails the whole deploy: not the page, not the shop, the deploy. That is a
 * lot of blast radius for an optional paragraph.
 *
 * It is logged rather than swallowed silently, so an outage still shows up in
 * the build output and in the server logs instead of pages quietly thinning
 * out and nobody noticing for a week.
 */
export async function loadOptionalPage(slug: string): Promise<ContentPage | null> {
  if (IS_DEMO_CONTENT) return getDemoPage(slug);
  try {
    return await contentApi.getPage(slug);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.kind !== "notFound") {
      const reference = cause instanceof ApiError && cause.errorId
        ? ` (reference ${cause.errorId})`
        : "";
      console.warn(
        `Content page "${slug}" could not be loaded${reference}; ` +
          `rendering the page without it. ${String(cause)}`,
      );
    }
    return null;
  }
}

/**
 * The shop's contact details.
 *
 * Falls back to null rather than to invented values: a footer with no phone
 * number is a gap, but a footer with a made-up one is a customer calling
 * nobody.
 */
export async function loadStore(): Promise<StoreProfile | null> {
  try {
    return await contentApi.getStore();
  } catch {
    return null;
  }
}
