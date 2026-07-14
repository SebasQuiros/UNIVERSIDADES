'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { SceneWelcome } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Lock, AlertTriangle, CheckCircle2, ShieldCheck, KeyRound, AlertCircle,
} from 'lucide-react';

const TIPS = [
  { icon: ShieldCheck, label: 'Usa al menos 8 caracteres' },
  { icon: KeyRound,    label: 'Combina letras, números y símbolos' },
  { icon: Lock,        label: 'No reutilices la contraseña temporal' },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const { logout } = useAuth();

  const [form, setForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.newPassword !== form.confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      // El usuario logueado (o con sesión de recuperación de Supabase) cambia su
      // propia contraseña. updateUser usa la sesión activa, no la contraseña actual.
      const { error: sbError } = await supabase.auth.updateUser({
        password: form.newPassword,
      });
      if (sbError) throw sbError;
      setSuccess(true);
      toast.success('Contraseña actualizada');
      // Damos 2 segundos para ver el mensaje de éxito, luego logout → login
      setTimeout(async () => {
        await logout();
        router.replace('/login');
      }, 2000);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    'w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm bg-white transition-colors ' +
    'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500';

  return (
    <div className="min-h-screen flex" style={{ background: '#EFF6FF' }}>

      {/* ── Panel izquierdo: marca (solo desktop) ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #03080F 0%, #0F2657 60%, #1E3A8A 100%)' }}
      >
        <div className="lp-blob-bg" aria-hidden />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />

        {/* Logo + marca */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="w-10 h-10 rounded-[11px] overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: '#000', boxShadow: '0 0 20px rgba(59,130,246,0.4)' }}
          >
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
              Seguridad de tu cuenta
            </p>
            <p
              className="text-white font-extrabold leading-tight"
              style={{ fontSize: 'clamp(1.4rem,2.4vw,1.9rem)', letterSpacing: '-0.02em' }}
            >
              Una contraseña propia,{' '}
              <span style={{ color: '#93C5FD' }}>solo tuya.</span>
            </p>
          </div>

          <div className="flex justify-center lp-drift" aria-hidden>
            <SceneWelcome size={250} />
          </div>

          <div className="space-y-3">
            {TIPS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.22)', border: '1px solid rgba(96,165,250,0.2)' }}
                >
                  <Icon className="w-4 h-4" style={{ color: '#93C5FD' }} strokeWidth={1.9} />
                </div>
                <span className="text-white/80 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(184,134,11,0.28)', color: 'rgba(253,230,138,0.9)' }}
          >
            Tu contraseña se guarda cifrada
          </span>
          <span className="text-xs ml-auto" style={{ color: 'rgba(96,165,250,0.6)' }}>
            © {new Date().getFullYear()}
          </span>
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-sm">

          {/* Cabecera móvil */}
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
              <SceneWelcome size={170} />
            </div>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="cx-tada">
                <CheckCircle2 className="w-14 h-14 text-emerald-500" strokeWidth={1.6} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-900">Todo listo</p>
              <p className="text-xl font-extrabold text-gray-900">¡Contraseña actualizada!</p>
              <p className="text-sm text-gray-500">Te llevamos al inicio de sesión…</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-900 mb-1">
                  Cambio requerido
                </p>
                <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
                  Nueva contraseña
                </h2>
                <p className="text-gray-500 text-sm mt-1.5">
                  Establece una contraseña personal para continuar. Escríbela dos veces para confirmarla.
                </p>
              </div>

              {/* Aviso */}
              <div className="flex gap-3 p-3.5 bg-gold-50 border border-gold-100 rounded-xl mb-5">
                <AlertTriangle className="w-4 h-4 text-gold-700 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gold-900 leading-relaxed">
                  Por seguridad, la contraseña temporal deja de ser válida en cuanto guardes la nueva.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl cx-shake" role="alert">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Nueva contraseña */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showNew ? 'text' : 'password'}
                      name="newPassword"
                      value={form.newPassword}
                      onChange={handleChange}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                      aria-label={showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar contraseña */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirmar nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      required
                      autoComplete="new-password"
                      placeholder="Repite la nueva contraseña"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" size="lg" loading={isLoading} className="w-full mt-2 cx-press">
                  <Lock className="w-4 h-4" /> Cambiar contraseña
                </Button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            © {new Date().getFullYear()} ContaSJ · Sistema educativo contable
          </p>
        </div>
      </div>
    </div>
  );
}
