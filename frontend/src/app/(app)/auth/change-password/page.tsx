'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, AlertTriangle, CheckCircle } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-teal-600 text-white text-2xl font-bold mb-4 shadow-lg">
            SJ
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ContaSJ</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema Educativo Contable</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Warning banner */}
          <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Cambio de contraseña requerido</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Establece una contraseña personal para continuar. Ingresa tu nueva
                contraseña dos veces para confirmarla.
              </p>
            </div>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-lg font-semibold text-gray-800">¡Contraseña actualizada!</p>
              <p className="text-sm text-gray-500">Redirigiendo al inicio de sesión…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Lock className="w-5 h-5 text-teal-700" />
                Establecer nueva contraseña
              </h2>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    name="newPassword"
                    value={form.newPassword}
                    onChange={handleChange}
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm new password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="Repite la nueva contraseña"
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {isLoading ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} ContaSJ · Sistema Educativo Contable
        </p>
      </div>
    </div>
  );
}
