import { customerUrl } from "@/config/env";

/**
 * The single HTTP boundary for the whole application.
 *
 * Nothing outside `src/api` may call `fetch`. Everything that talks to the
 * backend goes through `api.get/post/put/del`, which means auth headers, the
 * guest session token, error normalisation and timeouts are implemented once
 * and cannot be forgotten at a call site.
 */

/* -------------------------------------------------------------------------
   Errors
   ------------------------------------------------------------------------- */

/**
 * A normalised API failure. Every rejection from this module is an ApiError,
 * so UI code never has to guess whether it caught a TypeError from the network
 * stack, a JSON parse failure, or a real 4xx from the backend.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Backend correlation id from a masked 500. Show it in support copy. */
  readonly errorId?: string;
  readonly kind:
    | "network" // request never completed — offline, DNS, CORS
    | "timeout"
    | "unauthorized" // 401 — token missing or expired
    | "forbidden" // 403
    | "notFound" // 404
    | "validation" // 422
    | "conflict" // 409
    | "server" // 5xx
    | "unknown";

  constructor(
    message: string,
    status: number,
    kind: ApiError["kind"],
    errorId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.errorId = errorId;
  }

  /**
   * Whether retrying the identical request could plausibly succeed. Used by
   * the query layer to decide on automatic retries, and by error states to
   * decide whether to offer a "Try again" button.
   */
  get isRetryable(): boolean {
    return (
      this.kind === "network" || this.kind === "timeout" || this.kind === "server"
    );
  }
}

function kindForStatus(status: number): ApiError["kind"] {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

/**
 * The backend returns `{"detail": "..."}` for handled errors and
 * `{"detail": [...]}` for FastAPI validation errors. Flatten both into one
 * human-readable string; never surface a raw JSON blob to a customer.
 */
function messageFromBody(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && "msg" in first) {
        return String((first as { msg: unknown }).msg);
      }
      return "Please check the details you entered.";
    }
  }
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  return "That did not work. Please try again.";
}

/* -------------------------------------------------------------------------
   Auth + guest session
   -------------------------------------------------------------------------
   Tokens live in localStorage rather than a cookie because the backend takes
   a Bearer header, not a session cookie — there is no CSRF surface to protect
   and no server-side rendering of authenticated data. Reads are guarded so
   this module stays importable from server components. */

const ACCESS_TOKEN_KEY = "nivisa.accessToken";
const SESSION_TOKEN_KEY = "nivisa.cartToken";

const isBrowser = typeof window !== "undefined";

function read(key: string): string | null {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Safari private mode and hardened browser settings throw on access.
    return null;
  }
}

function write(key: string, value: string | null): void {
  if (!isBrowser) return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* Storage unavailable — the session degrades to in-memory only. */
  }
}

export const tokens = {
  getAccess: () => read(ACCESS_TOKEN_KEY),
  setAccess: (t: string | null) => write(ACCESS_TOKEN_KEY, t),

  /**
   * The guest cart token. Generated lazily on first use so an anonymous
   * visitor can build a cart before they ever see a login screen; it is sent
   * as `x-session-token` and the backend merges that cart into the account on
   * OTP verification.
   */
  getSession(): string | null {
    const existing = read(SESSION_TOKEN_KEY);
    if (existing) return existing;
    if (!isBrowser) return null;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    write(SESSION_TOKEN_KEY, fresh);
    return fresh;
  },

  /** Called after OTP verification: the guest cart has been absorbed. */
  clearSession: () => write(SESSION_TOKEN_KEY, null),

  clearAll() {
    write(ACCESS_TOKEN_KEY, null);
    write(SESSION_TOKEN_KEY, null);
  },
};

/* -------------------------------------------------------------------------
   Unauthorized handling
   ------------------------------------------------------------------------- */

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Registered once by the auth provider. Lets a 401 anywhere in the app clear
 * the session and bounce to login, without every hook re-implementing it.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

/* -------------------------------------------------------------------------
   Request
   ------------------------------------------------------------------------- */

export interface RequestOptions {
  /** Query string values. `undefined` and `null` entries are dropped. */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Send the customer bearer token. Default true when one exists. */
  auth?: boolean;
  /** Send the guest `X-Cart-Token` header. Cart and auth endpoints only. */
  withSession?: boolean;
  signal?: AbortSignal;
  /** Milliseconds before the request is aborted. Default 20s. */
  timeoutMs?: number;
  /** Next.js fetch cache options, for server-side calls. */
  next?: { revalidate?: number; tags?: string[] };
  cache?: RequestCache;
}

function buildQuery(params: RequestOptions["params"]): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const {
    params,
    auth = true,
    withSession = false,
    signal,
    timeoutMs = 20_000,
    next,
    cache,
  } = options;

  const url = customerUrl(path) + buildQuery(params);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = tokens.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (withSession) {
    // The backend reads this header to find an anonymous visitor's cart, and
    // merges that cart into the account on OTP verification.
    const session = tokens.getSession();
    if (session) headers["X-Cart-Token"] = session;
  }

  // Own timeout, composed with any caller-supplied signal, so a hung request
  // surfaces as a real error state instead of an eternal skeleton.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache,
      ...(next ? { next } : {}),
    });
  } catch (cause) {
    clearTimeout(timer);
    if (controller.signal.reason === "timeout") {
      throw new ApiError("That took too long. Please try again.", 0, "timeout");
    }
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause; // A deliberate caller-side cancellation, not a failure.
    }
    throw new ApiError(
      "We could not reach the server. Check your connection and try again.",
      0,
      "network",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // A non-JSON body from a proxy or gateway, e.g. an HTML 502 page.
      if (!response.ok) {
        throw new ApiError(
          "Something went wrong on our end. Please try again.",
          response.status,
          kindForStatus(response.status),
        );
      }
      return undefined as T;
    }
  }

  if (!response.ok) {
    const kind = kindForStatus(response.status);
    if (kind === "unauthorized") {
      tokens.setAccess(null);
      onUnauthorized?.();
    }
    const errorId =
      parsed && typeof parsed === "object" && "error_id" in parsed
        ? String((parsed as { error_id: unknown }).error_id)
        : undefined;
    throw new ApiError(
      messageFromBody(parsed, response.status),
      response.status,
      kind,
      errorId,
    );
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  del: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
};
