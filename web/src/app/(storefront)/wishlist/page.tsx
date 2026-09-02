"use client";

import { WishlistGrid } from "@/components/account/WishlistGrid";

/**
 * Standalone wishlist.
 *
 * The header heart links here rather than into the account area: a guest who
 * taps it should meet a sign-in prompt about saved pieces, not the full
 * account navigation for an account they do not have yet. Signed-in customers
 * reach the same list from `/account/wishlist`, and both render one component.
 */
export default function WishlistPage() {
  return (
    <div className="container-page py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl">Saved pieces</h1>
      <p className="mt-3 max-w-prose text-ink-muted">
        Kept here while you decide. Nothing is reserved — stock can run out.
      </p>
      <div className="mt-8">
        <WishlistGrid />
      </div>
    </div>
  );
}
