'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShellSkeleton } from '@/components/layout/AppShellSkeleton';
import { ArrowLeft } from 'lucide-react';

/**
 * Marco del manual.
 *
 * Va aparte de los espacios (estudiante, profesor, administración) porque el
 * manual es uno solo para todos y se lee a lo ancho. Lleva una barra mínima
 * con el regreso al panel que corresponde a cada rol, y esa barra desaparece
 * al imprimir: en el PDF no pinta un botón de «Volver».
 */
const PANEL_POR_ROL: Record<string, string> = {
  STUDENT:    '/estudiante',
  TEACHER:    '/profesor',
  ADMIN:      '/admin',
  SUPERADMIN: '/superadmin',
};

export default function AyudaLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading) return <AppShellSkeleton />;
  if (!user) return null;

  const volver = PANEL_POR_ROL[user.role] ?? '/estudiante';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FBF8F1]">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200/70 bg-white px-5 py-3 print:hidden">
        <Link
          href={volver}
          className="cx-press inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al panel
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
