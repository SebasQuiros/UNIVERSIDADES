'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { StudentSidebar } from '@/components/layout/StudentSidebar';
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
    <div className="flex h-screen overflow-hidden bg-[#FBF8F1]">
      <StudentSidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-0 lg:pt-0 pt-14">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <PageErrorBoundary>{children}</PageErrorBoundary>
        </div>
      </main>
    </div>
  );
}
