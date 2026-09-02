"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountShell } from "@/components/account/AccountShell";
import { AddressForm, type AddressFormValues } from "@/components/checkout/AddressForm";
import { SurfaceMessage } from "@/components/ui/SurfaceMessage";
import { useAuth } from "@/hooks/useAuth";
import { customerSource } from "@/lib/customerSource";
import { surfaceState } from "@/lib/surfaceState";
import { ApiError } from "@/api/client";
import type { Address } from "@/types/customer";

/**
 * Address book.
 *
 * Only delivery addresses. The backend also has `billing` and `other` tables,
 * but orders ship to a delivery address and nothing in the customer-facing
 * flow reads the other two — exposing three parallel address books would be
 * asking the customer to model the database.
 *
 * The important behaviour here is the edit lock. Orders reference an address
 * by id rather than by a copy of its text, so editing one that has been used
 * would silently rewrite the shipping address on past orders. The backend
 * returns 409; this page never offers Edit on such a row in the first place,
 * and says why.
 */
export default function AddressesPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<Address | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);

  const query = useQuery({
    queryKey: ["addresses", "shipping"],
    queryFn: () => customerSource.listAddresses("shipping"),
    enabled: isAuthenticated,
  });

  const addresses = query.data ?? [];
  const state = surfaceState(query, addresses.length === 0);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["addresses"] });
  }

  function describe(cause: unknown) {
    return cause instanceof ApiError || cause instanceof Error
      ? cause.message
      : "That did not work. Please try again.";
  }

  const save = useMutation({
    mutationFn: (values: AddressFormValues) => {
      const input = {
        recipientName: values.recipientName,
        phone: values.phone,
        line1: values.line1,
        landmark: values.landmark || undefined,
        city: values.city,
        state: values.state,
        pincode: values.pincode,
      };
      return editing
        ? customerSource.updateAddress("shipping", editing.id, input)
        : customerSource.createAddress("shipping", input);
    },
    onSuccess: () => {
      setEditing(null);
      setIsAdding(false);
      setError(null);
      invalidate();
    },
    onError: (cause) => setError(describe(cause)),
  });

  const remove = useMutation({
    mutationFn: (address: Address) =>
      customerSource.deleteAddress("shipping", address.id),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
    },
    onError: (cause) => {
      setPendingDelete(null);
      setError(describe(cause));
    },
  });

  const isFormOpen = isAdding || editing !== null;

  return (
    <AccountShell
      title="Addresses"
      description="Where we deliver. Add as many as you need — you pick one at checkout."
    >
      {error ? (
        <p
          role="alert"
          className="mb-6 rounded-sm bg-destructive-soft px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {isFormOpen ? (
        <section className="rounded-sm border border-ink bg-surface p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="font-sans text-lg font-medium tracking-normal">
              {editing ? "Edit address" : "Add an address"}
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setIsAdding(false);
                setError(null);
              }}
              className="min-h-11 text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Cancel
            </button>
          </div>

          <AddressForm
            initialValues={
              editing
                ? {
                    recipientName: editing.recipientName,
                    phone: editing.phone,
                    line1: editing.line1,
                    landmark: editing.landmark ?? "",
                    city: editing.city,
                    state: editing.state,
                    pincode: editing.pincode,
                  }
                : undefined
            }
            isBusy={save.isPending}
            submitLabel={editing ? "Save address" : "Add address"}
            onSubmit={(values) => save.mutate(values)}
          />
        </section>
      ) : (
        <>
          {state === "loading" ? (
            <div className="space-y-4" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="skeleton h-40 rounded-sm" />
              ))}
            </div>
          ) : state === "error" || state === "offline" ? (
            <SurfaceMessage kind={state} onRetry={() => query.refetch()} />
          ) : state === "empty" ? (
            <div className="rounded-sm border border-border bg-surface px-6 py-14 text-center">
              <p className="text-lg font-medium">No addresses saved</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
                Add one now, or enter it at checkout and we will save it for
                next time.
              </p>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="mt-7 inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm font-medium text-on-primary transition-colors duration-fast hover:bg-primary-hover"
              >
                Add an address
              </button>
            </div>
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2">
                {addresses.map((address) => (
                  <li
                    key={address.id}
                    className="flex flex-col rounded-sm border border-border bg-surface p-5"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{address.recipientName}</p>
                      <address className="mt-2 text-sm not-italic leading-relaxed text-ink-muted">
                        {address.line1}
                        {address.landmark ? (
                          <>
                            <br />
                            {address.landmark}
                          </>
                        ) : null}
                        <br />
                        {address.city}, {address.state}{" "}
                        <span className="tabular">{address.pincode}</span>
                        <br />
                        <span className="tabular">+91 {address.phone}</span>
                      </address>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4">
                      {address.usedInOrder ? (
                        <p className="text-xs text-ink-muted">
                          Used in an order — add a new address to change it.
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(address);
                            setError(null);
                          }}
                          className="min-h-11 text-sm text-accent underline-offset-4 hover:underline"
                        >
                          Edit
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setPendingDelete(address)}
                        className="min-h-11 text-sm text-ink-muted underline-offset-4 transition-colors duration-fast hover:text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => {
                  setIsAdding(true);
                  setError(null);
                }}
                className="mt-6 inline-flex min-h-12 items-center rounded-sm border border-border-interactive px-6 text-sm font-medium transition-colors duration-fast hover:border-ink"
              >
                Add another address
              </button>
            </>
          )}
        </>
      )}

      {/* Removal is confirmed rather than undoable: there is no restore
          endpoint, so a mis-tap would be unrecoverable. */}
      {pendingDelete ? (
        <ConfirmDialog
          title="Remove this address?"
          body={`${pendingDelete.recipientName}, ${pendingDelete.line1}, ${pendingDelete.city}`}
          confirmLabel={remove.isPending ? "Removing…" : "Remove"}
          onConfirm={() => remove.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </AccountShell>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="relative w-full max-w-sm rounded-t-lg bg-canvas p-6 shadow-pop sm:rounded-sm"
      >
        <h2 id="confirm-title" className="font-sans text-lg font-medium tracking-normal">
          {title}
        </h2>
        <p id="confirm-body" className="mt-2 text-sm text-ink-muted">
          {body}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-sm bg-destructive px-5 text-sm font-medium text-canvas"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="min-h-11 flex-1 rounded-sm border border-border-interactive px-5 text-sm transition-colors duration-fast hover:border-ink"
          >
            Keep it
          </button>
        </div>
      </div>
    </div>
  );
}
