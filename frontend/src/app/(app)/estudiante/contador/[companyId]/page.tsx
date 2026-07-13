'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneSearchEmpty } from '@/components/illustrations';
import ExecutiveDashboard from '@/components/dashboard/ExecutiveDashboard';
import {
  ClientsTab, SuppliersTab, ProductsTab, InvoicesTab, JournalTab, LedgerTab,
  ReportsTab, BankTab, MayorizacionTab, BalanceComprobacionTab, SpecialJournalTab,
  FixedAssetsTab, PayrollTab,
} from '../../ejercicio/[attemptId]/workspace-modules';
import {
  Calculator, ChevronLeft, LayoutDashboard, Users, Truck, Package, Receipt,
  BookText, Library, Layers, Scale, SlidersHorizontal, ScrollText, FileBarChart2,
  Landmark, Building, Wallet,
} from 'lucide-react';

type Tab =
  | 'dashboard' | 'clients' | 'suppliers' | 'products' | 'invoices'
  | 'journal' | 'ledger' | 'mayorizacion' | 'balance-comprobacion'
  | 'ajustes' | 'balance-ajustado' | 'asientos-cierre' | 'balanza-post-cierre'
  | 'reports' | 'fixed-assets' | 'payroll' | 'bank';

const TABS: { id: Tab; label: string; icon: any; group: string }[] = [
  { id: 'dashboard',           label: 'Resumen',              icon: LayoutDashboard,   group: 'General' },
  { id: 'clients',             label: 'Clientes',             icon: Users,             group: 'Operación' },
  { id: 'suppliers',           label: 'Proveedores',          icon: Truck,             group: 'Operación' },
  { id: 'products',            label: 'Productos',            icon: Package,           group: 'Operación' },
  { id: 'invoices',            label: 'Facturas',             icon: Receipt,           group: 'Operación' },
  { id: 'bank',                label: 'Bancos',               icon: Landmark,          group: 'Operación' },
  { id: 'journal',             label: 'Libro diario',         icon: BookText,          group: 'Ciclo contable' },
  { id: 'ledger',              label: 'Libro mayor',          icon: Library,           group: 'Ciclo contable' },
  { id: 'mayorizacion',        label: 'Mayorización',         icon: Layers,            group: 'Ciclo contable' },
  { id: 'balance-comprobacion',label: 'Balance de comprobación', icon: Scale,          group: 'Ciclo contable' },
  { id: 'ajustes',             label: 'Ajustes',              icon: SlidersHorizontal, group: 'Ciclo contable' },
  { id: 'balance-ajustado',    label: 'Balance ajustado',     icon: Scale,             group: 'Ciclo contable' },
  { id: 'asientos-cierre',     label: 'Asientos de cierre',   icon: ScrollText,        group: 'Ciclo contable' },
  { id: 'balanza-post-cierre', label: 'Balanza post-cierre',  icon: Scale,             group: 'Ciclo contable' },
  { id: 'fixed-assets',        label: 'Activos fijos',        icon: Building,          group: 'Ciclo contable' },
  { id: 'payroll',             label: 'Nómina',               icon: Wallet,            group: 'Ciclo contable' },
  { id: 'reports',             label: 'Estados financieros',  icon: FileBarChart2,     group: 'Reportes' },
];

interface Company { id: string; name: string; legalId: string | null; economicActivity: string | null; }

export default function PracticeWorkspacePage() {
  const params  = useParams();
  const router  = useRouter();
  const search  = useSearchParams();
  const companyId = String(params.companyId);

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');

  useEffect(() => {
    const t = search.get('tab') as Tab | null;
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Company>(`/api/v1/companies/${companyId}`);
      setCompany(data);
    } catch {
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;
  }
  if (!company) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <EmptyState
          illustration={<SceneSearchEmpty size={220} className="lp-drift" />}
          title="No se encontró esta empresa de práctica"
          description="Puede que se haya eliminado o que el enlace no sea correcto."
          action={(
            <Link href="/estudiante/contador">
              <Button variant="gold"><ChevronLeft className="w-4 h-4" /> Volver a mis empresas</Button>
            </Link>
          )}
        />
      </div>
    );
  }

  const selectTab = (id: Tab) => {
    setTab(id);
    router.replace(`/estudiante/contador/${companyId}?tab=${id}`, { scroll: false });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Cabecera de la empresa */}
      <div className="px-6 lg:px-8 pt-5 pb-3 border-b border-gray-100 bg-white lp-in">
        <Link href="/estudiante/contador" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gold-700 mb-2">
          <ChevronLeft className="w-3.5 h-3.5" /> Mis empresas-cliente
        </Link>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white flex-shrink-0 shadow-[0_6px_20px_rgba(184,134,11,0.3)]" style={{ background: 'linear-gradient(145deg,#D4A017,#B8860B)' }}>
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate flex items-center gap-2">
              {company.name}
              <Badge variant="gold"><Calculator className="w-3 h-3" /> Práctica</Badge>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {company.legalId ? `Cédula ${company.legalId}` : 'Sin cédula'}
              {company.economicActivity ? ` · ${company.economicActivity}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de módulos (tabs internos) */}
      <div className="border-b border-gray-100 bg-white overflow-x-auto">
        <div className="flex gap-1 px-4 lg:px-6 py-2 min-w-max">
          {TABS.map((t) => {
            const on = t.id === tab;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => selectTab(t.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all"
                style={on
                  ? { background: '#D4A017', color: '#1a1205' }
                  : { color: '#64748b' }}
                onMouseEnter={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = ''; }}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del módulo */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gray-50/50">
        {tab === 'dashboard'            && <ExecutiveDashboard companyId={companyId} />}
        {tab === 'clients'             && <ClientsTab    companyId={companyId} readonly={false} />}
        {tab === 'suppliers'           && <SuppliersTab  companyId={companyId} readonly={false} />}
        {tab === 'products'            && <ProductsTab   companyId={companyId} readonly={false} />}
        {tab === 'invoices'            && <InvoicesTab   companyId={companyId} readonly={false} />}
        {tab === 'bank'                && <BankTab       companyId={companyId} readonly={false} />}
        {tab === 'journal'             && <JournalTab    companyId={companyId} />}
        {tab === 'ledger'              && <LedgerTab     companyId={companyId} />}
        {tab === 'mayorizacion'        && <MayorizacionTab companyId={companyId} />}
        {tab === 'balance-comprobacion'&& <BalanceComprobacionTab companyId={companyId} />}
        {tab === 'ajustes'             && <SpecialJournalTab companyId={companyId} readonly={false} prefix="ADJ"  emptyLabel="No hay asientos de ajuste aún" />}
        {tab === 'balance-ajustado'    && <BalanceComprobacionTab companyId={companyId} note="Incluye asientos de ajuste registrados" />}
        {tab === 'asientos-cierre'     && <SpecialJournalTab companyId={companyId} readonly={false} prefix="CIER" emptyLabel="No hay asientos de cierre aún" />}
        {tab === 'balanza-post-cierre' && <BalanceComprobacionTab companyId={companyId} filterTypes={['ASSET','LIABILITY','EQUITY']} note="Solo cuentas permanentes (activo, pasivo, patrimonio)" />}
        {tab === 'fixed-assets'        && <FixedAssetsTab companyId={companyId} />}
        {tab === 'payroll'             && <PayrollTab    companyId={companyId} />}
        {tab === 'reports'             && <ReportsTab    companyId={companyId} companyName={company.name} />}
      </div>
    </div>
  );
}
