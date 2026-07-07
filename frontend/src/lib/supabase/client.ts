import { createBrowserClient } from '@supabase/ssr';

// ── Cliente de Supabase para el navegador (singleton) ──────────────────────
// El SDK persiste la sesión (localStorage) y auto-refresca el access token.
// Usamos la publishable key: es segura para el cliente.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
