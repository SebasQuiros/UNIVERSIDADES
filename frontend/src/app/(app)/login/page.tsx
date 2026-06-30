'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import { Mail, Lock, BookOpen, TrendingUp, FileText, Award } from 'lucide-react';
import toast from 'react-hot-toast';

const FEATURES = [
  { icon: BookOpen,   label: 'Ejercicios contables interactivos' },
  { icon: FileText,   label: 'Facturación electrónica CR (Hacienda v4.3)' },
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
      // mustChangePassword redirect is handled inside AuthContext.login()
      if (!(u as any).mustChangePassword) {
        sessionStorage.setItem('welcomeName', u.name.split(' ')[0]);
        router.push(ROLE_REDIRECT[u.role] ?? '/');
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#EFF6FF' }}>

      {/* ── Left panel: branding (desktop only) ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #03080F 0%, #0F2657 60%, #1E3A8A 100%)' }}
      >
        {/* Glow decorativo */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(59,130,246,0.15) 0%,transparent 70%)', filter: 'blur(60px)' }}
        />

        <div className="flex items-center gap-3 relative">
          <img
            src="/FOTO.png.png"
            alt="ContaSJ"
            className="w-10 h-10 rounded-xl"
            style={{ boxShadow: '0 0 20px rgba(59,130,246,0.5)' }}
          />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight leading-none">
              <span style={{ color: '#60A5FA' }}>ContaSJ</span>
            </h1>
            <p style={{ color: '#60A5FA' }} className="text-xs mt-0.5">
              Plataforma SaaS Educativa · Costa Rica
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-white font-medium text-lg mb-6">
              Aprende contabilidad haciendo,<br />
              <span style={{ color: '#93c5fd' }}>no solo leyendo.</span>
            </p>
            <div className="space-y-4">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(59,130,246,0.25)' }}
                  >
                    <Icon className="w-4 h-4" style={{ color: '#93c5fd' }} />
                  </div>
                  <span className="text-white/80 text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div
            className="p-4 rounded-2xl border"
            style={{ background: 'rgba(10,37,64,0.6)', borderColor: 'rgba(59,130,246,0.3)' }}
          >
            <p className="text-xs font-mono" style={{ color: '#93c5fd' }}>
              Costa Rica · IVA 13% · Hacienda v4.3 · NestJS + Next.js 14
            </p>
          </div>
        </div>

        <p className="text-xs" style={{ color: '#3B82F6' }}>Sebastián Quirós Arroyo © 2026</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-1">
              <img src="/FOTO.png.png" alt="ContaSJ" className="w-9 h-9 rounded-xl" />
              <h1 className="text-2xl font-bold">
                <span style={{ color: '#3B82F6' }}>ContaSJ</span>
              </h1>
            </div>
            <p className="text-gray-500 text-xs">Plataforma Educativa Contable</p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Bienvenido</h2>
            <p className="text-gray-500 text-sm mt-1">Acceso institucional</p>
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
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{loginError}</p>
              </div>
            )}

            <Button type="submit" size="lg" loading={loginLoading} className="w-full mt-2">
              Iniciar sesión
            </Button>
          </form>

          {/* ── Demo credentials — acceso rápido para revisión ── */}
          <div className="mt-6 p-3 rounded-xl border border-dashed border-gray-200 bg-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
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
