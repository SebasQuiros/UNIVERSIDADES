'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
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
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Mis Empresas
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {companies.length} empresa{companies.length !== 1 ? 's' : ''} · gestiona tus entornos contables
          </p>
        </div>
        {/* Buscador */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o cédula…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
          />
        </div>
      </div>

      {/* Filtros por modo */}
      <div className="flex gap-2 mb-6">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border"
            style={filter === key
              ? { background: '#1E3A8A', color: '#fff', borderColor: '#1E3A8A' }
              : { background: '#fff', color: '#475569', borderColor: '#E2E8F0' }}
          >
            {label}
            <span className="ml-1.5 text-xs opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-700 font-semibold">
            {companies.length === 0 ? 'Sin empresas creadas' : 'Sin resultados'}
          </h3>
          <p className="text-gray-500 text-sm mt-1 mb-4">
            {companies.length === 0
              ? 'Las empresas se crean al iniciar un ejercicio'
              : 'Prueba con otro filtro o búsqueda'}
          </p>
          {companies.length === 0 && (
            <Link href="/estudiante">
              <Button variant="secondary">Ver mis ejercicios</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((company) => {
            const isGroup = company.mode === 'GROUP';
            const openHref = company.attempt
              ? `/estudiante/ejercicio/${company.attempt.id}`
              : company.linkedExercise
                ? `/estudiante/ejercicio/${company.linkedExercise.id}`
                : null;
            return (
              <div
                key={company.id}
                className="group bg-white border border-gray-200 hover:border-blue-300 shadow-sm rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-md"
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold flex-shrink-0 text-white"
                    style={{ background: isGroup
                      ? 'linear-gradient(135deg,#7C3AED,#5B21B6)'
                      : 'linear-gradient(135deg,#3B82F6,#1E3A8A)' }}>
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{company.name}</h3>
                    </div>
                    {company.legalId && (
                      <p className="text-xs text-gray-500 mt-0.5">Cédula: {company.legalId}</p>
                    )}
                  </div>
                </div>

                {/* Badges modo + rol */}
                <div className="flex items-center gap-2 flex-wrap -mt-1">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={isGroup
                      ? { background: '#F3E8FF', color: '#7C3AED' }
                      : { background: '#DBEAFE', color: '#1E40AF' }}>
                    {isGroup ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {isGroup ? `Grupal · ${company.memberCount} miembro${company.memberCount !== 1 ? 's' : ''}` : 'Individual'}
                  </span>
                  {isGroup && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={company.myRole === 'OWNER'
                        ? { background: '#FEF3C7', color: '#B45309' }
                        : { background: '#F1F5F9', color: '#475569' }}>
                      {company.myRole === 'OWNER' ? 'Líder' : 'Miembro'}
                    </span>
                  )}
                </div>

                {/* KPIs rápidos */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <Receipt className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-none">{company.invoiceCount}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Facturas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-none">{company.entryCount}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Asientos</p>
                    </div>
                  </div>
                </div>

                {/* Ejercicio vinculado */}
                {company.linkedExercise && (
                  <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-600 truncate">{company.linkedExercise.title}</p>
                    </div>
                    {company.linkedExercise.course && (
                      <p className="text-xs text-gray-400 pl-5">{company.linkedExercise.course.name}</p>
                    )}
                    {company.attempt && (
                      <div className="pl-5">
                        <StatusBadge status={company.attempt.status as any} />
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" /> {formatDate(company.createdAt)}
                  </span>
                  {openHref && (
                    <Link href={openHref}>
                      <Button size="sm" variant="secondary">
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
