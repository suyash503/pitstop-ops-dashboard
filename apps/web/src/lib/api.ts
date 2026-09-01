import type {
  BookingDetail,
  BookingListItem,
  CustomerListItem,
  DashboardResponse,
  LoginResponse,
  MechanicListItem,
  Paginated,
  ServiceItem,
} from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

const TOKEN_KEY = 'pitstop.token';

/**
 * The token lives in localStorage rather than an httpOnly cookie.
 *
 * The honest tradeoff: an httpOnly cookie would be safer against XSS, but the
 * API is on a different origin to the Vercel-hosted frontend, so cookie auth
 * would need SameSite=None with a shared parent domain and CSRF protection on
 * top. For an internal dashboard with a short-lived token, the header approach
 * is the simpler thing that is actually correct end to end. A production build
 * with a shared domain should switch.
 */
export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage disabled — the session simply will not persist a reload */
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to do */
    }
  },
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fired when the API rejects the token, so the app can bounce to /login. */
export const AUTH_EXPIRED_EVENT = 'pitstop:auth-expired';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401) {
    tokenStore.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  if (!res.ok) {
    // The API returns a consistent error envelope; fall back to the status text
    // if this is something else entirely (a proxy error page, say).
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Drops empty values so the query string only carries active filters. */
export function toQuery(params: Record<string, string | number | string[] | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<LoginResponse['user']>('/auth/me'),

  dashboard: (range: string) => request<DashboardResponse>(`/dashboard?range=${range}`),

  bookings: (params: Record<string, string | number | string[] | undefined>) =>
    request<Paginated<BookingListItem>>(`/bookings${toQuery(params)}`),

  booking: (id: string) => request<BookingDetail>(`/bookings/${id}`),

  updateBookingStatus: (id: string, status: string, note?: string) =>
    request<{ id: string; status: string }>(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),

  services: () => request<ServiceItem[]>('/services'),

  mechanics: (params: Record<string, string | number | undefined>) =>
    request<Paginated<MechanicListItem>>(`/mechanics${toQuery(params)}`),

  customers: (params: Record<string, string | number | undefined>) =>
    request<Paginated<CustomerListItem>>(`/customers${toQuery(params)}`),

  /**
   * CSV needs the auth header, so it cannot be a plain link. Fetch it as a blob
   * and hand it to a synthetic anchor.
   */
  async exportBookingsCsv(params: Record<string, string | number | string[] | undefined>) {
    const token = tokenStore.get();
    const res = await fetch(`${API_URL}/bookings/export${toQuery(params)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, 'Export failed');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pitstop-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
