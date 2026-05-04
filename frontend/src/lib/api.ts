import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Module-level token (set by AuthContext) ────────────────────────────────
let _accessToken: string | null = null;
let _onRefreshed: ((token: string) => void) | null = null;
let _onLogout: (() => void) | null = null;

export function setApiToken(token: string | null) {
  _accessToken = token;
}

export function setApiCallbacks(
  onRefreshed: (token: string) => void,
  onLogout: () => void,
) {
  _onRefreshed = onRefreshed;
  _onLogout = onLogout;
}

// Shared refresh: returns the in-flight promise if one exists, otherwise starts a new one
let _refreshResponsePromise: Promise<any> | null = null;
async function performRefresh(): Promise<any> {
  if (_refreshResponsePromise) return _refreshResponsePromise;
  _refreshResponsePromise = (async () => {
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/v1/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const newToken: string = data.access_token;
      _accessToken = newToken;
      _onRefreshed?.(newToken);
      return data;
    } finally {
      _refreshResponsePromise = null;
    }
  })();
  return _refreshResponsePromise;
}

export { performRefresh };

// ── Axios instance ─────────────────────────────────────────────────────────
// withCredentials: true is required so the browser sends the httpOnly
// cf_refresh_server cookie on cross-origin requests to the backend.
export const api = axios.create({
  baseURL:         BASE_URL,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Request: inject Bearer token ───────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// ── Response: handle 401 → try silent refresh via httpOnly cookie ──────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Public landing page — bypass ALL interceptor auth logic.
    // "/" has no auth dependency and must never be redirected.
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      return Promise.reject(error);
    }

    const original = error.config;

    // Intercept 403 MUST_CHANGE_PASSWORD → redirect
    if (error.response?.status === 403 &&
        error.response?.data?.code === 'MUST_CHANGE_PASSWORD') {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/change-password';
      }
      return Promise.reject(error);
    }

    // Avoid refresh loop when the 401 came from /auth/refresh itself
    if (error.response?.status === 401 && !original._retry &&
        !original.url?.includes('/auth/refresh')) {
      original._retry = true;

      try {
        // Shared in-flight refresh: all concurrent 401s await the same refresh
        const data = await performRefresh();
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        // _onLogout only resets auth state — it never navigates.
        // Navigation is handled by the protected-route layouts.
        _onLogout?.();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
