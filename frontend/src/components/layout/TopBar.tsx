'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { Notification } from '@/types';
import { Bell, ChevronRight, Search, HelpCircle } from 'lucide-react';
import { SpaceSwitcher } from './SpaceSwitcher';

// Mapa de segmentos de ruta → etiqueta legible (breadcrumb jerárquico)
const SEGMENT_LABELS: Record<string, string> = {
  estudiante:     'Inicio',
  progreso:       'Mi Progreso',
  empresas:       'Mis Empresas',
  impuestos:      'Tributación',
  d104:           'D-104 IVA',
  d101:           'D-101 Renta',
  d103:           'D-103 Retenciones',
  d115:           'D-115',
  notificaciones: 'Notificaciones',
  perfil:         'Mi Perfil',
  ejercicio:      'Ejercicio',
};

function buildCrumbs(pathname: string) {
  const parts = pathname.split('/').filter(Boolean); // ['estudiante', 'empresas', ...]
  const crumbs: { label: string; href: string }[] = [];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    // Saltar IDs (uuid/numéricos) en el breadcrumb
    const isId = /^[0-9a-f-]{16,}$/i.test(part) || /^\d+$/.test(part);
    if (isId) continue;
    crumbs.push({ label: SEGMENT_LABELS[part] ?? part, href: acc });
  }
  return crumbs;
}

export function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = () =>
      api.get<Notification[]>('/api/v1/notifications')
        .then(({ data }) => setUnread(data.filter((n) => !n.isRead).length))
        .catch(() => {});
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, [pathname]);

  const crumbs = buildCrumbs(pathname);

  return (
    <header
      className="hidden lg:flex items-center gap-4 h-14 px-6 sticky top-0 z-20 flex-shrink-0"
      style={{
        // Vidrio esmerilado con acento de marca (blur + hairline azul + brillo superior)
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(37,99,235,0.10)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 6px 20px rgba(27,46,110,0.04)',
      }}
    >
      {/* Breadcrumb — el activo lleva punto dorado de marca */}
      <nav className="flex items-center gap-1.5 min-w-0 flex-shrink">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={c.href} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
              {isLast ? (
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    aria-hidden
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg,#FDE68A,#D4A017)',
                      boxShadow: '0 0 6px rgba(212,160,23,0.55)',
                    }}
                  />
                  <span className="text-sm font-semibold text-gray-800 truncate">{c.label}</span>
                </span>
              ) : (
                <Link href={c.href} className="text-sm text-gray-400 hover:text-blue-600 transition-colors truncate">
                  {c.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {/* Buscador global inteligente (abre el ⌘K) */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('contasj:cmdk'))}
        className="ml-auto hidden xl:flex items-center gap-2 px-3 h-9 rounded-xl w-72 border border-blue-100 bg-blue-50/50 hover:border-blue-300 hover:bg-blue-50 transition-colors"
      >
        <Search className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="flex-1 text-left text-sm text-gray-400">Buscar todo…</span>
        <kbd className="text-[10px] font-semibold text-gray-500 px-1.5 py-0.5 rounded border border-blue-100 bg-white font-mono">⌘K</kbd>
      </button>

      {/* Acciones derecha */}
      <div className="flex items-center gap-1.5 ml-auto xl:ml-0">
        {/* Selector de espacio (estilo cambio de entidad de Business Central) */}
        <SpaceSwitcher />
        <div className="w-px h-6 bg-gray-200 mx-0.5" />

        <Link
          href="/estudiante/impuestos"
          className="hidden xl:flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Ayuda tributaria"
        >
          <HelpCircle className="w-5 h-5" />
        </Link>

        <Link
          href="/estudiante/notificaciones"
          className="relative flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Notificaciones"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full text-white font-mono"
              style={{ background: '#EF4444', boxShadow: '0 0 0 2px rgba(255,255,255,0.9)' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <Link href="/estudiante/perfil" className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
          <div className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)' }}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-md object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : user?.name?.charAt(0)?.toUpperCase() ?? 'E'}
          </div>
          <div className="hidden 2xl:block leading-tight">
            <p className="text-sm font-semibold text-gray-800 truncate max-w-[140px]">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.role === 'TEACHER' ? 'Profesor' : 'Estudiante'}</p>
          </div>
        </Link>
      </div>
    </header>
  );
}

export default TopBar;
