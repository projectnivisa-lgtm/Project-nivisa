/**
 * Customer and address model.
 *
 * The address book is a real multi-address store: one table, a `kind`, and an
 * `isDefault` flag. The previous backend kept one "current" row per address
 * table and needed an opaque `"D-12"`/`"O-4"` reference so a caller could not
 * post a bare id and ship to the wrong table's row. That is gone — an id is
 * now unambiguous.
 */

export type AddressKind = "shipping" | "billing";

export interface Address {
  id: number;
  kind: AddressKind;
  recipientName: string;
  phone: string;
  line1: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  line2?: string;
  /** "Home" / "Work" — the customer's own label, distinct from `kind`. */
  label?: string;
  /**
   * Whether an order references this row.
   *
   * Always false now, and kept only so the account page's guard compiles.
   * An order snapshots the address text at checkout rather than pointing at
   * the row, so editing an address can no longer rewrite where a past parcel
   * was sent — which is what the old backend's 409 existed to prevent.
   */
  usedInOrder: boolean;
  /** The address preselected at checkout, one per kind. */
  isDefault?: boolean;
}

export interface Customer {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
}

/**
 * What a PIN code lookup can tell a furniture buyer.
 *
 * `city` and `state` stay null: nothing here is backed by a PIN database, and
 * a guessed city under a customer's address is worse than an empty field they
 * fill in themselves. The delivery figures come from the shipping zones staff
 * maintain, so the estimate on a product page is the rule that will price the
 * order at checkout.
 */
export interface PincodeLookup {
  pincode: string;
  city: string | null;
  state: string | null;
  serviceable: boolean;
  /** Zone name, e.g. "Bengaluru metro". Null when no zone is configured. */
  zone: string | null;
  shippingFee: number | null;
  /** Order value above which delivery is free. */
  freeAbove: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
}

export interface AuthSession {
  accessToken: string;
  isNewAccount: boolean;
  customer: Customer;
}
