"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { OtpForm } from "./OtpForm";
import { useAuth } from "@/hooks/useAuth";

/**
 * The interactive half of the sign-in page.
 *
 * `next` arrives as a prop, already validated on the server, rather than being
 * read here with `useSearchParams`. That hook forces a statically-prerendered
 * page into a client-rendered Suspense boundary, and on this route the
 * boundary never resolved: the server shipped the fallback, the subtree never
 * hydrated, and the form was inert — the phone field accepted text while the
 * "Send code" button stayed disabled, because React state never saw the input.
 * Reading the parameter on the server removes the boundary and the failure
 * mode with it.
 */
export function LoginPanel({ next }: { next: string }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl">You are signed in</h1>
        <Link
          href={next}
          className="mt-6 inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
        >
          Continue
        </Link>
      </div>
    );
  }

  return (
    <div className="py-14 lg:py-20">
      <h1 className="text-3xl">Sign in</h1>
      <p className="mt-3 text-ink-muted">
        To track orders, save pieces and check out faster. You do not need an
        account to browse.
      </p>

      <div className="mt-8 rounded-sm border border-border bg-surface p-6">
        <OtpForm onSuccess={() => router.replace(next)} />
      </div>

      <p className="mt-6 text-xs text-ink-muted">
        By continuing you agree to our{" "}
        <Link
          href="/pages/terms-of-use"
          className="text-accent underline-offset-4 hover:underline"
        >
          terms
        </Link>{" "}
        and{" "}
        <Link
          href="/pages/privacy-policy"
          className="text-accent underline-offset-4 hover:underline"
        >
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
