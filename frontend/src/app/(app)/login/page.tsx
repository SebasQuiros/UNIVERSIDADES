'use client';

import { useState, FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageSpinner } from '@/components/ui/Spinner';
import { getErrorMessage } from '@/lib/utils';
import { Mail, Lock, BookOpen, TrendingUp, FileText, AlertCircle } from 'lucide-react';

/**
 * Tres cosas, con nombre y explicación. Antes eran cuatro etiquetas sueltas
 * junto a un personaje de ilustración genérica; se cambió por texto que dice
 * algo, que es lo que mira de verdad quien entra por primera vez.
 */
const FEATURES = [
  {
    icon: BookOpen,
    titulo: 'Práctica contable interactiva',
    bajada: 'Ejercicios y casos reales, paso a paso.',
  },
  {
    icon: TrendingUp,
    titulo: 'Partida doble y estados financieros',
    bajada: 'Desde el registro hasta el análisis.',
  },
  {
    icon: FileText,
    titulo: 'Normativa contable costarricense',
    bajada: 'Facturación Hacienda v4.4, IVA y NIIF.',
  },
];

const ROLE_REDIRECT: Record<string, string> = {
  STUDENT: '/estudiante', TEACHER: '/profesor',
  ADMIN: '/admin', SUPERADMIN: '/superadmin',
};

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && user) router.replace(ROLE_REDIRECT[user.role] ?? '/');
  }, [user, isLoading, router]);

  // ── Acceso rápido a cuentas de prueba vía URL secreta ────────────────────
  // ?demo=<token>&as=admin|profesor|estudiante1|estudiante2 — sin token
  // correcto (server-side, nunca en este código) el backend responde 404 y
  // acá simplemente no pasa nada. Ningún botón visible, ninguna contraseña
  // en el código — ver backend auth.controller.ts → demo-login.
  useEffect(() => {
    const token = searchParams.get('demo');
    const as = searchParams.get('as');
    if (!token || !as || isLoading || user) return;

    (async () => {
      setDemoLoading(true);
      try {
        const { data } = await api.post<{ email: string; hashedToken: string }>(
          '/api/v1/auth/demo-login',
          { token, as },
        );
        // supabase.auth.verifyOtp() con token_hash no completó de forma
        // confiable en pruebas — canjeamos el magic-link directo contra el
        // endpoint REST de Supabase y luego hidratamos el cliente con
        // setSession(), que sí dispara onAuthStateChange('SIGNED_IN') normal.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
        const res = await fetch(`${supabaseUrl}/auth/v1/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: supabaseKey },
          body: JSON.stringify({ type: 'magiclink', token_hash: data.hashedToken }),
        });
        if (!res.ok) throw new Error('Enlace inválido o expirado');
        const session = await res.json();
        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (error) throw error;
        // AuthContext detecta el SIGNED_IN vía onAuthStateChange; solo hace
        // falta esperar a que resuelva el perfil para redirigir por rol.
      } catch {
        setDemoLoading(false);
        setLoginError('Acceso rápido inválido o expirado.');
      }
    })();
  }, [searchParams, isLoading, user]);

  if (demoLoading && !user) {
    return <PageSpinner />;
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) { setLoginError('Ingresa tu correo y contraseña'); return; }
    setLoginError('');
    setLoginLoading(true);
    try {
      const u = await login(email.trim().toLowerCase(), password);
      sessionStorage.setItem('welcomeName', u.name.split(' ')[0]);
      router.push(ROLE_REDIRECT[u.role] ?? '/');
    } catch (err) {
      const msg = getErrorMessage(err);
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  }

  // Evita el parpadeo del formulario mientras se resuelve la sesión existente
  if (isLoading) return <PageSpinner />;

  return (
    <div className="min-h-screen flex" style={{ background: '#EFF6FF' }}>

      {/* ── Panel izquierdo: marca (solo escritorio) ── */}
      {/*
        Se quitó la ilustración de personaje: era exactamente el tipo de
        imagen genérica que hace que un producto parezca una plantilla. En su
        lugar, tipografía con jerarquía y tres afirmaciones concretas. El
        fondo es una retícula de puntos y una curva sobria — nada que compita
        con el texto ni que parezca decoración de relleno.
      */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ background: 'linear-gradient(160deg, #03080F 0%, #0F2657 58%, #16306B 100%)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        {/* Curva ascendente: alude a un gráfico sin dibujar uno de adorno. */}
        <svg
          aria-hidden
          viewBox="0 0 600 400"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ opacity: 0.5 }}
        >
          <defs>
            <linearGradient id="loginCurva" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="0" />
              <stop offset="55%" stopColor="#60A5FA" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path d="M-20 360 C 140 330, 240 250, 340 190 S 520 70, 620 20"
                fill="none" stroke="url(#loginCurva)" strokeWidth="1.6" />
        </svg>

        {/* Marca */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
            style={{ background: '#FFFFFF' }}
          >
            <Image src="/sjqa-logo.png" alt="ContaSJ" width={44} height={44} priority className="h-11 w-11 object-cover" />
          </div>
          <div>
            <h1 className="text-2xl font-black leading-none tracking-tight text-white">
              Conta<span style={{ color: '#60A5FA' }}>SJ</span>
            </h1>
            <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Plataforma educativa · Costa Rica
            </p>
          </div>
        </div>

        {/* Mensaje */}
        <div className="lp-in lp-in-d2 relative z-10">
          <div className="mb-4 flex items-center gap-3">
            <span style={{ display: 'block', width: 26, height: 2, background: '#FBBF24' }} />
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Aprendé contabilidad
            </span>
          </div>

          <p
            className="font-extrabold leading-[1.08] text-white"
            style={{ fontSize: 'clamp(1.9rem,3.4vw,2.9rem)', letterSpacing: '-0.03em' }}
          >
            Aprendé contabilidad
            <br />
            <span style={{ color: '#60A5FA' }}>haciendo</span>
            <span style={{ color: '#FBBF24' }}>.</span>
          </p>

          <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
            Practicá con una empresa simulada, registrá operaciones reales y entendé
            cómo cada decisión impacta los estados financieros.
          </p>

          <div className="mt-9 space-y-5">
            {FEATURES.map(({ icon: Icon, titulo, bajada }) => (
              <div key={titulo} className="flex items-start gap-3.5">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(59,130,246,0.16)', border: '1px solid rgba(96,165,250,0.22)' }}
                >
                  <Icon className="h-4 w-4" style={{ color: '#93C5FD' }} strokeWidth={1.9} />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.92rem] font-bold leading-snug text-white">{titulo}</p>
                  <p className="text-[0.8rem]" style={{ color: 'rgba(255,255,255,0.5)' }}>{bajada}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pie del panel */}
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}
          >
            {/* Bandera de Costa Rica, en tres franjas */}
            <span aria-hidden style={{ display: 'inline-flex', flexDirection: 'column', width: 15, height: 11, borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
              <span style={{ flex: 1, background: '#002B7F' }} />
              <span style={{ flex: 1.3, background: '#CE1126' }} />
              <span style={{ flex: 1, background: '#FFFFFF' }} />
            </span>
            Normativa costarricense · Hacienda v4.4 · NIIF
          </span>
          <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            SJQA GROUP · {new Date().getFullYear()}
          </span>
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-sm">

          {/* Cabecera móvil: logo + ilustración reducida */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-[10px] overflow-hidden flex items-center justify-center" style={{ background: '#000' }}>
                <Image src="/sjqa-logo.png" alt="ContaSJ" width={36} height={36} className="w-9 h-9 object-contain" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">
                <span style={{ color: '#2563EB' }}>ContaSJ</span>
              </h1>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Aprendé contabilidad <span className="font-semibold text-gray-700">haciendo</span>.
            </p>
          </div>

          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-900 mb-1">Acceso institucional</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Bienvenido</h2>
            <p className="text-gray-500 text-sm mt-1.5">Ingresa con tu correo institucional para continuar.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Correo institucional"
              type="email"
              placeholder="usuario@universidad.ac.cr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              autoFocus
            />
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              autoComplete="current-password"
            />

            {loginError && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl" role="alert">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{loginError}</p>
              </div>
            )}

            <Button type="submit" size="lg" loading={loginLoading} className="w-full mt-2">
              Iniciar sesión
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            ¿Olvidaste tu contraseña? Contacta a tu administrador institucional.
          </p>
        </div>
      </div>
    </div>
  );
}
