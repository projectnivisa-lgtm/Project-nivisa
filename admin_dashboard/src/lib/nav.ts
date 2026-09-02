import {
  BarChart3, Boxes, FileText, Home, Image, Layers, LayoutGrid, Package,
  Percent, ScrollText, Settings, ShieldCheck, ShoppingCart, Sofa,
  Star, Truck, Users, UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { canAny } from '@/lib/api';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Shown when the user holds ANY of these. Empty means always visible. */
  permissions: string[];
  children?: NavItem[];
}

/**
 * The dashboard's navigation, and the single source of truth for which
 * permission opens which screen.
 *
 * The same list drives the sidebar, the command palette and the route guards,
 * so a screen cannot be reachable by URL after being hidden from the menu -
 * which is exactly the gap that makes menu-only permission checks worthless.
 */
export const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: Home, permissions: ['dashboard.view'] },
  {
    label: 'Catalogue',
    to: '/products',
    icon: Sofa,
    permissions: ['products.read'],
    children: [
      { label: 'Products', to: '/products', icon: Package, permissions: ['products.read'] },
      { label: 'Categories', to: '/categories', icon: Layers, permissions: ['taxonomy.read'] },
      { label: 'Rooms', to: '/rooms', icon: LayoutGrid, permissions: ['taxonomy.read'] },
      { label: 'Collections', to: '/collections', icon: Boxes, permissions: ['taxonomy.read'] },
      { label: 'Brands & attributes', to: '/attributes', icon: Star, permissions: ['taxonomy.read'] },
    ],
  },
  { label: 'Orders', to: '/orders', icon: ShoppingCart, permissions: ['orders.read'] },
  { label: 'Customers', to: '/customers', icon: Users, permissions: ['customers.read'] },
  {
    label: 'Marketing',
    to: '/coupons',
    icon: Percent,
    permissions: ['coupons.read', 'reviews.moderate'],
    children: [
      { label: 'Discounts', to: '/coupons', icon: Percent, permissions: ['coupons.read'] },
      { label: 'Reviews', to: '/reviews', icon: Star, permissions: ['reviews.moderate'] },
      { label: 'Shipping rates', to: '/shipping', icon: Truck, permissions: ['coupons.read'] },
    ],
  },
  {
    label: 'Content',
    to: '/pages',
    icon: FileText,
    permissions: ['content.read'],
    children: [
      { label: 'Pages', to: '/pages', icon: FileText, permissions: ['content.read'] },
      { label: 'Banners', to: '/banners', icon: Image, permissions: ['content.read'] },
      { label: 'Homepage', to: '/homepage', icon: LayoutGrid, permissions: ['content.read'] },
    ],
  },
  { label: 'Reports', to: '/reports', icon: BarChart3, permissions: ['reports.view'] },
  {
    label: 'Settings',
    to: '/staff',
    icon: Settings,
    permissions: ['staff.read', 'roles.read', 'audit.read', 'settings.write'],
    children: [
      { label: 'Staff', to: '/staff', icon: UserCog, permissions: ['staff.read'] },
      { label: 'Roles & permissions', to: '/roles', icon: ShieldCheck, permissions: ['roles.read'] },
      { label: 'Store settings', to: '/settings', icon: Settings, permissions: ['settings.write'] },
      { label: 'Audit log', to: '/audit', icon: ScrollText, permissions: ['audit.read'] },
    ],
  },
];

export function visibleNav(): NavItem[] {
  const allowed = (item: NavItem) =>
    item.permissions.length === 0 || canAny(...item.permissions);

  return NAV.filter(allowed).map((item) => ({
    ...item,
    children: item.children?.filter(allowed),
  }));
}

/** Flattened, for the page finder in the header. */
export function searchableRoutes(): { label: string; to: string }[] {
  const out: { label: string; to: string }[] = [];
  for (const item of visibleNav()) {
    if (item.children?.length) {
      out.push(...item.children.map((c) => ({ label: c.label, to: c.to })));
    } else {
      out.push({ label: item.label, to: item.to });
    }
  }
  return out;
}

/** The first screen a user can actually open, for redirecting after sign-in. */
export function landingRoute(): string {
  const nav = visibleNav();
  const first = nav[0];
  if (!first) return '/no-access';
  return first.children?.length ? first.children[0].to : first.to;
}
