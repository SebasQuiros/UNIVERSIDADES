import { Skeleton, KPICardSkeleton } from '@/components/ui/Skeleton';

/**
 * Esqueleto del "shell" de la app (sidebar + topbar + contenido) que se muestra
 * mientras se resuelve la sesión (`AuthContext.isLoading`: getSession + /auth/me,
 * ~1-3s en producción por la latencia a Neon). Reemplaza al spinner a pantalla
 * completa para que la interfaz se sienta "ya presente" en vez de vacía —
 * mejora la percepción de velocidad durante el arranque y en cada refresh.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FBF8F1]" aria-busy="true" aria-label="Cargando">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col gap-6 border-r border-gray-200/70 bg-white/60 p-4">
        <div className="flex items-center gap-3 px-2 pt-2">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex flex-col gap-2 pt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="mt-auto flex items-center gap-3 px-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between gap-4 border-b border-gray-200/70 bg-white/60 px-5 h-14 lg:h-16">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-5 lg:p-7 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-card border border-gray-200/70 bg-white p-5 space-y-3 shadow-card">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
