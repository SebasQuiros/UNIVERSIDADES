'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { Notification } from '@/types';
import { Bell, ChevronRight, Search, HelpCircle } from 'lucide-react';

// Mapa de segmentos de ruta → etiqueta legible (breadcrumb estilo SAP/ALEGRA)
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
      style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E5E9F0' }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 min-w-0 flex-shrink">
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
            {i === crumbs.length - 1 ? (
              <span className="text-sm font-semibold text-gray-800 truncate">{c.label}</span>
            ) : (
              <Link href={c.href} className="text-sm text-gray-400 hover:text-gray-600 transition-colors truncate">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Buscador global (estético, atajo visual) */}
      <div className="ml-auto hidden xl:flex items-center gap-2 px-3 h-9 rounded-xl w-72"
        style={{ background: '#F1F5F9', border: '1px solid #E5E9F0' }}>
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          placeholder="Buscar empresas, ejercicios…"
          className="bg-transparent outline-none text-sm text-gray-600 w-full placeholder:text-gray-400"
        />
        <kbd className="text-[10px] font-semibold text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 bg-white">⌘K</kbd>
      </div>

      {/* Acciones derecha */}
      <div className="flex items-center gap-1.5 ml-auto xl:ml-0">
        <Link
          href="/estudiante/impuestos"
          className="hidden xl:flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Ayuda tributaria"
        >
          <HelpCircle className="w-5 h-5" />
        </Link>

        <Link
          href="/estudiante/notificaciones"
          className="relative flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Notificaciones"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full text-white"
              style={{ background: '#EF4444' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <Link href="/estudiante/perfil" className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)' }}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : user?.name?.charAt(0)?.toUpperCase() ?? 'E'}
          </div>
          <div className="hidden 2xl:block leading-tight">
            <p className="text-sm font-semibold text-gray-800 truncate max-w-[140px]">{user?.name}</p>
            <p className="text-xs text-gray-400">Estudiante</p>
          </div>
        </Link>
      </div>
    </header>
  );
}

export default TopBar;
