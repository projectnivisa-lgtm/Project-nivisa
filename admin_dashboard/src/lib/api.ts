/**
 * Nivisa admin API client.
 *
 * One module owns the wire format. Pages import typed functions and never
 * build a URL or read a response shape themselves, so a backend field rename
 * is a change here rather than a hunt through eighteen screens.
 */

/**
 * Where the admin API is.
 *
 * Relative by default, which keeps every request same-origin: the Vite dev
 * proxy (see vite.config.ts) or the server hosting the built files forwards
 * /api to the backend, and CORS never enters into it. That is the preferred
 * arrangement and the one the local stack and staging both use.
 *
 * VITE_API_URL overrides it with an absolute API root for the case the proxy
 * cannot cover — a static build served from an origin that does no
 * forwarding. It is the API's root with no trailing slash and no /api/v1,
 * which is appended below:
 *
 *     VITE_API_URL=https://staging.thirdeyegfx.in/nivisa
 *
 * Calling cross-origin this way requires the dashboard's origin to be listed
 * in the API's CORS_ORIGINS, or every request fails in the browser while
 * curl against the same URL succeeds.
 */
const API_ROOT = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const BASE = `${API_ROOT}/api/v1/admin`;
const TOKEN_KEY = 'nivisa.admin.token';
const USER_KEY = 'nivisa.admin.user';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoleSummary {
  id: number;
  slug: string;
  name: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: RoleSummary;
  /** Already resolved by the server, wildcard expanded. */
  permissions: string[];
  is_super_admin: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface Permission {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: Permission[];
}

export interface Role {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  staff_count: number;
}

export interface Staff {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: RoleSummary;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  position: number;
  is_active: boolean;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
  product_count: number;
}

export interface Room {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  position: number;
  is_active: boolean;
}

export interface Collection extends Room {
  is_featured: boolean;
  product_count: number;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
}

export type AttributeKind = 'material' | 'finish' | 'colour' | 'style' | 'upholstery';

export interface Attribute {
  id: number;
  kind: AttributeKind;
  name: string;
  slug: string;
  hex_code: string | null;
  position: number;
  is_active: boolean;
}

export interface ProductImage {
  id?: number;
  url: string;
  alt_text: string;
  kind: 'studio' | 'lifestyle' | 'detail' | 'dimension';
  position: number;
  variant_id?: number | null;
}

export interface ProductVariant {
  id?: number;
  sku: string;
  option_label: string | null;
  price: string;
  compare_at_price: string | null;
  cost_price?: string | null;
  tax_rate: string;
  stock_quantity: number;
  low_stock_threshold: number;
  backorder_allowed: boolean;
  in_stock?: boolean;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  weight_g: number | null;
  boxed_width_mm?: number | null;
  boxed_depth_mm?: number | null;
  boxed_height_mm?: number | null;
  lead_time_days: number | null;
  position: number;
  is_active: boolean;
}

export interface ProductRow {
  id: number;
  name: string;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  category: Category | null;
  brand: Brand | null;
  price_from: string;
  total_stock: number;
  variant_count: number;
  low_stock: boolean;
  primary_image: ProductImage | null;
  updated_at: string;
  /** Null where the product has no AR record yet — same thing as no model. */
  ar_status: ArStatus | null;
}

export interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
  category_id: number | null;
  brand_id: number | null;
  room_ids: number[];
  attribute_ids: number[];
  variants: ProductVariant[];
  images: ProductImage[];
  assembly_required: boolean | null;
  assembly_note: string | null;
  warranty_months: number | null;
  care_instructions: string | null;
  seating_capacity: number | null;
  specifications: { label: string; value: string }[] | null;
  meta_title: string | null;
  meta_description: string | null;
}

export type FulfilmentStatus =
  | 'pending' | 'processing' | 'packed' | 'dispatched' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus =
  | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';

export interface OrderRow {
  id: number;
  order_number: string;
  fulfilment_status: FulfilmentStatus;
  payment_status: PaymentStatus;
  grand_total: string;
  currency: string;
  item_count: number;
  placed_at: string | null;
  created_at: string;
}

export interface OrderItem {
  id: number;
  product_id: number | null;
  variant_id: number | null;
  product_name: string;
  variant_label: string | null;
  sku: string;
  image_url: string | null;
  unit_price: string;
  quantity: number;
  tax_amount: string;
  line_total: string;
}

export interface OrderEvent {
  id: number;
  kind: string;
  message: string;
  from_value: string | null;
  to_value: string | null;
  staff_name: string | null;
  created_at: string;
}

export interface OrderAddress {
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface OrderDetail {
  id: number;
  order_number: string;
  fulfilment_status: FulfilmentStatus;
  payment_status: PaymentStatus;
  subtotal: string;
  discount_total: string;
  shipping_total: string;
  tax_total: string;
  grand_total: string;
  refunded_total: string;
  currency: string;
  coupon_code: string | null;
  shipping_address: OrderAddress;
  billing_address: OrderAddress | null;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_note: string | null;
  staff_note: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  expected_delivery_date: string | null;
  placed_at: string | null;
  paid_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  items: OrderItem[];
  events: OrderEvent[];
  /** Computed by the server from the transition table. */
  allowed_transitions: FulfilmentStatus[];
  created_at: string;
}

export interface Customer {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
  order_count: number;
  total_spend: number;
  last_order_at: string | null;
}

export interface Coupon {
  id: number;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  max_discount: string | null;
  min_order_value: string;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  used_count: number;
  is_active: boolean;
}

export interface ShippingRate {
  id: number;
  name: string;
  postcode_prefixes: string;
  rate: string;
  free_above: string | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  position: number;
  is_active: boolean;
}

export interface Review {
  id: number;
  product_id: number;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string;
  status: 'pending' | 'approved' | 'rejected';
  is_verified_purchase: boolean;
  staff_reply: string | null;
  created_at: string;
}

export interface Page {
  id: number;
  slug: string;
  title: string;
  body: string;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  is_system: boolean;
  updated_at: string;
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  image_url: string;
  mobile_image_url: string | null;
  alt_text: string;
  link_url: string | null;
  cta_label: string | null;
  placement: string;
  position: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export interface HomepageSection {
  id: number;
  kind: string;
  title: string | null;
  subtitle: string | null;
  config: Record<string, unknown>;
  position: number;
  is_active: boolean;
}

export interface Setting {
  key: string;
  value: Record<string, unknown>;
  label: string;
  group: string;
}

export type ArStatus = "unavailable" | "processing" | "ready" | "failed" | "deprecated";

export interface ArValidation {
  ok: boolean;
  /** Blocking. Publishing is refused while any of these stand. */
  problems: string[];
  /** Worth knowing, but not blocking. */
  warnings: string[];
}

export interface ArAsset {
  id: number;
  product_id: number;
  product_name: string;
  status: ArStatus;
  model_url: string | null;
  ios_model_url: string | null;
  poster_url: string | null;
  real_width_mm: number | null;
  real_height_mm: number | null;
  real_depth_mm: number | null;
  scale_mode: "fixed" | "manual";
  placement: "floor" | "wall";
  version: number;
  validation_note: string | null;
  published_at: string | null;
  updated_at: string;
  /** The product's own dimensions, for comparing side by side. */
  product_width_mm: number | null;
  product_height_mm: number | null;
  product_depth_mm: number | null;
  validation: ArValidation | null;
}

export interface ArRow {
  product_id: number;
  product_name: string;
  product_slug: string;
  product_status: string;
  has_asset: boolean;
  status: ArStatus;
  version: number;
  has_glb: boolean;
  has_usdz: boolean;
  updated_at: string | null;
}

export interface ArReportRow {
  product_id: number;
  product_name: string;
  opened: number;
  added_to_cart: number;
  conversion_pct: number | null;
}

export interface AuditEntry {
  id: number;
  created_at: string;
  actor_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string | null;
  changes: Record<string, [unknown, unknown]> | null;
  ip_address: string | null;
  status: string;
}

export interface DashboardData {
  window_days: number;
  revenue: number;
  /** null when there is no previous period to compare against. */
  revenue_change_pct: number | null;
  orders: number;
  paid_orders: number;
  average_order_value: number;
  new_customers: number;
  series: { date: string; orders: number; revenue: number }[];
  queue: { pending: number; processing: number; packed: number };
  low_stock: { product_id: number; product_name: string; sku: string; stock: number }[];
  pending_reviews: number;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export const session = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: (): AdminUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AdminUser;
    } catch {
      // A corrupted blob must not white-screen the app on boot.
      return null;
    }
  },
  set(token: string, user: AdminUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setUser(user: AdminUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

/**
 * Does the signed-in user hold this permission?
 *
 * The cached list is what the server sent at sign-in. It is used to decide
 * what to *show*; the server decides what is *allowed*. Both matter - hiding
 * alone would be security by obscurity, and enforcing alone would leave staff
 * clicking buttons that always fail.
 */
export function can(permission: string): boolean {
  return session.user()?.permissions.includes(permission) ?? false;
}

export function canAny(...permissions: string[]): boolean {
  const held = session.user()?.permissions ?? [];
  return permissions.some((p) => held.includes(p));
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function qs(params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = session.token();
  const isFormData = init.body instanceof FormData;

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      // FormData sets its own Content-Type with a boundary; setting it here
      // would produce a body the server cannot parse.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && token) {
      session.clear();
      window.location.href = '/login';
    }

    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        // FastAPI validation errors: name the field, not just the rule.
        // "email: value is not a valid email address" is actionable;
        // "Request failed (422)" is not.
        message = body.detail
          .map((d: { loc?: unknown[]; msg?: string }) => {
            const field = (d.loc ?? []).filter((p) => p !== 'body').join('.');
            return field ? `${field}: ${d.msg}` : d.msg;
          })
          .join('; ');
      }
    } catch {
      /* keep the status-code fallback */
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const get = <T>(path: string, params?: Record<string, unknown>) =>
  request<T>(`${path}${qs(params)}`);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const api = {
  // --- Auth
  login: (email: string, password: string) =>
    post<{ access_token: string; expires_in: number; user: AdminUser }>('/auth/login', {
      email,
      password,
    }),
  me: () => get<AdminUser>('/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    post<{ message: string }>('/auth/change-password', { current_password, new_password }),
  permissionCatalogue: () => get<PermissionGroup[]>('/auth/permissions'),

  // --- Dashboard and reports
  dashboard: (days = 30) => get<DashboardData>('/dashboard', { days }),
  salesReport: (date_from: string, date_to: string, granularity = 'day') =>
    get<{ granularity: string; from: string; to: string; rows: { period: string; orders: number; revenue: number; discount: number; shipping: number; tax: number }[] }>(
      '/reports/sales',
      { date_from, date_to, granularity },
    ),
  topProducts: (date_from: string, date_to: string, limit = 20) =>
    get<{ product_id: number; name: string; units: number; revenue: number }[]>(
      '/reports/top-products',
      { date_from, date_to, limit },
    ),
  topCustomers: (date_from: string, date_to: string, limit = 20) =>
    get<{ customer_id: number; name: string | null; phone: string; orders: number; spend: number }[]>(
      '/reports/top-customers',
      { date_from, date_to, limit },
    ),
  inventoryReport: () =>
    get<{
      total_units: number;
      stock_value_at_cost: number;
      variants_without_cost: number;
      rows: { product_id: number; product_name: string; sku: string; stock: number; cost_price: number | null; price: number }[];
    }>('/reports/inventory'),

  // --- Products
  products: (params: Record<string, unknown>) => get<Paged<ProductRow>>('/products', params),
  product: (id: number) => get<ProductDetail>(`/products/${id}`),
  createProduct: (body: unknown) => post<ProductDetail>('/products', body),
  updateProduct: (id: number, body: unknown) => put<ProductDetail>(`/products/${id}`, body),
  setProductStatus: (id: number, value: string) =>
    post<{ message: string }>(`/products/${id}/status${qs({ value })}`),
  archiveProduct: (id: number) => del<{ message: string }>(`/products/${id}`),
  adjustStock: (rows: { variant_id: number; delta: number; reason: string; note?: string }[]) =>
    post<{ message: string }>('/products/stock', rows),

  // --- Taxonomy
  categories: () => get<CategoryNode[]>('/categories'),
  createCategory: (body: unknown) => post<Category>('/categories', body),
  updateCategory: (id: number, body: unknown) => put<Category>(`/categories/${id}`, body),
  deleteCategory: (id: number) => del<{ message: string }>(`/categories/${id}`),

  rooms: () => get<Room[]>('/rooms'),
  createRoom: (body: unknown) => post<Room>('/rooms', body),
  updateRoom: (id: number, body: unknown) => put<Room>(`/rooms/${id}`, body),
  deleteRoom: (id: number) => del<{ message: string }>(`/rooms/${id}`),

  brands: () => get<Brand[]>('/brands'),
  createBrand: (body: unknown) => post<Brand>('/brands', body),
  updateBrand: (id: number, body: unknown) => put<Brand>(`/brands/${id}`, body),
  deleteBrand: (id: number) => del<{ message: string }>(`/brands/${id}`),

  collections: () => get<Collection[]>('/collections'),
  createCollection: (body: unknown) => post<Collection>('/collections', body),
  updateCollection: (id: number, body: unknown) => put<Collection>(`/collections/${id}`, body),
  setCollectionProducts: (id: number, productIds: number[]) =>
    put<{ message: string }>(`/collections/${id}/products`, productIds),
  deleteCollection: (id: number) => del<{ message: string }>(`/collections/${id}`),

  attributes: (kind?: AttributeKind) => get<Attribute[]>('/attributes', { kind }),
  createAttribute: (body: unknown) => post<Attribute>('/attributes', body),
  updateAttribute: (id: number, body: unknown) => put<Attribute>(`/attributes/${id}`, body),
  deleteAttribute: (id: number) => del<{ message: string }>(`/attributes/${id}`),

  // --- Orders
  orders: (params: Record<string, unknown>) => get<Paged<OrderRow>>('/orders', params),
  orderQueues: () => get<Record<string, number>>('/orders/queues'),
  order: (id: number) => get<OrderDetail>(`/orders/${id}`),
  setOrderStatus: (id: number, status: string, note?: string, notify_customer = true) =>
    post<OrderDetail>(`/orders/${id}/status`, { status, note, notify_customer }),
  dispatchOrder: (id: number, body: unknown) => post<OrderDetail>(`/orders/${id}/dispatch`, body),
  cancelOrder: (id: number, reason: string, restock = true) =>
    post<OrderDetail>(`/orders/${id}/cancel`, { reason, restock }),
  refundOrder: (id: number, amount: string, reason: string) =>
    post<OrderDetail>(`/orders/${id}/refund`, { amount, reason }),
  addOrderNote: (id: number, note: string) => post<OrderDetail>(`/orders/${id}/note`, { note }),
  orderExportUrl: (params: Record<string, unknown>) => `${BASE}/orders/export${qs(params)}`,

  // --- Customers
  customers: (params: Record<string, unknown>) => get<Paged<Customer>>('/customers', params),
  customer: (id: number) =>
    get<{ customer: Customer; addresses: Record<string, unknown>[]; orders: OrderRow[] }>(
      `/customers/${id}`,
    ),
  setCustomerActive: (id: number, active: boolean) =>
    post<{ message: string }>(`/customers/${id}/status${qs({ active })}`),

  // --- Marketing
  coupons: () => get<Coupon[]>('/coupons'),
  createCoupon: (body: unknown) => post<Coupon>('/coupons', body),
  updateCoupon: (id: number, body: unknown) => put<Coupon>(`/coupons/${id}`, body),
  deactivateCoupon: (id: number) => del<{ message: string }>(`/coupons/${id}`),

  shippingRates: () => get<ShippingRate[]>('/shipping-rates'),
  createShippingRate: (body: unknown) => post<ShippingRate>('/shipping-rates', body),
  updateShippingRate: (id: number, body: unknown) => put<ShippingRate>(`/shipping-rates/${id}`, body),
  deleteShippingRate: (id: number) => del<{ message: string }>(`/shipping-rates/${id}`),

  reviews: (params: Record<string, unknown>) => get<Paged<Review>>('/reviews', params),
  moderateReview: (id: number, body: unknown) => put<Review>(`/reviews/${id}`, body),
  deleteReview: (id: number) => del<{ message: string }>(`/reviews/${id}`),

  // --- Content
  pages: () => get<Page[]>('/pages'),
  page: (slug: string) => get<Page>(`/pages/${slug}`),
  createPage: (body: unknown) => post<Page>('/pages', body),
  updatePage: (slug: string, body: unknown) => put<Page>(`/pages/${slug}`, body),
  deletePage: (slug: string) => del<{ message: string }>(`/pages/${slug}`),

  banners: (placement?: string) => get<Banner[]>('/banners', { placement }),
  createBanner: (body: unknown) => post<Banner>('/banners', body),
  updateBanner: (id: number, body: unknown) => put<Banner>(`/banners/${id}`, body),
  deleteBanner: (id: number) => del<{ message: string }>(`/banners/${id}`),

  homepage: () => get<HomepageSection[]>('/homepage'),
  saveHomepage: (sections: unknown[]) => put<HomepageSection[]>('/homepage', sections),

  settings: () => get<Setting[]>('/settings'),
  updateSetting: (key: string, value: Record<string, unknown>) =>
    put<Setting>(`/settings/${key}`, { value }),

  upload: async (file: File, folder = 'products') => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string; filename: string; content_type: string; size: number }>(
      `/uploads${qs({ folder })}`,
      { method: 'POST', body: form },
    );
  },

  // --- Staff and roles
  staff: (params: Record<string, unknown>) => get<Paged<Staff>>('/staff', params),
  createStaff: (body: unknown) => post<Staff>('/staff', body),
  updateStaff: (id: number, body: unknown) => put<Staff>(`/staff/${id}`, body),
  resetStaffPassword: (id: number, new_password: string) =>
    post<{ message: string }>(`/staff/${id}/reset-password`, { new_password }),
  deactivateStaff: (id: number) => del<{ message: string }>(`/staff/${id}`),

  roles: () => get<Role[]>('/roles'),
  createRole: (body: unknown) => post<Role>('/roles', body),
  updateRole: (id: number, body: unknown) => put<Role>(`/roles/${id}`, body),
  deleteRole: (id: number) => del<{ message: string }>(`/roles/${id}`),

  // --- AR
  arList: (params: Record<string, unknown>) => get<Paged<ArRow>>('/ar', params),
  arAsset: (productId: number) => get<ArAsset>(`/ar/${productId}`),
  saveArAsset: (productId: number, body: unknown) => put<ArAsset>(`/ar/${productId}`, body),
  uploadArFile: async (productId: number, file: File, kind: 'auto' | 'glb' | 'usdz' | 'poster' = 'auto') => {
    const form = new FormData();
    form.append('file', file);
    return request<ArAsset>(`/ar/${productId}/model${qs({ kind })}`, {
      method: 'POST',
      body: form,
    });
  },
  removeArFile: (productId: number, kind: 'glb' | 'usdz' | 'poster') =>
    del<ArAsset>(`/ar/${productId}/model${qs({ kind })}`),
  publishAr: (productId: number) => post<ArAsset>(`/ar/${productId}/publish`),
  unpublishAr: (productId: number) => post<ArAsset>(`/ar/${productId}/unpublish`),
  arReport: (days = 30) => get<ArReportRow[]>('/ar/report/summary', { days }),

  // --- Audit
  auditLogs: (params: Record<string, unknown>) => get<Paged<AuditEntry>>('/audit-logs', params),
};
