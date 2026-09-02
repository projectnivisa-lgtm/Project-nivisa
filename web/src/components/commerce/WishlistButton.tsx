"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/hooks/useWishlist";

/**
 * Wishlist toggle.
 *
 * Stays visible for signed-out visitors and routes them to login on tap.
 * Hiding it would make the feature invisible to exactly the people who have
 * not signed up yet — and the heart is one of the few reasons a furniture
 * browser creates an account at all.
 *
 * The fill transition is a scale-and-settle rather than a bounce: at 160ms it
 * confirms the tap without becoming a performance.
 */
export function WishlistButton({
  productId,
  productName,
  className,
}: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const router = useRouter();
  const { isWishlisted, toggle, isAuthenticated } = useWishlist();
  const saved = isWishlisted(productId);

  return (
    <button
      type="button"
      // A card is usually wrapped in a link; without this the tap navigates.
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isAuthenticated) {
          router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        toggle.mutate({ productId, isWishlisted: saved });
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from saved` : `Save ${productName}`}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full",
        "bg-surface/90 backdrop-blur-[2px] transition-colors duration-fast",
        "hover:bg-surface",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className={cn(
          "h-5 w-5 transition-[transform,fill,stroke] duration-fast",
          saved
            ? "scale-110 fill-accent stroke-accent"
            : "scale-100 fill-none stroke-ink",
        )}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20.5l-7.1-7a4.5 4.5 0 0 1 6.4-6.3l.7.7.7-.7a4.5 4.5 0 0 1 6.4 6.3z" />
      </svg>
    </button>
  );
}
