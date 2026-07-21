'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { GraduationCap, Calculator, Users, Presentation, ChevronDown, Check } from 'lucide-react';

type SpaceKey = 'educacion' | 'contador' | 'multiempresa' | 'docencia';

interface Space {
  key: SpaceKey;
  label: string;
  hint: string;
  href: string;
  icon: React.ElementType;
  tint: string;      // color de marca del espacio
}

const SPACES: Space[] = [
  { key: 'educacion',    label: 'Educación',    hint: 'Aprendé operando tu empresa',       href: '/estudiante',              icon: GraduationCap, tint: '#3B82F6' },
  { key: 'contador',     label: 'Contador',     hint: 'Tu contabilidad por empresa',       href: '/estudiante/contador',     icon: Calculator,    tint: '#D4A017' },
  { key: 'multiempresa', label: 'Multiempresa', hint: 'Grupos y comercio entre prácticas', href: '/estudiante/multiempresa', icon: Users,         tint: '#7C3AED' },
  { key: 'docencia',     label: 'Docencia',     hint: 'Cursos, ejercicios y sesiones',     href: '/profesor',                icon: Presentation,  tint: '#4F46E5' },
];

/**
 * Selector de espacio estilo "cambio de entidad" (Business Central): vive arriba
 * a la derecha, muestra el espacio activo y despliega los demás. El profesor ve
 * también "Docencia". La navegación del sidebar sigue el espacio por pathname.
 */
export function SpaceSwitcher() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isTeacher = user?.role === 'TEACHER';
  const visible = SPACES.filter((s) => s.key !== 'docencia' || isTeacher);

  const currentKey: SpaceKey =
    pathname.startsWith('/profesor')                ? 'docencia'
    : pathname.startsWith('/estudiante/contador')   ? 'contador'
    : pathname.startsWith('/estudiante/multiempresa') ? 'multiempresa'
    : 'educacion';
  const current = SPACES.find((s) => s.key === currentKey)!;

  // Cerrar al hacer click fuera / con Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 h-9 pl-2 pr-2.5 rounded-xl border transition-colors bg-white hover:bg-gray-50"
        style={{ borderColor: 'rgba(37,99,235,0.18)' }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${current.tint}1A`, color: current.tint }}>
          <CurrentIcon className="w-3.5 h-3.5" />
        </span>
        <span className="leading-tight text-left hidden md:block">
          <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Espacio</span>
          <span className="block text-[13px] font-bold text-gray-800 -mt-0.5">{current.label}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-xl border bg-white p-1.5 z-50"
          style={{ borderColor: 'rgba(37,99,235,0.14)', boxShadow: '0 16px 40px rgba(27,46,110,0.16)' }}
        >
          <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-gray-400">Cambiar de espacio</p>
          {visible.map((s) => {
            const Icon = s.icon;
            const active = s.key === currentKey;
            return (
              <Link
                key={s.key}
                href={s.href}
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors hover:bg-gray-50"
              >
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${s.tint}1A`, color: s.tint }}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-gray-800">{s.label}</span>
                  <span className="block text-[11px] text-gray-400 truncate">{s.hint}</span>
                </span>
                {active && <Check className="w-4 h-4 flex-shrink-0" style={{ color: s.tint }} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SpaceSwitcher;
