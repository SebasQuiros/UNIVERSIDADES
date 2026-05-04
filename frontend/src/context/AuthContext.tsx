'use client';

import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, setApiToken, setApiCallbacks, performRefresh } from '@/lib/api';
import { getTokenExpiry } from '@/lib/utils';
import type { User, AuthResponse } from '@/types';

// ── Context types ──────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setToken: (token: string, user?: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
  });
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Schedule auto-refresh 60s before token expires ──────────────────────
  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expiry = getTokenExpiry(token);
    const delay  = expiry - Date.now() - 60_000; // 60s before expiry
    if (delay <= 0) {
      doRefresh();
      return;
    }
    refreshTimerRef.current = setTimeout(doRefresh, delay);
  }, []);

  // ── Token refresh ────────────────────────────────────────────────────────
  // Uses shared `performRefresh` from lib/api so concurrent refreshes
  // (timer + interceptor + StrictMode double-mount) dedupe to ONE network call.
  const doRefresh = useCallback(async () => {
    try {
      const data = await performRefresh();
      applyAuth(data as AuthResponse);
    } catch {
      setState({ user: null, accessToken: null, isLoading: false });
    }
  }, []);

  // ── Apply auth data (access token + user state) ──────────────────────────
  // refresh_token is now an httpOnly cookie set by the server — never touches JS
  const applyAuth = useCallback((data: AuthResponse) => {
    setApiToken(data.access_token);
    setState({ user: data.user, accessToken: data.access_token, isLoading: false });
    scheduleRefresh(data.access_token);
  }, [scheduleRefresh]);

  const setToken = useCallback((token: string, user?: User) => {
    setApiToken(token);
    setState((prev) => ({
      ...prev,
      accessToken: token,
      user: user ?? prev.user,
      isLoading: false,
    }));
    scheduleRefresh(token);
  }, [scheduleRefresh]);

  // ── Register callbacks for axios interceptor ─────────────────────────────
  useEffect(() => {
    setApiCallbacks(
      (newToken) => setToken(newToken),
      () => {
        // Reset auth state only. Do NOT call router.push here.
        //
        // Route protection is handled by each layout:
        //   /estudiante/layout.tsx  → redirects if !user
        //   /profesor/layout.tsx    → redirects if !user
        //   /admin/layout.tsx       → redirects if !user
        //   /superadmin/layout.tsx  → redirects if !user
        //
        // The root "/" and "/login" have no auth layout, so they are
        // naturally never redirected — this is exactly what we want.
        setState({ user: null, accessToken: null, isLoading: false });
      },
    );
  }, [setToken]);

  // ── Bootstrap: attempt silent refresh on mount ───────────────────────────
  // The httpOnly cookie (if present) will be sent automatically.
  // If no valid session → 401 → catch → isLoading = false.
  //
  // Exception: on "/" (the public landing page) we skip the refresh call
  // entirely. The intro screen has zero auth dependency and we must never
  // trigger an API call or state changes that could cause a redirect there.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }
    doRefresh();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { data } = await api.post<AuthResponse>('/api/v1/auth/login', {
      email, password,
    });
    applyAuth(data);
    // If the account requires a password change, redirect immediately
    if (data.mustChangePassword) {
      router.replace('/auth/change-password');
    }
    return data.user;
  }, [applyAuth, router]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch { /* ignore */ }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setApiToken(null);
    setState({ user: null, accessToken: null, isLoading: false });
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
