"use client";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useStore } from "@/hooks/useStore";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { formatMoney } from "@/lib/utils";

/**
 * Announcement bar.
 *
 * Dismissible and remembered per device: an undismissable strip that reappears
 * on every page is an irritation, and the message has been read after the
 * first view.
 *
 * The message comes from the shop's settings, and the fallback quotes the
 * free-delivery threshold the API derives from the live shipping zones. It
 * was a hardcoded "above ₹15,000" while the actual rule was ₹25,000 — a
 * promise the shop would not have kept, in the most prominent strip on
 * every page.
 */
const DISMISS_KEY = "nivisa.announcementDismissed";

export function AnnouncementBar() {
  // The server snapshot is "1" (dismissed) so the bar is absent from the SSR
  // markup and appears on hydration for visitors who have not dismissed it.
  // The reverse would render the bar server-side and yank it away on hydrate,
  // shifting the whole page down and then back up.
  const [dismissed, setDismissed] = useLocalStorage(DISMISS_KEY, "1");
  const { store } = useStore();

  if (dismissed === "1") return null;

  const message =
    store?.announcement ??
    (store?.freeDeliveryAbove
      ? `Free delivery and assembly on orders above ${formatMoney({
          amount: store.freeDeliveryAbove,
          currency: "INR",
        })}`
      : null);

  // Nothing true to say means no bar. An empty strip of colour is worse than
  // no strip, and a claim nobody configured is worse than both.
  if (!message && !IS_DEMO_CONTENT) return null;

  return (
    <div className="bg-surface-inverse text-ink-inverse">
      {IS_DEMO_CONTENT ? (
        <p className="bg-warning px-4 py-1.5 text-center text-2xs font-semibold text-canvas">
          Demo content — products below are sample data, not live catalogue
        </p>
      ) : null}
      <div className="container-page relative flex min-h-10 items-center justify-center gap-4 py-2">
        <p className="text-center text-xs">{message}</p>
        <button
          type="button"
          onClick={() => setDismissed("1")}
          aria-label="Dismiss announcement"
          className="absolute right-4 flex h-8 w-8 items-center justify-center opacity-70 transition-opacity duration-fast hover:opacity-100 max-sm:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
