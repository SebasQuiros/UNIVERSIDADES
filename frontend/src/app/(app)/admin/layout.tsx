'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { PageErrorBoundary } from '@/components/ui/ErrorBoundary';
import {
  LayoutDashboard, Users, BookOpen, Building2,
  LogOut, Menu, X, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/admin',          label: 'Dashboard',  icon: LayoutDashboard, exact: true },
  { href: '/admin/usuarios', label: 'Usuarios',   icon: Users },
  { href: '/admin/cursos',   label: 'Cursos',     icon: BookOpen },
];

function AdminSidebar() {
  const pathname         = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen]  = useState(false);

  const content = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-blue-800">
        <Link href="/admin" onClick={() => setOpen(false)}>
          <h1 className="text-xl font-bold text-white tracking-tight">
            <span className="text-blue-300">SJQA</span> GROUP
          </h1>
          <p className="text-xs text-blue-300 mt-0.5">Panel Administrativo</p>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-100 hover:text-white hover:bg-blue-800',
              )}>
              <Icon className={cn('w-4 h-4', active ? 'text-white' : 'text-blue-300 group-hover:text-white')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 text-white" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-blue-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl bg-blue-800/50">
          <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-200 font-semibold text-sm flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-blue-300 truncate">{user?.role}</p>
          </div>
        </div>
        <button onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-blue-200 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors">
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 bg-blue-900 h-screen sticky top-0">
        {content}
      </aside>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-blue-900 border-b border-blue-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white"><span className="text-blue-300">SJQA</span> GROUP</h1>
        <button onClick={() => setOpen(!open)} className="p-2 text-blue-200 hover:text-white hover:bg-blue-800 rounded-lg transition-colors">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-blue-900 h-full overflow-y-auto">
            <div className="pt-16">{content}</div>
          </aside>
        </div>
      )}
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />
      <main className="flex-1 flex flex-col min-h-screen lg:min-h-0 overflow-hidden pt-14 lg:pt-0">
        <PageErrorBoundary>{children}</PageErrorBoundary>
      </main>
    </div>
  );
}
