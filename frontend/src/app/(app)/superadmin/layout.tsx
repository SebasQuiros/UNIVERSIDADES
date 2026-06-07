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
      <div className="p-6 border-b border-[#1a3a75]">
        <Link href="/superadmin" onClick={() => setOpen(false)}>
          <h1 className="text-xl font-bold text-white tracking-tight">
            ContaSJ <span className="text-blue-300">GROUP</span>
          </h1>
          <p className="text-xs text-blue-300 mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Panel SuperAdmin
          </p>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-100 hover:text-white hover:bg-[#1a3a75]',
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-white' : 'text-blue-300 group-hover:text-white')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 text-white" />}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-4 border-t border-[#1a3a75]">
        <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl bg-[#1a3a75]/60">
          <div className="w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center text-blue-100 font-semibold text-sm flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() ?? 'S'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-blue-300 truncate">SUPERADMIN</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-blue-200 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 flex-shrink-0" style={{ backgroundColor: '#0F2657' }}>
        {content}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b border-[#1a3a75] px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#0F2657' }}>
        <h1 className="text-lg font-bold text-white">ContaSJ <span className="text-blue-300">GROUP</span></h1>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 text-blue-200 hover:text-white hover:bg-[#1a3a75] rounded-lg transition-colors"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-72 h-full overflow-y-auto" style={{ backgroundColor: '#0F2657' }}>
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
