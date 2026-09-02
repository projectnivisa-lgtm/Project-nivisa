"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage as a React external store.
 *
 * Reading storage in an effect and calling setState works, but it costs a
 * second render on every mount and trips React's cascading-render rule.
 * `useSyncExternalStore` is what this pattern is actually for: it reads the
 * value during render on the client, returns the server snapshot during SSR
 * so hydration matches, and re-renders every subscriber when the value moves.
 *
 * Storage access is wrapped throughout — Safari private mode and hardened
 * browser settings throw on access rather than returning null.
 */

const listeners = new Set<() => void>();

/** Snapshots are cached because getSnapshot must be referentially stable. */
const cache = new Map<string, string | null>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keep tabs in sync: a wishlist saved in one tab should update the other.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getSnapshot(key: string): string | null {
  const current = readRaw(key);
  // Only replace the cached value when it genuinely changed, so repeated
  // getSnapshot calls return an identical reference and React does not loop.
  if (cache.get(key) !== current) cache.set(key, current);
  return cache.get(key) ?? null;
}

/**
 * A string value in localStorage.
 *
 * `serverValue` is what renders during SSR and on the very first client paint,
 * so pick a value that is safe to show before storage is known.
 */
export function useLocalStorage(
  key: string,
  serverValue: string | null = null,
): [string | null, (next: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key),
    () => serverValue,
  );

  const setValue = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        /* Storage unavailable — the value lasts for this page only. */
      }
      cache.set(key, next);
      notify();
    },
    [key],
  );

  return [value, setValue];
}

/**
 * A JSON array in localStorage. Parsed defensively: a corrupted entry yields
 * an empty list rather than throwing during render.
 */
export function useLocalStorageList(key: string): [string[], (next: string[]) => void] {
  const [raw, setRaw] = useLocalStorage(key, null);

  let parsed: string[] = EMPTY;
  if (raw) {
    try {
      const candidate = JSON.parse(raw);
      if (Array.isArray(candidate)) parsed = candidate as string[];
    } catch {
      parsed = EMPTY;
    }
  }

  const setList = useCallback(
    (next: string[]) => setRaw(JSON.stringify(next)),
    [setRaw],
  );

  return [parsed, setList];
}

/** Shared empty array so an absent list keeps a stable identity across renders. */
const EMPTY: string[] = [];
