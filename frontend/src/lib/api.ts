import axios from 'axios';
import { supabase } from '@/lib/supabase/client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Module-level token (set by AuthContext) ────────────────────────────────
// El access token de Supabase vive en memoria y se inyecta como Bearer.
// Supabase gestiona la persistencia de la sesión y el auto-refresh.
let _accessToken: string | null = null;
let _onLogout: (() => void) | null = null;

export function setApiToken(token: string | null) {
  _accessToken = token;
}

// AuthContext registra qué hacer cuando el refresh vía Supabase falla
// (resetear el estado de auth; la navegación la resuelven los layouts de ruta).
export function setApiCallbacks(onLogout: () => void) {
  _onLogout = onLogout;
}

// ── Axios instance ─────────────────────────────────────────────────────────
// withCredentials se mantiene por compatibilidad; el refresh ya NO usa cookie
// httpOnly del backend — lo maneja el SDK de Supabase.
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

// ── Response: en 401 → pedir token fresco a Supabase y reintentar 1 vez ─────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Landing pública ("/") — no aplicar lógica de auth del interceptor.
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      return Promise.reject(error);
    }

    const original = error.config;

    // 403 MUST_CHANGE_PASSWORD → redirigir (inofensivo si el backend ya no lo emite).
    if (error.response?.status === 403 &&
        error.response?.data?.code === 'MUST_CHANGE_PASSWORD') {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/change-password';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;

      try {
        // getSession refresca el token si hace falta; si no cambió, forzamos refresh.
        let { data: { session } } = await supabase.auth.getSession();
        if (!session || session.access_token === _accessToken) {
          const refreshed = await supabase.auth.refreshSession();
          session = refreshed.data.session;
        }
        const token = session?.access_token;
        if (!token) throw new Error('Sin sesión de Supabase');

        _accessToken = token;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        // Solo resetea el estado de auth; la navegación la hacen los layouts.
        _onLogout?.();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
