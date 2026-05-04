'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TeacherSidebar } from '@/components/layout/TeacherSidebar';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function ProfesorLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (!isLoading && user && user.role !== 'TEACHER') router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading) return <PageSpinner />;
  if (!user || user.role !== 'TEACHER') return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <TeacherSidebar />
      <main className="flex-1 flex flex-col min-w-0 lg:pt-0 pt-14">
        <PageErrorBoundary>{children}</PageErrorBoundary>
      </main>
    </div>
  );
}
