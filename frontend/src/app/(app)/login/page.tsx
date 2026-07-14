'use client';

import { useState, FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageSpinner } from '@/components/ui/Spinner';
import { SceneWelcome } from '@/components/illustrations';
import { getErrorMessage } from '@/lib/utils';
import { Mail, Lock, BookOpen, TrendingUp, FileText, Award, AlertCircle, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  { icon: BookOpen,   label: 'Ejercicios contables interactivos' },
  { icon: FileText,   label: 'Facturación electrónica CR (Hacienda v4.4)' },
  { icon: TrendingUp, label: 'Motor contable de doble entrada' },
  { icon: Award,      label: 'Calificación automática con rúbricas' },
];

const ROLE_REDIRECT: Record<string, string> = {
  STUDENT: '/estudiante', TEACHER: '/profesor',
  ADMIN: '/admin', SUPERADMIN: '/superadmin',
};

const DEMO_CREDENTIALS = [
  { label: 'Admin',         email: 'admin@contafacil.cr',       password: 'Admin2026!',         color: '#7C3AED' },
  { label: 'Profesor',      email: 'profesor@contafacil.cr',    password: 'Profesor2026!',      color: '#0369A1' },
  { label: 'Estudiante 1',  email: 'estudiante1@contafacil.cr', password: 'Estudiante1-2026!',  color: '#065F46' },
  { label: 'Estudiante 2',  email: 'estudiante2@contafacil.cr', password: 'Estudiante2-2026!',  color: '#065F46' },
];

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && user) router.replace(ROLE_REDIRECT[user.role] ?? '/');
  }, [user, isLoading, router]);

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

      {/* ── Panel izquierdo: branding (solo desktop) ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #03080F 0%, #0F2657 60%, #1E3A8A 100%)' }}
      >
        {/* Textura de blobs sutiles */}
        <div className="lp-blob-bg" aria-hidden />
        {/* Retícula de puntos */}
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

        {/* Logo + marca */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-[11px] overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: '#000', boxShadow: '0 0 20px rgba(59,130,246,0.4)' }}>
            <Image src="/sjqa-logo.png" alt="ContaSJ" width={40} height={40} priority className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: '#60A5FA' }}>
              ContaSJ
            </h1>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] mt-1" style={{ color: '#FBBF24' }}>
              Plataforma educativa · Costa Rica
            </p>
          </div>
        </div>

        {/* Contenido central */}
        <div className="relative z-10 space-y-8 lp-in lp-in-d2">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: '#FBBF24' }}>
              Aprende contabilidad
            </p>
            <p className="text-white font-extrabold leading-tight" style={{ fontSize: 'clamp(1.4rem,2.4vw,1.9rem)', letterSpacing: '-0.02em' }}>
              Aprende contabilidad haciendo,{' '}
              <span style={{ color: '#93C5FD' }}>no solo leyendo.</span>
            </p>
          </div>

          {/* Escena de personaje */}
          <div className="flex justify-center lp-drift" aria-hidden>
            <SceneWelcome size={260} />
          </div>

          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.22)', border: '1px solid rgba(96,165,250,0.2)' }}>
                  <Icon className="w-4 h-4" style={{ color: '#93C5FD' }} strokeWidth={1.9} />
                </div>
                <span className="text-white/80 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(184,134,11,0.28)', color: 'rgba(253,230,138,0.9)' }}>
            IVA 13% · Hacienda v4.4 · NIIF PYMES
          </span>
          <span className="text-xs ml-auto" style={{ color: 'rgba(96,165,250,0.6)' }}>© 2026</span>
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
            <div className="flex justify-center">
              <SceneWelcome size={180} />
            </div>
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

          {/* ── Credenciales de prueba — acceso rápido para revisión ── */}
          <div className="mt-6 p-3 rounded-xl border border-dashed border-gray-200 bg-gray-50">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Usuarios de prueba — clic para autocompletar
            </p>
            <div className="space-y-1.5">
              {DEMO_CREDENTIALS.map(({ label, email: e, password: p, color }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setEmail(e);
                    setPassword(p);
                    setLoginError('');
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <span className="text-xs font-medium" style={{ color }}>{label}</span>
                  <span className="text-xs text-gray-400 font-mono group-hover:text-gray-600 truncate ml-2">{e}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            ¿Olvidaste tu contraseña? Contacta a tu administrador institucional.
          </p>
        </div>
      </div>
    </div>
  );
}
