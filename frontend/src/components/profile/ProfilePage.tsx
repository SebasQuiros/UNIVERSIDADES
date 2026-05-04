'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { User, Mail, Lock, Shield, Building2, Camera, Eye, EyeOff, CheckCircle } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  STUDENT:    'Estudiante',
  TEACHER:    'Profesor',
  ADMIN:      'Administrador',
  SUPERADMIN: 'Super Administrador',
};

export function ProfilePage() {
  const { user, setToken, accessToken } = useAuth();

  // ── Profile form ──────────────────────────────────────────────
  const [name, setName]             = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl]   = useState(user?.avatarUrl ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Password form ─────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 3) {
      toast.error('El nombre debe tener al menos 3 caracteres');
      return;
    }
    setSavingProfile(true);
    try {
      const { data: updated } = await api.patch('/api/v1/auth/me', {
        name:      name.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      setToken(accessToken!, updated);
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/api/v1/auth/change-password', { currentPassword, newPassword });
      toast.success('Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Mi Perfil</h2>
        <p className="text-gray-500 text-sm mt-1">Administra tu información personal y seguridad</p>
      </div>

      {/* Avatar + info card */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-gray-200"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-lg truncate">{user.name}</h3>
            <p className="text-gray-500 text-sm truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3" />
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {user.universityId && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  <Building2 className="w-3 h-3" />
                  Universidad asignada
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile form */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600" />
          Información personal
        </h3>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={<User className="w-4 h-4" />}
            placeholder="Tu nombre completo"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-sm">
              <Mail className="w-4 h-4 text-gray-400" />
              {user.email}
            </div>
            <p className="text-xs text-gray-400 mt-1">El correo no se puede cambiar</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL de foto de perfil
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  icon={<Camera className="w-4 h-4" />}
                  placeholder="https://ejemplo.com/foto.jpg"
                />
              </div>
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="preview"
                  className="w-10 h-10 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">Pega la URL de una imagen pública</p>
          </div>
          <div className="pt-2">
            <Button type="submit" loading={savingProfile}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>

      {/* Change password form */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-600" />
          Cambiar contraseña
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Usa al menos 8 caracteres con letras y números.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="relative">
              <Input
                label="Contraseña actual"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                placeholder="Tu contraseña actual"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <Input
                label="Nueva contraseña"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div>
              <Input
                label="Confirmar nueva contraseña"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                placeholder="Repite la nueva contraseña"
              />
              {confirmPassword && newPassword && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                  <CheckCircle className="w-3 h-3" />
                  {newPassword === confirmPassword ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                </p>
              )}
            </div>
            <div className="pt-2">
              <Button type="submit" loading={savingPassword} variant="secondary">
                Cambiar contraseña
              </Button>
            </div>
          </form>
      </div>
    </div>
  );
}
