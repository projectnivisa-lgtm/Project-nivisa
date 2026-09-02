import { api } from "./client";
import type { Address, AddressKind, Customer } from "@/types/customer";

/**
 * Customer profile and address book.
 *
 * One address collection with a `kind`, replacing the three near-identical
 * endpoints the old backend exposed. An address id is now unambiguous, so the
 * opaque `"D-12"` reference that existed to disambiguate three id sequences
 * is gone.
 */

export interface AddressInput {
  kind?: AddressKind;
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  label?: string;
  isDefault?: boolean;
}

interface ApiAddress {
  id: number;
  kind: string;
  label: string | null;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

interface ApiCustomer {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
}

function toAddress(raw: ApiAddress): Address {
  return {
    id: raw.id,
    kind: raw.kind === "billing" ? "billing" : "shipping",
    recipientName: raw.full_name,
    phone: raw.phone,
    line1: raw.line1,
    line2: raw.line2 ?? undefined,
    landmark: raw.landmark ?? undefined,
    city: raw.city,
    state: raw.state,
    pincode: raw.postal_code,
    country: raw.country,
    label: raw.label ?? undefined,
    // Orders snapshot the address text at checkout rather than referencing
    // the row, so editing one can no longer rewrite a past order's shipping
    // address. Nothing is ever locked.
    usedInOrder: false,
    isDefault: raw.is_default,
  };
}

function toPayload(input: AddressInput) {
  return {
    kind: input.kind ?? "shipping",
    label: input.label || null,
    full_name: input.recipientName,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2 || null,
    landmark: input.landmark || null,
    city: input.city,
    state: input.state,
    postal_code: input.pincode,
    country: "IN",
    is_default: input.isDefault ?? false,
  };
}

function toCustomer(raw: ApiCustomer): Customer {
  return {
    id: String(raw.id),
    name: raw.name,
    phone: raw.phone,
    email: raw.email,
  };
}

export const customerApi = {
  async getProfile(): Promise<Customer> {
    return toCustomer(await api.get<ApiCustomer>("/auth/me"));
  },

  /**
   * Name and email only. The phone number is the account identifier and
   * cannot be changed here — that is an account transfer, not a profile edit,
   * and the API does not accept it.
   */
  async updateProfile(input: { name?: string; email?: string }): Promise<Customer> {
    const raw = await api.put<ApiCustomer>("/account/profile", {
      name: input.name,
      email: input.email,
    });
    return toCustomer(raw);
  },

  /**
   * The whole address book, defaults first.
   *
   * `kind` filters client-side rather than as a request: the list is a handful
   * of rows, and one fetch means the account page and the checkout selector
   * share a cache entry instead of racing two requests that can disagree.
   */
  async listAddresses(kind?: AddressKind): Promise<Address[]> {
    const raw = await api.get<ApiAddress[]>("/account/addresses");
    const all = (raw ?? []).map(toAddress);
    return kind ? all.filter((a) => a.kind === kind) : all;
  },

  async createAddress(input: AddressInput): Promise<Address> {
    return toAddress(await api.post<ApiAddress>("/account/addresses", toPayload(input)));
  },

  async updateAddress(id: number, input: AddressInput): Promise<Address> {
    return toAddress(
      await api.put<ApiAddress>(`/account/addresses/${id}`, toPayload(input)),
    );
  },

  /** Archives rather than deletes, so an order in flight keeps its target. */
  async deleteAddress(id: number): Promise<void> {
    await api.del(`/account/addresses/${id}`);
  },

  /** What checkout offers, default first. */
  async getCheckoutAddressOptions(): Promise<Address[]> {
    const all = await this.listAddresses("shipping");
    return [...all].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  },
};
