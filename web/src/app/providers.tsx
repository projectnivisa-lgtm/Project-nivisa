"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { installUnauthorizedHandler } from "@/hooks/useAuth";

/**
 * Application providers.
 *
 * Retry policy is deliberate: a network blip or a 502 is worth retrying, but a
 * 404 or a 422 is a settled answer, and retrying it three times only delays
 * the empty state the customer needs to see.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Registered once, in the initialiser, so a 401 from any query clears the
  // stored customer rather than leaving the UI claiming to be signed in.
  useState(() => {
    if (typeof window !== "undefined") installUnauthorizedHandler();
    return null;
  });

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // "always" rather than the default "online". This store has no
            // offline cache to serve, so a request that is held back while
            // the browser thinks it is offline just becomes an unexplained
            // skeleton; attempting it and failing produces a real error the
            // customer can act on, and ApiError already words a network
            // failure properly. Note this does NOT stop every pause — a
            // retrying query is also held while the tab is backgrounded
            // (query-core retryer requires focusManager.isFocused()), which
            // is correct behaviour and handled in lib/surfaceState.ts.
            networkMode: "always",
            // Catalogue data is not volatile; a minute of freshness removes
            // most refetching as a customer moves between grid and product.
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (error instanceof ApiError) {
                return error.isRetryable && failureCount < 2;
              }
              return failureCount < 1;
            },
          },
          mutations: {
            // Same reasoning, and it matters more here: a paused "place order"
            // that silently fires later is far worse than one that fails now.
            networkMode: "always",
            // Never silently retry a mutation: a repeated "place order" is a
            // duplicate order, not a recovered one.
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
