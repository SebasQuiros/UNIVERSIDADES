'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArtLedger, SceneSearchEmpty } from '@/components/illustrations';
import type { ExerciseStatus } from '@/types';
import toast from 'react-hot-toast';
import {
  Building2, ChevronRight, BookOpen, Clock, Users, User,
  Receipt, FileText, Search,
} from 'lucide-react';

interface CompanyCard {
  id: string;
  name: string;
  legalId: string | null;
  email: string | null;
  mode: 'INDIVIDUAL' | 'GROUP';
  myRole: 'OWNER' | 'MEMBER';
  memberCount: number;
  invoiceCount: number;
  entryCount: number;
  createdAt: string;
  linkedExercise: { id: string; title: string; course?: { name: string } | null } | null;
  attempt: { id: string; status: string } | null;
}

type Filter = 'ALL' | 'INDIVIDUAL' | 'GROUP';

// ── Skeleton de tarjeta de empresa ───────────────────────────────────────────
function CompanyCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200/70 rounded-card shadow-card p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-5 w-32 rounded-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<CompanyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CompanyCard[]>('/api/v1/companies');
      setCompanies(data);
    } catch {
      toast.error('Error al cargar empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    ALL:        companies.length,
    INDIVIDUAL: companies.filter(c => c.mode === 'INDIVIDUAL').length,
    GROUP:      companies.filter(c => c.mode === 'GROUP').length,
  }), [companies]);

  const filtered = useMemo(() => companies
    .filter(c => filter === 'ALL' || c.mode === filter)
    .filter(c => !query.trim() ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.legalId ?? '').includes(query)),
    [companies, filter, query]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'ALL',        label: 'Todas' },
    { key: 'INDIVIDUAL', label: 'Individuales' },
    { key: 'GROUP',      label: 'Grupales' },
  ];

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">

      {/* Cabecera */}
      <PageHeader
        eyebrow="Tus entornos contables"
        title="Mis empresas"
        subtitle={
          companies.length === 1
            ? '1 empresa a tu cargo. Cada una lleva su propia contabilidad.'
            : `${companies.length} empresas a tu cargo. Cada una lleva su propia contabilidad.`
        }
        icon={Building2}
        className="mb-6"
        actions={
          <div className="w-full sm:w-72">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o cédula…"
              icon={<Search className="w-4 h-4" />}
              aria-label="Buscar empresa"
            />
          </div>
        }
      />

      {/* Filtros por modo */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all cx-press',
              filter === key
                ? 'bg-csq-dark text-white border-csq-dark shadow-card'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900',
            )}
          >
            {label}
            <span className={cn(
              'ml-1.5 text-xs font-mono tabular-nums',
              filter === key ? 'text-blue-200' : 'text-gray-400',
            )}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <CompanyCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          {companies.length === 0 ? (
            <EmptyState
              illustration={<ArtLedger size={200} className="cx-float" />}
              title="Aún no tienes empresas"
              description="Tu empresa nace cuando inicias un ejercicio: ahí constituyes la sociedad y empiezas a registrar sus operaciones."
              action={
                <Link href="/estudiante">
                  <Button variant="primary">Ver mis ejercicios</Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              illustration={<SceneSearchEmpty size={200} className="cx-float" />}
              title="Sin resultados"
              description="No encontramos empresas con ese nombre o cédula. Prueba con otro filtro o limpia la búsqueda."
              action={
                <Button variant="secondary" onClick={() => { setQuery(''); setFilter('ALL'); }}>
                  Limpiar búsqueda
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((company, i) => {
            const isGroup = company.mode === 'GROUP';
            const openHref = company.attempt
              ? `/estudiante/ejercicio/${company.attempt.id}`
              : company.linkedExercise
                ? `/estudiante/ejercicio/${company.linkedExercise.id}`
                : null;
            return (
              <div
                key={company.id}
                className={cn(
                  'group bg-white border border-gray-200/70 rounded-card shadow-card hover:shadow-card-hover',
                  'p-5 flex flex-col gap-4 cx-lift cx-hop-parent cx-pop',
                  i < 6 ? `cx-d${i + 1}` : undefined,
                )}
              >
                {/* Encabezado */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-bold flex-shrink-0 text-white cx-hop"
                    style={{
                      background: isGroup
                        ? 'linear-gradient(145deg,#1E3A8A,#0F2657)'
                        : 'linear-gradient(145deg,#2563EB,#1B2E6E)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    }}
                  >
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate tracking-tight">{company.name}</h3>
                    {company.legalId && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Cédula <span className="font-mono tabular-nums">{company.legalId}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Badges modo + rol */}
                <div className="flex items-center gap-2 flex-wrap -mt-1">
                  <Badge variant={isGroup ? 'slate' : 'blue'}>
                    {isGroup ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {isGroup
                      ? `Grupal · ${company.memberCount} miembro${company.memberCount !== 1 ? 's' : ''}`
                      : 'Individual'}
                  </Badge>
                  {isGroup && (
                    <Badge variant={company.myRole === 'OWNER' ? 'gold' : 'slate'}>
                      {company.myRole === 'OWNER' ? 'Líder' : 'Miembro'}
                    </Badge>
                  )}
                </div>

                {/* KPIs rápidos */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <Receipt className="w-4 h-4 text-blue-600 flex-shrink-0" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-none font-mono tabular-nums">{company.invoiceCount}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Facturas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-none font-mono tabular-nums">{company.entryCount}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Asientos</p>
                    </div>
                  </div>
                </div>

                {/* Ejercicio vinculado */}
                {company.linkedExercise && (
                  <div className="flex flex-col gap-1.5 p-3 bg-blue-50/40 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" strokeWidth={1.75} />
                      <p className="text-xs font-medium text-gray-700 truncate">{company.linkedExercise.title}</p>
                    </div>
                    {company.linkedExercise.course && (
                      <p className="text-xs text-gray-400 pl-5">{company.linkedExercise.course.name}</p>
                    )}
                    {company.attempt && (
                      <div className="pl-5">
                        <StatusBadge status={company.attempt.status as ExerciseStatus} />
                      </div>
                    )}
                  </div>
                )}

                {/* Pie */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" /> {formatDate(company.createdAt)}
                  </span>
                  {openHref && (
                    <Link href={openHref}>
                      <Button size="sm" variant="secondary" className="cx-press">
                        Abrir <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
