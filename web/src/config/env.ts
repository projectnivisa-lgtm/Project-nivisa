/**
 * Environment configuration.
 *
 * Every environment-specific value enters the application here and nowhere
 * else. No component, hook or API module may read `process.env` directly —
 * that is what makes the production/development split a one-file change.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    // Two audiences, and the advice for one is useless to the other. This
    // throws during `next build` as readily as at runtime, and a build server
    // has no .env.local to copy to - the file is git-ignored, so it is never
    // in the deployment's checkout by design. Told only to copy a file, the
    // next person to read this in a Vercel log goes looking for one that
    // cannot be there.
    throw new Error(
      `Missing environment variable ${name}.\n` +
        `  Locally:  copy web/.env.example to web/.env.local and fill it in.\n` +
        `  Deployed: set ${name} in the host's environment variables ` +
        `(on Vercel: Project → Settings → Environment Variables), for every ` +
        `environment you build - Production, Preview and Development are ` +
        `separate lists there, and a variable set only for Production still ` +
        `fails the preview build.`,
    );
  }
  return value.replace(/\/+$/, "");
}

/**
 * Where the API is, which is not the same answer on both sides.
 *
 * The same fetch code runs in the visitor's browser and in the Next.js server
 * process. In Docker those are different networks: the browser reaches the API
 * on the published host port, while the server is inside the compose network
 * where "localhost" is its own container and the API answers to "api". Using
 * one value for both is why a server-rendered grid comes back empty while the
 * client-side calls beside it work.
 *
 * INTERNAL_API_BASE_URL is deliberately not NEXT_PUBLIC_: it must never be
 * inlined into the browser bundle, which cannot resolve it. Unset — running
 * natively, or deployed where both sides share a hostname — it falls back to
 * the public URL and nothing changes.
 */
const isServer = typeof window === "undefined";

export const env = {
  /** e.g. https://api.nivisa.com — no trailing slash. */
  apiBaseUrl:
    (isServer ? process.env.INTERNAL_API_BASE_URL?.replace(/\/+$/, "") : undefined) ||
    required("NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL),
  /** API route prefix. The staff dashboard is a separate application. */
  apiPrefix: "/api/v1",

  isProduction: process.env.NODE_ENV === "production",

  /**
   * Public origin of the storefront. Used for absolute URLs in structured
   * data and canonicals, where a relative path is not valid.
   */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nivisa.example").replace(
    /\/+$/,
    "",
  ),
} as const;

/** Absolute URL for a storefront path, for canonicals and structured data. */
export function absoluteUrl(path: string): string {
  return `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute URL for a customer endpoint. `path` starts with a slash. */
export function customerUrl(path: string): string {
  return `${env.apiBaseUrl}${env.apiPrefix}${path}`;
}
