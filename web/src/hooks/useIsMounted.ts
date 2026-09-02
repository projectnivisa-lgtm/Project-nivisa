"use client";

import { useSyncExternalStore } from "react";

/** Never changes, so the store never notifies. */
const noopSubscribe = () => () => {};

/**
 * False during SSR and on the first client render, true afterwards.
 *
 * Needed by anything that must touch `document` at render time — portals,
 * most obviously. Implemented with `useSyncExternalStore` rather than
 * `useState` + `useEffect` so it does not trip React's cascading-render rule,
 * and so the server and first client render agree before the value flips.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
