'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { ExerciseAttempt } from '@/types';
import {
  LayoutDashboard, BookOpen, FileText, ClipboardCheck,
  LogOut, Menu, X, ChevronRight, GraduationCap, UserCircle,
} from 'lucide-react';

export function TeacherSidebar() {
  const pathname               = usePathname();
  const { user, logout }       = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending]  = useState(0);
  const [university, setUniversity] = useState<{ name: string; shortName: string | null; logoUrl: string | null } | null>(null);

  useEffect(() => {
    if (!user?.universityId) return;
    api.get('/api/v1/universities/mine')
      .then(({ data }) => setUniversity(data))
      .catch(() => {});
  }, [user?.universityId]);

  useEffect(() => {
    api.get<ExerciseAttempt[]>('/api/v1/attempts')
      .then(({ data }) =>
        setPending(data.filter((a) => a.status === 'IN_PROGRESS' || a.status === 'SUBMITTED').length),
      )
      .catch(() => {});
  }, [pathname]);

  const NAV = [
    { href: '/profesor',            label: 'Dashboard',               icon: LayoutDashboard, exact: true },
    { href: '/profesor/cursos',     label: 'Mis Cursos',              icon: BookOpen },
    { href: '/profesor/ejercicios', label: 'Mis Ejercicios',          icon: FileText },
    { href: '/profesor/pendientes', label: 'Pendientes de calificar', icon: ClipboardCheck, badge: pending },
  ];

  const content = (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/profesor" onClick={() => setOpen(false)} className="flex items-center gap-3 group">
          <div className="relative">
            <img src="/logo.png" alt="ContaSJ" className="w-10 h-10 rounded-xl flex-shrink-0" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight leading-none">
              <span style={{ color: '#14B8A6' }}>ContaSJ</span>
            </h1>
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#14B8A6' }}>
              <GraduationCap className="w-3 h-3" />
              Portal Profesor
            </p>
          </div>
        </Link>
      </div>

      {/* University badge */}
      {university && (
        <div className="px-5 py-2.5 flex items-center gap-2.5"
          style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {university.logoUrl ? (
            <img src={university.logoUrl} alt={university.name} className="w-5 h-5 rounded object-contain flex-shrink-0"
              style={{ opacity: 0.85 }} />
          ) : (
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ background: 'rgba(13,148,136,0.2)', color: '#14B8A6' }}>
              {(university.shortName ?? university.name).charAt(0)}
            </div>
          )}
          <p className="text-xs truncate leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {university.shortName ?? university.name}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={active ? {
                background: '#0D9488',
                color: '#FFFFFF',
              } : {
                color: 'rgba(255,255,255,0.55)',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.cssText += 'background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.9);'; }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; } }}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }}
              />
              <span className="flex-1">{label}</span>
              {!!badge && (
                <span className="text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none"
                  style={{ background: '#F59E0B', color: '#1a1000' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              {active && <ChevronRight className="w-3 h-3" style={{ color: '#FFFFFF' }} />}
            </Link>
          );
        })}
      </nav>

      {/* Divisor decorativo */}
      <div className="mx-4 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* User */}
      <div className="p-3 pb-4">
        <Link
          href="/profesor/perfil"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: '#0D9488' }}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : user?.name?.charAt(0)?.toUpperCase() ?? 'P'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs truncate" style={{ color: '#14B8A6' }}>Mi perfil</p>
          </div>
          <UserCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#14B8A6' }} />
        </Link>
        <div className="flex gap-2">
          <button
            onClick={logout}
            className="flex items-center gap-2 flex-1 px-3 py-2 text-sm rounded-xl transition-all"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 flex-shrink-0"
        style={{ background: '#0E141B', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        {content}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{ background: '#0E141B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="ContaSJ" className="w-8 h-8 rounded-lg" />
          <div>
            <h1 className="text-lg font-black text-white leading-none"><span style={{ color: '#14B8A6' }}>ContaSJ</span></h1>
            {university && <p className="text-xs leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{university.shortName ?? university.name}</p>}
          </div>
        </div>
        <button onClick={() => setOpen(!open)} className="p-2 rounded-lg"
          style={{ color: 'rgba(255,255,255,0.7)' }}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-72 h-full overflow-y-auto"
            style={{ background: '#0E141B', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="pt-16">{content}</div>
          </aside>
        </div>
      )}
    </>
  );
}
