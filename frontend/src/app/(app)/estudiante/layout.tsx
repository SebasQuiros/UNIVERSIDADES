'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { StudentSidebar } from '@/components/layout/StudentSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageErrorBoundary } from '@/components/ui/ErrorBoundary';
import AiAssistant from '@/components/ai/AiAssistant';

export default function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (!isLoading && user && user.role !== 'STUDENT') router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading) return <PageSpinner />;
  if (!user || user.role !== 'STUDENT') return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <StudentSidebar />
      <main className="flex-1 flex flex-col min-w-0 lg:pt-0 pt-14">
        <TopBar />
        <div className="flex-1 flex flex-col min-w-0">
          <PageErrorBoundary>{children}</PageErrorBoundary>
        </div>
      </main>
      {/* Floating AI assistant — available on all student pages */}
      <AiAssistant />
    </div>
  );
}
