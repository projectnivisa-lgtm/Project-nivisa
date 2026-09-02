import { api, tokens } from "./client";
import type { AuthSession, Customer } from "@/types/customer";

/**
 * OTP authentication.
 *
 * Browsing, search, the product page and the cart all work signed out. Login
 * is required only at checkout and in the account area — see `docs/DESIGN.md`
 * on why a furniture store that gates its catalogue behind a phone number
 * loses the customer before it ever earns the right to ask.
 */

export const authApi = {
  /**
   * Sends the six-digit code. The backend rate-limits per number and per
   * hour; surface its message rather than a generic failure.
   *
   * Returns `devCode` only when the API is running locally against the
   * console SMS provider, so a developer never has to read a log to sign in.
   * It is impossible for a staging or production API to populate it.
   */
  async requestOtp(phone: string): Promise<{ message: string; devCode: string | null }> {
    const raw = await api.post<{
      message: string;
      expires_in: number;
      dev_code: string | null;
    }>("/auth/otp/request", { phone }, { auth: false });
    return { message: raw.message, devCode: raw.dev_code ?? null };
  },

  /**
   * Verify and establish the session.
   *
   * The guest session token travels on this request so the backend can merge
   * an anonymous cart into the account. Once verification succeeds the guest
   * token is discarded — keeping it would leave a second, orphaned cart that
   * could later resurface and confuse the customer.
   */
  async verifyOtp(phone: string, otp: string): Promise<AuthSession> {
    const raw = await api.post<{
      access_token: string;
      expires_in: number;
      customer: {
        id: number;
        name: string | null;
        phone: string;
        email: string | null;
        created_at: string;
      };
    }>("/auth/otp/verify", { phone, code: otp }, { auth: false, withSession: true });

    const session: AuthSession = {
      accessToken: raw.access_token,
      // The API does not distinguish a first sign-in from a return visit, and
      // a missing name is the closest honest proxy: an account created by
      // this very request has none yet. Used only to choose a greeting.
      isNewAccount: raw.customer?.name == null,
      customer: {
        id: String(raw.customer?.id ?? ""),
        name: raw.customer?.name ?? null,
        phone: raw.customer?.phone ?? phone,
        email: raw.customer?.email ?? null,
      },
    };

    tokens.setAccess(session.accessToken);
    tokens.clearSession();
    return session;
  },

  signOut(): void {
    tokens.clearAll();
  },

  isAuthenticated(): boolean {
    return tokens.getAccess() !== null;
  },
};

export type { AuthSession, Customer };
