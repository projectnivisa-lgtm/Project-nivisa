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
