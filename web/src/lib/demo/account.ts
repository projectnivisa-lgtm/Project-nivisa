import type { Address, AddressKind, Customer } from "@/types/customer";
import type { AddressInput } from "@/api/customer";

/**
 * DEMO CONTENT — NOT API DATA. See `lib/demo/catalogue.ts`.
 *
 * Profile, address book and wishlist for demo mode, in localStorage.
 *
 * Mirrors the backend's real constraints rather than being permissive, so the
 * UI built against it behaves the same way in production:
 *   - an address that has been used in an order cannot be edited, only
 *     replaced (the backend returns 409);
 *   - deletes are soft and are allowed even for used addresses.
 */

const PROFILE_KEY = "nivisa.demoProfile";
const ADDRESS_KEY = "nivisa.demoAddresses";
const WISHLIST_KEY = "nivisa.demoWishlist";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage unavailable — changes last for this page only. */
  }
}

/* -------------------------------------------------------------- Profile */

export const demoProfile = {
  get(phone: string): Customer {
    const stored = read<Partial<Customer>>(PROFILE_KEY, {});
    return {
      id: "demo-customer",
      name: stored.name ?? null,
      phone,
      email: stored.email ?? null,
    };
  },

  update(phone: string, input: { name?: string; email?: string }): Customer {
    const current = demoProfile.get(phone);
    const next: Customer = {
      ...current,
      name: input.name ?? current.name,
      email: input.email ?? current.email,
    };
    write(PROFILE_KEY, { name: next.name, email: next.email });
    return next;
  },
};

/* ------------------------------------------------------------ Addresses */

interface StoredAddress extends Address {
  kind: AddressKind;
}

function allAddresses(): StoredAddress[] {
  return read<StoredAddress[]>(ADDRESS_KEY, []);
}

export const demoAddresses = {
  list(kind: AddressKind): Address[] {
    return allAddresses().filter((a) => a.kind === kind);
  },

  create(kind: AddressKind, input: AddressInput): Address {
    const all = allAddresses();
    const id = all.reduce((max, a) => Math.max(max, a.id), 0) + 1;
    const address: StoredAddress = {
      id,
      kind,
      recipientName: input.recipientName,
      phone: input.phone,
      line1: input.line1,
      landmark: input.landmark,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      country: "India",
      label: input.label,
      usedInOrder: false,
    };
    write(ADDRESS_KEY, [address, ...all]);
    return address;
  },

  update(kind: AddressKind, id: number, input: AddressInput): Address {
    const all = allAddresses();
    const existing = all.find((a) => a.id === id && a.kind === kind);
    if (!existing) throw new Error("Address not found.");
    if (existing.usedInOrder) {
      // The same rule the backend enforces with a 409.
      throw new Error(
        "This address has already been used in an order and can no longer be edited. Please add a new address instead.",
      );
    }

    Object.assign(existing, {
      recipientName: input.recipientName,
      phone: input.phone,
      line1: input.line1,
      landmark: input.landmark,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      label: input.label,
    });
    write(ADDRESS_KEY, all);
    return existing;
  },

  remove(kind: AddressKind, id: number): void {
    write(
      ADDRESS_KEY,
      allAddresses().filter((a) => !(a.id === id && a.kind === kind)),
    );
  },

  /** Called when an order is placed, so the edit lock behaves realistically. */
  markUsed(pincode: string): void {
    const all = allAddresses();
    let changed = false;
    for (const address of all) {
      if (address.pincode === pincode && !address.usedInOrder) {
        address.usedInOrder = true;
        changed = true;
      }
    }
    if (changed) write(ADDRESS_KEY, all);
  },
};

/* ------------------------------------------------------------- Wishlist */

export const demoWishlist = {
  ids(): string[] {
    return read<string[]>(WISHLIST_KEY, []);
  },

  add(productId: string): void {
    const ids = demoWishlist.ids();
    if (!ids.includes(productId)) write(WISHLIST_KEY, [productId, ...ids]);
  },

  remove(productId: string): void {
    write(
      WISHLIST_KEY,
      demoWishlist.ids().filter((id) => id !== productId),
    );
  },
};
