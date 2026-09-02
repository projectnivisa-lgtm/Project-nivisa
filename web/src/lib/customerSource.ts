import { customerApi, type AddressInput } from "@/api/customer";
import { catalogApi } from "@/api/catalog";
import { IS_DEMO_CONTENT } from "@/lib/demo";
import { DEMO_PRODUCTS } from "@/lib/demo/catalogue";
import { demoAddresses, demoProfile, demoWishlist } from "@/lib/demo/account";
import type { Address, AddressKind, Customer } from "@/types/customer";
import type { Product } from "@/types/product";

/**
 * Customer profile, addresses and wishlist.
 *
 * One branch point between the live API and the demo store, matching
 * `cartSource` and `orderSource`.
 */

function settle<T>(run: () => T): Promise<T> {
  try {
    return Promise.resolve(run());
  } catch (cause) {
    return Promise.reject(cause);
  }
}

export const customerSource = {
  getProfile(phone: string): Promise<Customer> {
    if (IS_DEMO_CONTENT) return Promise.resolve(demoProfile.get(phone));
    return customerApi.getProfile();
  },

  updateProfile(
    phone: string,
    input: { name?: string; email?: string },
  ): Promise<Customer> {
    if (IS_DEMO_CONTENT) return settle(() => demoProfile.update(phone, input));
    return customerApi.updateProfile(input);
  },

  listAddresses(kind: AddressKind): Promise<Address[]> {
    if (IS_DEMO_CONTENT) return settle(() => demoAddresses.list(kind));
    return customerApi.listAddresses(kind);
  },

  createAddress(kind: AddressKind, input: AddressInput): Promise<Address> {
    if (IS_DEMO_CONTENT) return settle(() => demoAddresses.create(kind, input));
    return customerApi.createAddress({ ...input, kind });
  },

  updateAddress(
    kind: AddressKind,
    id: number,
    input: AddressInput,
  ): Promise<Address> {
    if (IS_DEMO_CONTENT) return settle(() => demoAddresses.update(kind, id, input));
    return customerApi.updateAddress(id, { ...input, kind });
  },

  deleteAddress(kind: AddressKind, id: number): Promise<void> {
    if (IS_DEMO_CONTENT) return settle(() => demoAddresses.remove(kind, id));
    return customerApi.deleteAddress(id);
  },

  /* ---------------------------------------------------------- Wishlist */

  getWishlist(): Promise<Product[]> {
    if (IS_DEMO_CONTENT) {
      const ids = demoWishlist.ids();
      // Preserve the order things were saved in, newest first.
      return Promise.resolve(
        ids
          .map((id) => DEMO_PRODUCTS.find((p) => p.id === id))
          .filter((p): p is Product => Boolean(p)),
      );
    }
    return catalogApi.getWishlist();
  },

  addToWishlist(productId: string): Promise<void> {
    if (IS_DEMO_CONTENT) return settle(() => demoWishlist.add(productId));
    return catalogApi.addToWishlist(productId);
  },

  removeFromWishlist(productId: string): Promise<void> {
    if (IS_DEMO_CONTENT) return settle(() => demoWishlist.remove(productId));
    return catalogApi.removeFromWishlist(productId);
  },
};
