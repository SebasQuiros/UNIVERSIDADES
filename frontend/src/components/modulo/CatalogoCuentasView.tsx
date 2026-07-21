'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import { BookOpen, AlertTriangle, FolderTree } from 'lucide-react';

// ── Tipos del endpoint real ────────────────────────────────────
// GET /api/v1/companies/:companyId/accounts
//   → Account[] (Prisma), ordenado por `code` asc, incluye `parent`.
type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
type NormalBalance = 'DEBIT' | 'CREDIT';

interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentId: string | null;
  level: number;
  isActive: boolean;
  isHeader: boolean;
  description?: string | null;
}

// ── Etiquetas y color de acento por tipo de cuenta (paleta de marca) ──
const TYPE_META: Record<AccountType, { label: string; tint: string; chip: string }> = {
  ASSET:     { label: 'Activo',     tint: '#2563EB', chip: 'bg-blue-50 text-blue-700 ring-blue-100' },
  LIABILITY: { label: 'Pasivo',     tint: '#B8860B', chip: 'bg-amber-50 text-amber-800 ring-amber-100' },
  EQUITY:    { label: 'Patrimonio', tint: '#6D28D9', chip: 'bg-violet-50 text-violet-700 ring-violet-100' },
  INCOME:    { label: 'Ingreso',    tint: '#0369A1', chip: 'bg-sky-50 text-sky-700 ring-sky-100' },
  EXPENSE:   { label: 'Gasto',      tint: '#1B2E6E', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
};

const NATURE_LABEL: Record<NormalBalance, string> = {
  DEBIT:  'Deudora',
  CREDIT: 'Acreedora',
};

type LoadState =
  | { phase: 'loading' }
  | { phase: 'no-company' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; accounts: Account[] };

export function CatalogoCuentasView() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) Resolver la empresa igual que el sidebar: attempt activo → company.
        const { data } = await api.get<any[]>('/api/v1/attempts');
        const list = Array.isArray(data) ? data : [];
        const active =
          list.find((x) => x.status === 'IN_PROGRESS') ??
          list.find((x) => x.company) ??
          list.find((x) => x.status === 'NOT_STARTED') ??
          list[0];

        const companyId: string | undefined = active?.company?.id;
        if (!companyId) {
          if (alive) setState({ phase: 'no-company' });
          return;
        }

        // 2) Traer el plan de cuentas de la empresa.
        const res = await api.get<Account[]>(`/api/v1/companies/${companyId}/accounts`);
        const accounts = Array.isArray(res.data) ? res.data : [];
        if (alive) setState({ phase: 'ready', accounts });
      } catch {
        if (alive) {
          setState({
            phase: 'error',
            message: 'No pudimos cargar tu catálogo de cuentas. Intentá de nuevo en un momento.',
          });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const header = (
    <PageHeader
      eyebrow="Contabilidad"
      title="Catálogo de cuentas"
      subtitle="El plan de cuentas de tu empresa bajo NIIF (Costa Rica)."
      icon={BookOpen}
      iconTint="#1B2E6E"
      className="mb-6"
    />
  );

  // ── Loading ───────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <SectionCard>
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Cargando tu catálogo de cuentas…</p>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  // ── Sin empresa activa ────────────────────────────────────────
  if (state.phase === 'no-company') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={<SceneSearchEmpty size={200} className="cx-float" />}
              title="Aún no tenés una empresa activa"
              description="Iniciá un ejercicio para constituir tu empresa; ahí se genera automáticamente el plan de cuentas completo."
              action={
                <Link href="/estudiante" className={buttonClasses({ variant: 'primary', className: 'cx-press' })}>
                  Ir a mis ejercicios
                </Link>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={
                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-9 h-9 text-amber-600" />
                </div>
              }
              title="No pudimos cargar el catálogo"
              description={state.message}
            />
          </Card>
        </div>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────
  const { accounts } = state;

  if (accounts.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={<SceneEmptyBox size={180} className="cx-float" />}
              title="El catálogo está vacío"
              description="Al constituir tu empresa en un ejercicio, se genera el plan de cuentas completo."
            />
          </Card>
        </div>
      </div>
    );
  }

  const detailCount = accounts.filter((a) => !a.isHeader).length;
  const headerCount = accounts.filter((a) => a.isHeader).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
      <div className="max-w-6xl mx-auto">
        {header}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard label="Cuentas en total" value={accounts.length.toLocaleString('es-CR')} icon={BookOpen} tint="#1B2E6E" className="cx-pop cx-d1" />
          <StatCard label="Cuentas de detalle" value={detailCount.toLocaleString('es-CR')} icon={FolderTree} tint="#2563EB" className="cx-pop cx-d2" />
          <StatCard label="Cuentas de mayor" value={headerCount.toLocaleString('es-CR')} icon={FolderTree} tint="#B8860B" className="cx-pop cx-d3" />
        </div>

        {/* Árbol / tabla del plan de cuentas */}
        <SectionCard flushBody className="cx-pop cx-d2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-semibold w-40">Código</th>
                  <th className="px-4 py-2.5 font-semibold">Cuenta</th>
                  <th className="px-4 py-2.5 font-semibold w-32">Tipo</th>
                  <th className="px-4 py-2.5 font-semibold w-32">Naturaleza</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => {
                  const meta = TYPE_META[acc.type];
                  // Indentación por nivel (level 1 = raíz). Los niveles arrancan en 1.
                  const indent = Math.max(0, acc.level - 1) * 18;
                  return (
                    <tr
                      key={acc.id}
                      className={
                        acc.isHeader
                          ? 'border-b border-gray-100 bg-gray-50/40'
                          : 'border-b border-gray-100 hover:bg-gray-50/60 transition-colors'
                      }
                    >
                      <td className="px-4 py-2.5 font-mono tabular-nums text-xs text-gray-500 whitespace-nowrap">
                        {acc.code}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          style={{ paddingLeft: indent }}
                          className={
                            acc.isHeader
                              ? 'inline-block font-bold text-gray-900'
                              : 'inline-block text-gray-700'
                          }
                        >
                          {acc.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            acc.normalBalance === 'DEBIT'
                              ? 'inline-flex items-center gap-1.5 text-xs font-medium text-blue-700'
                              : 'inline-flex items-center gap-1.5 text-xs font-medium text-gold-900'
                          }
                        >
                          <span
                            aria-hidden
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: acc.normalBalance === 'DEBIT' ? '#2563EB' : '#B8860B' }}
                          />
                          {NATURE_LABEL[acc.normalBalance]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            <span className="font-mono tabular-nums">{accounts.length}</span> cuentas · ordenadas por código
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
