'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { StudentSidebar } from '@/components/layout/StudentSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageErrorBoundary } from '@/components/ui/ErrorBoundary';
import AiAssistant from '@/components/ai/AiAssistant';

export default function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // El profesor también puede navegar la vista de estudiante (para ver el
  // sistema tal como lo usa un estudiante). Solo se bloquea a quien no está
  // logueado o tiene un rol distinto de STUDENT/TEACHER.
  const canView = !!user && (user.role === 'STUDENT' || user.role === 'TEACHER');
  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (!isLoading && user && user.role !== 'STUDENT' && user.role !== 'TEACHER') router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading) return <PageSpinner />;
  if (!canView) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <StudentSidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-0 lg:pt-0 pt-14">
        <TopBar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <PageErrorBoundary>{children}</PageErrorBoundary>
        </div>
      </main>
      {/* Floating AI assistant — available on all student pages */}
      <AiAssistant />
      {/* Buscador inteligente ⌘K */}
      <CommandPalette />
    </div>
  );
}
