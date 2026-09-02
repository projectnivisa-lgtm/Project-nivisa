import { api } from "./client";
import {
  toProduct,
  toProductCard,
  type ApiProductCard,
  type ApiProductDetail,
} from "./adapters/productAdapter";
import type { Paginated, Product, ProductFilters, ProductSort } from "@/types/product";
import type { PincodeLookup } from "@/types/customer";
import type { Review } from "@/types/review";

/**
 * Catalogue API.
 *
 * Takes and returns furniture domain types. Every filter in `ProductFilters`
 * is now genuinely forwarded and genuinely applied — the backend supports the
 * facets the UI was architected for, so nothing is dropped on the way out and
 * no filter chip claims to be narrowing a grid it did not narrow.
 */

export interface Category {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  productCount: number;
  children?: Category[];
}

export interface Room {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
  isFeatured: boolean;
}

export interface FilterOptions {
  attributes: {
    material?: AttributeOption[];
    finish?: AttributeOption[];
    colour?: AttributeOption[];
    style?: AttributeOption[];
    upholstery?: AttributeOption[];
  };
  brands: Array<{ id: string; slug: string; name: string }>;
  price: { min: number; max: number };
}

export interface AttributeOption {
  id: string;
  slug: string;
  name: string;
  hexCode: string | null;
}

export interface SearchSuggestions {
  query: string;
  products: Array<{
    id: string;
    slug: string;
    name: string;
    imageUrl: string | null;
    price: number;
  }>;
  categories: Array<{ id: string; name: string; slug: string }>;
  brands: Array<{ id: string; name: string }>;
}

interface ApiPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

interface ApiCategoryNode {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  image_url: string | null;
  product_count: number;
  children: ApiCategoryNode[];
}

const DEFAULT_LIMIT = 24;

/** The sorts the API accepts. `discount` is not one of them. */
const SORTS: Record<ProductSort, string | null> = {
  newest: "newest",
  price_asc: "price_asc",
  price_desc: "price_desc",
  rating: "rating",
  // No discount sort exists. Clamped to the default rather than sent and
  // silently ignored, which would leave the chip lit over an unsorted grid.
  discount: null,
};

function page<T>(raw: ApiPage<unknown>, map: (item: never) => T): Paginated<T> {
  return {
    items: (raw.items as never[]).map(map),
    total: raw.total,
    limit: raw.limit,
    offset: raw.offset,
    hasMore: raw.has_more,
  };
}

function toCategory(node: ApiCategoryNode): Category {
  return {
    id: String(node.id),
    slug: node.slug,
    name: node.name,
    imageUrl: node.image_url,
    productCount: node.product_count,
    children: node.children?.length ? node.children.map(toCategory) : undefined,
  };
}

export const catalogApi = {
  /**
   * Product listing — one endpoint behind the shop, a category page, a room
   * page and search.
   *
   * `categoryId` in `ProductFilters` carries a *slug*, because that is what
   * the URL segment holds and what the API filters on. The field keeps its
   * name so no component or URL-state helper has to change.
   */
  async listProducts(
    filters: ProductFilters = {},
    limit = DEFAULT_LIMIT,
    offset = 0,
    signal?: AbortSignal,
  ): Promise<Paginated<Product>> {
    const params: Record<string, string | number | boolean | undefined> = {
      q: filters.query,
      category: filters.categoryId,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
      in_stock: filters.inStockOnly ? true : undefined,
      sort: filters.sort ? (SORTS[filters.sort] ?? undefined) : undefined,
      limit,
      offset,
    };

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    }

    // Repeatable parameters: the API reads several values per facet and ORs
    // them, so `material=oak&material=walnut` means "oak or walnut". A
    // comma-joined single value would be read as one attribute slug that
    // matches nothing.
    const repeated: Array<[string, string[] | undefined]> = [
      ["material", filters.material],
      ["colour", filters.colour],
      ["style", filters.style],
      ["room", filters.room],
    ];
    for (const [key, values] of repeated) {
      for (const value of values ?? []) search.append(key, value);
    }
    for (const seats of filters.seatingCapacity ?? []) {
      search.append("seats", String(seats));
    }

    const raw = await api.get<ApiPage<ApiProductCard>>(
      `/catalog/products?${search.toString()}`,
      { auth: false, signal },
    );
    return page(raw, toProductCard as (item: never) => Product);
  },

  async getProduct(slug: string): Promise<Product> {
    const raw = await api.get<ApiProductDetail>(
      `/catalog/products/${encodeURIComponent(slug)}`,
    );
    return toProduct(raw);
  },

  /** "More like this" — same category, excluding the piece itself. */
  async getSimilarProducts(slug: string, limit = 12): Promise<Product[]> {
    const raw = await api.get<ApiProductCard[]>(
      `/catalog/products/${encodeURIComponent(slug)}/related`,
      { auth: false, params: { limit } },
    );
    return (raw ?? []).map(toProductCard);
  },

  /**
   * A view is recorded by the product endpoint itself when a customer is
   * signed in, so there is nothing separate to fire. Kept as a no-op rather
   * than removed, so the PDP's effect does not need a conditional.
   */
  async trackView(): Promise<void> {
    /* recorded server-side by GET /catalog/products/{slug} */
  },

  async getRecentlyViewed(limit = 8): Promise<Product[]> {
    const raw = await api.get<ApiProductCard[]>("/account/recently-viewed", {
      params: { limit },
    });
    return (raw ?? []).map(toProductCard);
  },

  /** The full category tree, with counts. */
  async getCategories(): Promise<Category[]> {
    const raw = await api.get<ApiCategoryNode[]>("/catalog/categories", {
      auth: false,
      next: { revalidate: 300 },
    });
    return (raw ?? []).map(toCategory);
  },

  async getRooms(): Promise<Room[]> {
    const raw = await api.get<
      Array<{ id: number; slug: string; name: string; image_url: string | null }>
    >("/catalog/rooms", { auth: false, next: { revalidate: 300 } });
    return (raw ?? []).map((r) => ({
      id: String(r.id),
      slug: r.slug,
      name: r.name,
      imageUrl: r.image_url,
    }));
  },

  async getCollections(featuredOnly = false): Promise<Collection[]> {
    const raw = await api.get<
      Array<{
        id: number;
        slug: string;
        name: string;
        description: string | null;
        image_url: string | null;
        product_count: number;
        is_featured: boolean;
      }>
    >("/catalog/collections", {
      auth: false,
      params: { featured_only: featuredOnly || undefined },
      next: { revalidate: 300 },
    });
    return (raw ?? []).map((c) => ({
      id: String(c.id),
      slug: c.slug,
      name: c.name,
      description: c.description,
      imageUrl: c.image_url,
      productCount: c.product_count,
      isFeatured: c.is_featured,
    }));
  },

  /**
   * A collection's products.
   *
   * This is the product list narrowed by `collection`, not a separate
   * endpoint, so a collection page gets real totals, real paging and the same
   * filters every other listing has — none of which the old dedicated
   * endpoint could offer.
   */
  async getCollection(
    slug: string,
    limit = DEFAULT_LIMIT,
    offset = 0,
    query?: string,
  ): Promise<{ name: string; products: Paginated<Product> }> {
    const [collections, raw] = await Promise.all([
      this.getCollections(),
      api.get<ApiPage<ApiProductCard>>("/catalog/products", {
        auth: false,
        params: { collection: slug, q: query, limit, offset },
      }),
    ]);

    const match = collections.find((c) => c.slug === slug);
    // A retired campaign URL should 404, not render an empty grid under a
    // heading that implies the collection still exists.
    if (!match) {
      const error = new Error("No such collection");
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    return {
      name: match.name,
      products: page(raw, toProductCard as (item: never) => Product),
    };
  },

  /** Everything a filter panel needs, in one call. */
  async getFilterOptions(): Promise<FilterOptions> {
    const raw = await api.get<{
      attributes: Record<
        string,
        Array<{ id: number; slug: string; name: string; hex_code: string | null }>
      >;
      brands: Array<{ id: number; slug: string; name: string }>;
      price: { min: number; max: number };
    }>("/catalog/filters", { auth: false, next: { revalidate: 300 } });

    const attributes: FilterOptions["attributes"] = {};
    for (const [kind, values] of Object.entries(raw?.attributes ?? {})) {
      attributes[kind as keyof FilterOptions["attributes"]] = values.map((v) => ({
        id: String(v.id),
        slug: v.slug,
        name: v.name,
        hexCode: v.hex_code,
      }));
    }

    return {
      attributes,
      brands: (raw?.brands ?? []).map((b) => ({
        id: String(b.id),
        slug: b.slug,
        name: b.name,
      })),
      price: raw?.price ?? { min: 0, max: 0 },
    };
  },

  /**
   * Search suggestions.
   *
   * Built from the product list rather than a dedicated endpoint, because the
   * list already does substring matching over name, tagline and description.
   * A separate suggestions endpoint would be a second definition of "what
   * matches", and the two would drift.
   */
  async getSearchSuggestions(
    query: string,
    limit = 6,
    signal?: AbortSignal,
  ): Promise<SearchSuggestions> {
    const raw = await api.get<ApiPage<ApiProductCard>>("/catalog/products", {
      auth: false,
      params: { q: query, limit },
      signal,
    });

    const products = (raw?.items ?? []).map((item) => ({
      id: String(item.id),
      slug: item.slug,
      name: item.name,
      imageUrl: item.primary_image?.url ?? null,
      price: Number(item.price_from) || 0,
    }));

    // Categories and brands are derived from what actually matched, so every
    // suggestion leads somewhere with results in it.
    const categories = new Map<string, { id: string; name: string; slug: string }>();
    const brands = new Map<string, { id: string; name: string }>();
    for (const item of raw?.items ?? []) {
      if (item.category) {
        categories.set(item.category.slug, {
          id: String(item.category.id),
          name: item.category.name,
          slug: item.category.slug,
        });
      }
      if (item.brand) {
        brands.set(String(item.brand.id), {
          id: String(item.brand.id),
          name: item.brand.name,
        });
      }
    }

    return {
      query,
      products,
      categories: [...categories.values()],
      brands: [...brands.values()],
    };
  },

  /* ----------------------------------------------------------------- Wishlist */

  async getWishlist(): Promise<Product[]> {
    const raw = await api.get<ApiProductCard[]>("/account/wishlist");
    return (raw ?? []).map(toProductCard);
  },

  async addToWishlist(productId: string): Promise<void> {
    await api.post(`/account/wishlist/${encodeURIComponent(productId)}`);
  },

  async removeFromWishlist(productId: string): Promise<void> {
    await api.del(`/account/wishlist/${encodeURIComponent(productId)}`);
  },

  /* ------------------------------------------------------------------ Reviews */

  async listReviews(productId: string, limit = 20, offset = 0): Promise<Review[]> {
    const raw = await api.get<
      ApiPage<{
        id: number;
        rating: number;
        title: string | null;
        body: string | null;
        author_name: string;
        is_verified_purchase: boolean;
        created_at: string;
      }>
    >(`/products/${encodeURIComponent(productId)}/reviews`, {
      auth: false,
      params: { limit, offset },
    });

    return (raw?.items ?? []).map((r) => ({
      id: String(r.id),
      rating: r.rating,
      // Title and body are separate fields on the wire; the UI shows one
      // block, so they are joined here rather than in a component.
      comment: [r.title, r.body].filter(Boolean).join(" — ") || null,
      authorName: r.author_name,
      createdAt: r.created_at,
      isVerifiedPurchase: r.is_verified_purchase,
    }));
  },

  /**
   * The star distribution, as a server-side aggregate.
   *
   * Computed over every approved review, not just the page that happens to be
   * loaded — a client-side histogram silently describes only the first ten.
   */
  async getReviewSummary(productId: string): Promise<{
    average: number | null;
    count: number;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  }> {
    const raw = await api.get<{
      average: number | null;
      count: number;
      distribution: Record<string, number>;
    }>(`/products/${encodeURIComponent(productId)}/reviews/summary`, { auth: false });

    return {
      average: raw?.average ?? null,
      count: raw?.count ?? 0,
      distribution: {
        1: raw?.distribution?.["1"] ?? 0,
        2: raw?.distribution?.["2"] ?? 0,
        3: raw?.distribution?.["3"] ?? 0,
        4: raw?.distribution?.["4"] ?? 0,
        5: raw?.distribution?.["5"] ?? 0,
      },
    };
  },

  async submitReview(
    productId: string,
    input: { rating: number; comment?: string; authorName?: string },
  ): Promise<void> {
    await api.post(`/account/reviews/${encodeURIComponent(productId)}`, {
      rating: input.rating,
      body: input.comment,
      author_name: input.authorName,
    });
  },

  /* ------------------------------------------------------------------ Delivery */

  /**
   * Serviceability for a PIN code.
   *
   * Answers what a furniture buyer is actually asking — will you deliver,
   * when, and for how much — from the same shipping zones that will price the
   * order at checkout, so the estimate cannot disagree with the bill.
   *
   * City and state stay null: no PIN database backs this, and guessing a city
   * would put a wrong one under a customer's address. Resolves to null on any
   * failure so a lookup miss can never block a checkout.
   */
  async lookupPincode(pincode: string): Promise<PincodeLookup | null> {
    try {
      const raw = await api.get<{
        pincode: string;
        serviceable: boolean;
        zone: string | null;
        shipping_fee?: number;
        free_above?: number | null;
        estimated_days_min?: number | null;
        estimated_days_max?: number | null;
      }>(`/catalog/serviceability/${encodeURIComponent(pincode)}`, { auth: false });

      return {
        pincode,
        city: null,
        state: null,
        serviceable: raw.serviceable,
        zone: raw.zone,
        shippingFee: raw.shipping_fee ?? null,
        freeAbove: raw.free_above ?? null,
        estimatedDaysMin: raw.estimated_days_min ?? null,
        estimatedDaysMax: raw.estimated_days_max ?? null,
      };
    } catch {
      return null;
    }
  },
};
