"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/auth";
import { setUnauthorizedHandler, tokens } from "@/api/client";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import type { Customer } from "@/types/customer";

/**
 * Authentication state.
 *
 * Browsing, search, the product page and the cart all work signed out; only
 * checkout and the account area require a session. A furniture store that
 * gates its catalogue behind a phone number loses the customer before it has
 * earned the right to ask.
 *
 * Backed by `useSyncExternalStore` over the token store rather than React
 * state, so every component that cares about sign-in re-renders together when
 * a token is written or cleared — including from another tab.
 */

const CUSTOMER_KEY = "nivisa.customer";
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Cached so `getSnapshot` returns a stable reference between renders. */
let snapshotRaw: string | null = null;
let snapshotValue: Customer | null = null;

function getSnapshot(): Customer | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CUSTOMER_KEY);
  } catch {
    raw = null;
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    try {
      snapshotValue = raw ? (JSON.parse(raw) as Customer) : null;
    } catch {
      snapshotValue = null;
    }
  }
  return snapshotValue;
}

function persist(customer: Customer | null) {
  try {
    if (customer) {
      window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
    } else {
      window.localStorage.removeItem(CUSTOMER_KEY);
    }
  } catch {
    /* Storage unavailable — the session lasts for this page only. */
  }
  notify();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const customer = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null, // Signed out during SSR: the token lives only in the browser.
  );

  const requestOtp = useCallback(async (phone: string) => {
    if (IS_DEMO_CONTENT) return; // No SMS gateway; any code is accepted below.
    await authApi.requestOtp(phone);
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string) => {
      if (IS_DEMO_CONTENT) {
        // DEMO ONLY. Never reached in production: the flag is build-time and
        // unset there, and this path issues no token the API would accept.
        if (otp.length !== 6) throw new Error("Enter the 6-digit code.");
        persist({ id: "demo-customer", name: null, phone, email: null });
        return { isNewAccount: true };
      }

      const session = await authApi.verifyOtp(phone, otp);
      persist(session.customer);
      // The guest cart was merged server-side during verification, so the
      // cached copy is stale the moment we sign in.
      queryClient.invalidateQueries();
      return { isNewAccount: session.isNewAccount };
    },
    [queryClient],
  );

  const signOut = useCallback(() => {
    authApi.signOut();
    persist(null);
    queryClient.clear();
  }, [queryClient]);

  return {
    customer,
    isAuthenticated: customer !== null,
    requestOtp,
    verifyOtp,
    signOut,
  };
}

/**
 * Registers the global 401 handler once.
 *
 * A 401 anywhere clears the stored customer so the UI stops claiming to be
 * signed in; it deliberately does NOT redirect, because a background query
 * expiring should not throw someone out of a checkout form they are mid-way
 * through filling.
 */
export function installUnauthorizedHandler() {
  setUnauthorizedHandler(() => {
    tokens.setAccess(null);
    persist(null);
  });
}
