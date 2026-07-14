'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import {
  LayoutDashboard, Building2, Users, DollarSign, Activity,
  LogOut, Menu, X, ChevronRight, ShieldCheck,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/superadmin',               label: 'Dashboard',     icon: LayoutDashboard, exact: true },
  { href: '/superadmin/universidades', label: 'Universidades', icon: Building2 },
  { href: '/superadmin/usuarios',      label: 'Usuarios',      icon: Users },
  { href: '/superadmin/planes',        label: 'Ingresos',      icon: DollarSign },
  { href: '/superadmin/actividad',     label: 'Actividad',     icon: Activity },
];

function SuperAdminSidebar() {
  const pathname         = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen]  = useState(false);

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 pb-4" style={{ borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
        <Link href="/superadmin" onClick={() => setOpen(false)} className="flex items-center gap-3 group">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-[11px] overflow-hidden flex items-center justify-center" style={{ background: '#000' }}>
              <img src="/sjqa-logo.png" alt="ContaSJ" className="w-10 h-10 object-contain" />
            </div>
            <div className="absolute inset-0 rounded-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ boxShadow: '0 0 16px rgba(59,130,246,0.6)' }} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none" style={{ color: '#60A5FA' }}>
              ContaSJ <span className="font-bold text-white/45">GROUP</span>
            </h1>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] mt-1 flex items-center gap-1" style={{ color: '#FBBF24' }}>
              <ShieldCheck className="w-3 h-3" /> Panel SuperAdmin
            </p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }, i) => {
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
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? '#93C5FD' : 'rgba(96,165,250,0.6)' }} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3" style={{ color: '#FBBF24' }} />}
            </Link>
          );
        })}
      </nav>

      {/* Divisor decorativo */}
      <div className="mx-4 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(184,134,11,0.35),transparent)' }} />

      {/* User + Logout */}
      <div className="p-3 pb-4">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl"
          style={{ background: 'rgba(15,38,87,0.5)', border: '1px solid rgba(59,130,246,0.12)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)' }}>
            {user?.name?.charAt(0)?.toUpperCase() ?? 'S'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs truncate" style={{ color: '#60A5FA' }}>SUPERADMIN</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-xl transition-all text-white/50 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
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
          <h1 className="text-lg font-black leading-none" style={{ color: '#60A5FA' }}>ContaSJ <span className="text-white/45">GROUP</span></h1>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
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

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && user.role !== 'SUPERADMIN') {
      router.replace('/');
    }
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!user || user.role !== 'SUPERADMIN') return null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <SuperAdminSidebar />
      <main className="flex-1 flex flex-col min-h-screen lg:min-h-0 overflow-hidden pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
