"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountShell } from "@/components/account/AccountShell";
import { useAuth } from "@/hooks/useAuth";
import { customerSource } from "@/lib/customerSource";
import { ApiError } from "@/api/client";

/**
 * Profile.
 *
 * Name and email only. The mobile number is the account identifier and is
 * shown read-only: the backend's profile endpoint accepts `name` and `email`
 * and nothing else, so an editable phone field would be a control that cannot
 * work. Changing it is a support action, and the page says so rather than
 * leaving the customer hunting for a setting that does not exist.
 */
export default function ProfilePage() {
  const { customer, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const phone = customer?.phone ?? "";

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => customerSource.getProfile(phone),
    enabled: isAuthenticated,
  });

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Controlled from the loaded profile until the customer starts typing, so
  // the fields populate without an effect writing state on every fetch.
  const nameValue = name ?? profile.data?.name ?? "";
  const emailValue = email ?? profile.data?.email ?? "";

  const save = useMutation({
    mutationFn: () =>
      customerSource.updateProfile(phone, {
        name: nameValue.trim(),
        email: emailValue.trim(),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile"], updated);
      setIsSaved(true);
      setError(null);
    },
    onError: (cause) =>
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "We could not save your details.",
      ),
  });

  const emailInvalid = emailValue.trim() !== "" && !/^\S+@\S+\.\S+$/.test(emailValue);

  return (
    <AccountShell
      title="Profile"
      description="Used on your invoices and for order updates."
    >
      {profile.isPending && isAuthenticated ? (
        <div className="max-w-md space-y-6" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="skeleton h-3.5 w-24 rounded-xs" />
              <div className="skeleton mt-2 h-12 w-full rounded-sm" />
            </div>
          ))}
        </div>
      ) : (
        <form
          className="max-w-md space-y-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setIsSaved(false);
            if (emailInvalid) {
              setError("Enter a valid email address.");
              return;
            }
            save.mutate();
          }}
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Full name
            </label>
            <input
              id="name"
              autoComplete="name"
              value={nameValue}
              onChange={(event) => {
                setName(event.target.value);
                setIsSaved(false);
              }}
              className="mt-2 h-12 w-full rounded-sm border border-border-interactive bg-canvas px-3 text-sm focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={emailValue}
              onChange={(event) => {
                setEmail(event.target.value);
                setIsSaved(false);
              }}
              aria-invalid={emailInvalid || undefined}
              aria-describedby="email-help"
              className="mt-2 h-12 w-full rounded-sm border border-border-interactive bg-canvas px-3 text-sm focus:border-accent"
            />
            <p id="email-help" className="mt-1.5 text-xs text-ink-muted">
              We send order confirmations and invoices here.
            </p>
          </div>

          <div>
            <label htmlFor="account-phone" className="block text-sm font-medium">
              Mobile number
            </label>
            <input
              id="account-phone"
              value={`+91 ${phone}`}
              readOnly
              // Read-only rather than disabled: a disabled field is skipped by
              // keyboard navigation and by some screen readers, so the number
              // would be invisible to exactly the people who most need it read
              // aloud.
              aria-describedby="phone-note"
              className="mt-2 h-12 w-full cursor-not-allowed rounded-sm border border-border bg-surface-sunken px-3 text-sm text-ink-muted tabular"
            />
            <p id="phone-note" className="mt-1.5 text-xs text-ink-muted">
              This is how you sign in. To change it, call us on +91 80 2216 1900.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </button>

            <p role="status" aria-live="polite" className="text-sm text-success">
              {isSaved ? "Saved" : ""}
            </p>
          </div>
        </form>
      )}
    </AccountShell>
  );
}
