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
      <div className="p-5 pb-4" style={{ borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
        <Link href="/profesor" onClick={() => setOpen(false)} className="flex items-center gap-3 group">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-[11px] overflow-hidden flex items-center justify-center"
              style={{ background: '#000' }}>
              <img src="/sjqa-logo.png" alt="ContaSJ" className="w-10 h-10 object-contain" />
            </div>
            <div className="absolute inset-0 rounded-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ boxShadow: '0 0 16px rgba(59,130,246,0.6)' }} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none" style={{ color: '#60A5FA' }}>
              ContaSJ
            </h1>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] mt-1 flex items-center gap-1" style={{ color: '#FBBF24' }}>
              <GraduationCap className="w-3 h-3" />
              Portal Profesor
            </p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, exact, badge }, i) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'lp-in relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                active ? 'text-white' : 'text-white/55 hover:bg-csq-dark-hover hover:text-white/90',
              )}
              style={active ? {
                background: 'linear-gradient(90deg,#1E3A8A,#0F2657)',
                boxShadow: '0 4px 16px rgba(37,99,235,0.28), inset 0 0 0 1px rgba(251,191,36,0.12)',
                animationDelay: `${i * 0.06}s`,
              } : { animationDelay: `${i * 0.06}s` }}
            >
              {/* Barra/acento dorado del item activo */}
              {active && (
                <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                  style={{ background: 'linear-gradient(180deg,#FDE68A,#D4A017)', boxShadow: '0 0 8px rgba(251,191,36,0.55)' }} />
              )}
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: active ? '#93C5FD' : 'rgba(96,165,250,0.6)' }}
              />
              <span className="flex-1">{label}</span>
              {!!badge && (
                <span className="text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none"
                  style={{ background: '#F59E0B', color: '#1a1000' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              {active && <ChevronRight className="w-3 h-3" style={{ color: '#FBBF24' }} />}
            </Link>
          );
        })}
      </nav>

      {/* Divisor decorativo */}
      <div className="mx-4 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(184,134,11,0.35),transparent)' }} />

      {/* User */}
      <div className="p-3 pb-4">
        <Link
          href="/profesor/perfil"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl transition-colors hover:bg-csq-dark-hover"
          style={{ background: 'rgba(15,38,87,0.5)', border: '1px solid rgba(59,130,246,0.12)' }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)' }}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : user?.name?.charAt(0)?.toUpperCase() ?? 'P'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs truncate" style={{ color: '#60A5FA' }}>Mi perfil</p>
          </div>
          <UserCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#60A5FA' }} />
        </Link>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-xl transition-all text-white/50 hover:bg-csq-dark-hover hover:text-white/90"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg,#03080F 0%,#060F1C 100%)', borderRight: '1px solid rgba(59,130,246,0.1)' }}>
        {content}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{ background: '#03080F', borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: '#000' }}>
            <img src="/sjqa-logo.png" alt="ContaSJ" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black leading-none" style={{ color: '#60A5FA' }}>ContaSJ</h1>
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
            style={{ background: 'linear-gradient(180deg,#03080F 0%,#060F1C 100%)', borderRight: '1px solid rgba(59,130,246,0.15)' }}>
            <div className="pt-16">{content}</div>
          </aside>
        </div>
      )}
    </>
  );
}
