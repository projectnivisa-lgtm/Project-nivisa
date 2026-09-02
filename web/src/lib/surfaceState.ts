/**
 * The five states every API-driven surface must handle.
 *
 * Written once because getting this wrong is invisible until a customer is
 * staring at a shimmering rectangle. Two traps this closes:
 *
 * 1. `isLoading` is false during the backoff between retry attempts, while the
 *    query still has no data. A component switching on `isLoading` falls
 *    through every branch and renders an empty band under its own heading.
 *    `status === "pending"` is the honest test.
 *
 * 2. TanStack pauses a retrying query — `status: "pending"`,
 *    `fetchStatus: "paused"` — and it never becomes an error while paused.
 *    Treated as an error that would be a false alarm; treated as loading
 *    forever it is an unexplained eternal skeleton. It needs deciding, not
 *    ignoring.
 *
 * Two different things cause a pause (query-core `retryer.ts`: a retry
 * continues only while `focusManager.isFocused() && (networkMode === "always"
 * || onlineManager.isOnline())`):
 *
 *   - The tab is backgrounded. Extremely common, self-healing on refocus, and
 *     nobody is looking at the screen — so this must stay `loading`. Telling a
 *     returning customer they were offline would be a lie.
 *   - The device is genuinely offline. Worth saying out loud.
 *
 * `navigator.onLine` separates them. It is unreliable in the positive
 * direction (true does not prove reachability), but reliable in the negative:
 * false means the OS is certain there is no network. Only that claims offline.
 */

export type SurfaceState = "loading" | "offline" | "error" | "empty" | "ready";

interface QueryLike {
  status: "pending" | "error" | "success";
  fetchStatus: "fetching" | "paused" | "idle";
}

function isDefinitelyOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function surfaceState(query: QueryLike, isEmpty: boolean): SurfaceState {
  // Paused WITH data already shown is fine — stale content beats an error
  // screen, so only a pause with nothing to show is worth reporting.
  if (query.fetchStatus === "paused" && query.status === "pending") {
    return isDefinitelyOffline() ? "offline" : "loading";
  }
  if (query.status === "pending") return "loading";
  if (query.status === "error") return "error";
  return isEmpty ? "empty" : "ready";
}

/** Copy for the two failure states, so wording stays consistent site-wide. */
export const SURFACE_COPY = {
  offline: {
    title: "You appear to be offline",
    body: "This will load by itself once your connection is back.",
    action: "Try now",
  },
  error: {
    title: "That did not load",
    body: "The rest of the page is fine — this section just needs another try.",
    action: "Try again",
  },
} as const;
