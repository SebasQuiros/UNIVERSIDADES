'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import { getErrorMessage, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { SceneStudentDesk } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  User, Mail, Lock, Shield, Building2, Camera, Eye, EyeOff,
  CheckCircle, XCircle, UserCog,
} from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  STUDENT:    'Estudiante',
  TEACHER:    'Profesor',
  ADMIN:      'Administrador',
  SUPERADMIN: 'Super Administrador',
};

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
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
      // Supabase actualiza la contraseña del usuario logueado usando su sesión activa.
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
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
  const passwordsMatch = Boolean(confirmPassword && newPassword && newPassword === confirmPassword);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      <div className="max-w-2xl">

        {/* Cabecera */}
        <PageHeader
          eyebrow="Tu cuenta"
          title="Mi perfil"
          subtitle="Administra tu información personal y la seguridad de tu acceso."
          icon={UserCog}
          className="mb-6"
        />

        {/* Tarjeta de identidad (banda azul noche) */}
        <div className="relative overflow-hidden rounded-card shadow-soft mb-6 cx-pop bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
          <div aria-hidden className="pointer-events-none absolute right-2 bottom-0 hidden sm:block opacity-90">
            <SceneStudentDesk size={150} className="cx-float" />
          </div>
          <div className="relative flex items-center gap-5 p-6">
            <div className="relative flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl bg-white/10 border border-white/20">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-white text-lg truncate tracking-tight">{user.name}</h3>
              <p className="text-blue-200/80 text-sm truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-100 border border-gold-500/30">
                  <Shield className="w-3 h-3" />
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                {user.universityId && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-blue-100 border border-white/15">
                    <Building2 className="w-3 h-3" />
                    Universidad asignada
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Información personal */}
        <SectionCard
          eyebrow="Datos"
          title="Información personal"
          description="Así te ven tus profesores y compañeros de equipo."
          icon={User}
          iconTint="#2563EB"
          className="mb-6 cx-pop cx-d1"
        >
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input
              label="Nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={<User className="w-4 h-4" />}
              placeholder="Tu nombre completo"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-sm">
                <Mail className="w-4 h-4 text-gray-400" />
                {user.email}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">El correo no se puede cambiar.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Foto de perfil
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
                    alt="Vista previa"
                    className="w-11 h-11 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Pega la URL de una imagen pública.</p>
            </div>
            <div className="pt-1">
              <Button type="submit" loading={savingProfile} className="cx-press">
                Guardar cambios
              </Button>
            </div>
          </form>
        </SectionCard>

        {/* Seguridad */}
        <SectionCard
          eyebrow="Seguridad"
          title="Cambiar contraseña"
          description="Usa al menos 8 caracteres, combinando letras y números."
          icon={Lock}
          iconTint="#B8860B"
          className="cx-pop cx-d2"
        >
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
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                <p
                  key={passwordsMatch ? 'ok' : 'ko'}
                  className={cn(
                    'text-xs mt-1.5 flex items-center gap-1 font-medium',
                    passwordsMatch ? 'text-emerald-600 cx-pop' : 'text-red-500 cx-shake',
                  )}
                >
                  {passwordsMatch
                    ? <><CheckCircle className="w-3.5 h-3.5" /> Las contraseñas coinciden</>
                    : <><XCircle className="w-3.5 h-3.5" /> Las contraseñas no coinciden</>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" loading={savingPassword} variant="secondary" className="cx-press">
                Cambiar contraseña
              </Button>
              <Badge variant="slate">
                <Shield className="w-3 h-3" /> Sesión protegida
              </Badge>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
