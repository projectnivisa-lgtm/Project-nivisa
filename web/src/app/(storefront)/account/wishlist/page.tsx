"use client";

import { AccountShell } from "@/components/account/AccountShell";
import { WishlistGrid } from "@/components/account/WishlistGrid";

export default function AccountWishlistPage() {
  return (
    <AccountShell
      title="Saved pieces"
      description="Kept here while you decide. Nothing is reserved — stock can run out."
    >
      <WishlistGrid />
    </AccountShell>
  );
}
