import type { NextConfig } from "next";

/**
 * The API's origin, as this Next server can reach it.
 *
 * Inside Docker the browser and the server reach the API at different
 * addresses; a rewrite is performed by the server, so it wants the internal
 * one. Falls back to the public URL when both are the same.
 */
const apiOrigin =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

/**
 * Poll for file changes instead of waiting for inotify, in milliseconds.
 *
 * Set only inside Docker. Inotify events do not cross a bind mount from a
 * Windows host, so without this the dev server never sees an edit and hot
 * reload silently stops working - every change needs the container
 * restarting by hand, and it looks like the change did not take.
 *
 * `watchOptions` rather than the `WATCHPACK_POLLING` environment variable
 * that used to be set here: that one is read by webpack from the environment,
 * and this is the supported way to say the same thing in the config.
 *
 * It does NOT make Turbopack watch this mount, despite reading as though it
 * should - tested 2026-09-12 by editing a server-rendered heading with each
 * bundler: webpack served the new text in about 4 seconds, Turbopack had not
 * served it 48 seconds later. That is why docker-compose.yml still pins
 * `next dev --webpack` for the container.
 *
 * Off when running natively, where the native watcher works and polling is
 * just a CPU tax.
 */
const pollIntervalMs = Number(process.env.NEXT_WATCH_POLL_MS ?? 0);

const nextConfig: NextConfig = {
  ...(pollIntervalMs > 0 ? { watchOptions: { pollIntervalMs } } : {}),

  async rewrites() {
    return [
      {
        /**
         * Uploaded files are served by the API while STORAGE_PROVIDER=local,
         * and stored as root-relative `/media/...` paths so the URL in the
         * database survives the host changing.
         *
         * Without this rewrite those paths resolve against the storefront's
         * own origin and 404 — which is invisible for the seeded catalogue
         * (its images are remote) and breaks the moment anyone uploads a
         * photograph or a 3D model through the dashboard.
         *
         * On STORAGE_PROVIDER=s3 the stored URLs are already absolute and
         * never match this rule, so it costs nothing in production.
         */
        source: "/media/:path*",
        destination: `${apiOrigin}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
