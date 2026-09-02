import { LoginPanel } from "@/components/auth/LoginPanel";
import type { SearchParamsInput } from "@/lib/listing";

/**
 * Sign in.
 *
 * A server component that reads `?next=` and hands it to the client panel.
 * Reading it here rather than with `useSearchParams` keeps the page out of a
 * client-rendered Suspense boundary — see `components/auth/LoginPanel.tsx` for
 * the failure that produced.
 *
 * `next` is validated as a same-origin path before use. Accepting an arbitrary
 * URL would make this an open redirect, and a login page is exactly where that
 * gets used for phishing: a link to our own domain that bounces to an
 * attacker's copy of it, after the customer has already trusted the address
 * bar.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const raw = typeof params.next === "string" ? params.next : null;

  // A single leading slash only: "//evil.example" is protocol-relative and
  // would leave the site, and a backslash is treated as a slash by some
  // browsers when resolving.
  const isSafe =
    raw !== null &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\");

  return (
    <div className="container-page">
      <div className="mx-auto max-w-md">
        <LoginPanel next={isSafe ? raw : "/account"} />
      </div>
    </div>
  );
}
