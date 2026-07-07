'use client';

import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, setApiToken, setApiCallbacks } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@/types';

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
// Auth = Supabase. El access token vive en memoria (inyectado como Bearer por
// lib/api). Supabase persiste la sesión y auto-refresca el token; el perfil de
// la app (rol, universityId) se trae del backend con GET /api/v1/auth/me.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
  });

  // ── Perfil de la app (rol real) desde el backend ────────────────────────
  const fetchProfile = useCallback(async (): Promise<User> => {
    const { data } = await api.get<User>('/api/v1/auth/me');
    return data;
  }, []);

  // ── setToken: actualiza token en memoria + (opcional) el usuario ─────────
  // Lo usa ProfilePage tras editar el perfil. Supabase ya gestiona el refresh,
  // así que aquí no reprogramamos nada.
  const setToken = useCallback((token: string, user?: User) => {
    setApiToken(token);
    setState((prev) => ({
      ...prev,
      accessToken: token,
      user: user ?? prev.user,
      isLoading: false,
    }));
  }, []);

  // ── Callback para el interceptor axios: reset de estado (sin navegar) ────
  // La protección de rutas la resuelve cada layout (redirect si !user).
  useEffect(() => {
    setApiCallbacks(() => {
      setApiToken(null);
      setState({ user: null, accessToken: null, isLoading: false });
    });
  }, []);

  // ── Bootstrap: leer sesión de Supabase + suscribirse a cambios de auth ───
  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;

      if (session?.access_token) {
        setApiToken(session.access_token);
        try {
          const profile = await fetchProfile();
          if (!active) return;
          setState({ user: profile, accessToken: session.access_token, isLoading: false });
        } catch {
          if (!active) return;
          setState({ user: null, accessToken: null, isLoading: false });
        }
      } else {
        setState({ user: null, accessToken: null, isLoading: false });
      }
    })();

    // Supabase auto-refresca el token: aquí solo sincronizamos el estado.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'SIGNED_OUT' || !session) {
        setApiToken(null);
        setState({ user: null, accessToken: null, isLoading: false });
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setApiToken(session.access_token);
        setState((prev) => ({ ...prev, accessToken: session.access_token }));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error; // el form muestra el mensaje

    const session = data.session;
    if (!session?.access_token) throw new Error('No se pudo iniciar sesión');

    setApiToken(session.access_token);
    const profile = await fetchProfile();
    setState({ user: profile, accessToken: session.access_token, isLoading: false });
    return profile;
  }, [fetchProfile]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch { /* ignore */ }
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
