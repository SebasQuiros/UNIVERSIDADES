'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneEmptyBox } from '@/components/illustrations';
import {
  ClientsTab, ProductsTab, SuppliersTab, InvoicesTab, JournalTab, LedgerTab,
  ReportsTab, BankTab, MayorizacionTab, BalanceComprobacionTab, SpecialJournalTab,
  FixedAssetsTab, PayrollTab, QuotesTab, PurchaseOrdersTab, InventoryAdjustmentsTab,
} from '@/app/(app)/estudiante/ejercicio/[attemptId]/workspace-modules';

/**
 * Puente entre el menú del Espacio Contador y los módulos del ejercicio.
 *
 * Estos módulos ya estaban construidos y probados dentro del ejercicio, y todos
 * reciben la empresa como parámetro — no dependen del intento. Antes el Espacio
 * Contador tenía su propia versión en blanco: el botón de crear solo mostraba
 * "en construcción". En vez de reescribir cada pantalla (con el riesgo de que
 * las dos versiones se comporten distinto), acá se resuelve la empresa activa y
 * se reutiliza el módulo real.
 */

/** Empresa a usar: la del ejercicio en curso; si no hay, la de práctica. */
export function useEmpresaActiva() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'sin-empresa'>('cargando');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        let id: string | undefined;
        let nombre = '';
        try {
          const { data } = await api.get<any[]>('/api/v1/attempts');
          const lista = Array.isArray(data) ? data : [];
          const activo = lista.find((x) => x.status === 'IN_PROGRESS' && x.company)
            ?? lista.find((x) => x.company);
          id = activo?.company?.id;
          nombre = activo?.company?.name ?? '';
        } catch { /* cae a las de práctica */ }

        if (!id) {
          const { data } = await api.get<any[]>('/api/v1/practice/companies');
          const primera = Array.isArray(data) ? data[0] : null;
          id = primera?.id;
          nombre = primera?.name ?? '';
        }

        if (!vivo) return;
        if (!id) { setEstado('sin-empresa'); return; }
        setCompanyId(id);
        setCompanyName(nombre);
        setEstado('lista');
      } catch { if (vivo) setEstado('sin-empresa'); }
    })();
    return () => { vivo = false; };
  }, []);

  return { companyId, companyName, estado };
}

/** Envuelve un módulo del ejercicio resolviendo antes la empresa activa. */
export function ModuloWorkspace({ render }: {
  render: (ctx: { companyId: string; companyName: string }) => ReactNode;
}) {
  const { companyId, companyName, estado } = useEmpresaActiva();

  if (estado === 'cargando') {
    return <div className="flex-1 grid place-items-center p-12"><Spinner /></div>;
  }
  if (estado === 'sin-empresa' || !companyId) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <EmptyState
          illustration={<SceneEmptyBox />}
          title="Todavía no tenés una empresa"
          description="Creá una empresa en el Espacio Contador, o entrá a un ejercicio, para trabajar en este módulo."
        />
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">{render({ companyId, companyName })}</div>
    </div>
  );
}

/**
 * Slug del menú → módulo real. `readonly: false` porque en el Espacio Contador
 * el estudiante practica libremente (no hay nota que proteger).
 */
export const MODULOS_REUTILIZADOS: Record<string, (c: { companyId: string; companyName: string }) => ReactNode> = {
  'clientes':            ({ companyId }) => <ClientsTab companyId={companyId} readonly={false} />,
  'productos':           ({ companyId }) => <ProductsTab companyId={companyId} readonly={false} />,
  'proveedores':         ({ companyId }) => <SuppliersTab companyId={companyId} readonly={false} />,
  'facturas-venta':      ({ companyId }) => <InvoicesTab companyId={companyId} readonly={false} />,
  'cotizaciones':        ({ companyId }) => <QuotesTab companyId={companyId} readonly={false} />,
  'ordenes-compra':      ({ companyId }) => <PurchaseOrdersTab companyId={companyId} readonly={false} />,
  'recepcion-comprobantes': ({ companyId }) => <PurchaseOrdersTab companyId={companyId} readonly={false} focusReceiving />,
  'ajustes-inventario':  ({ companyId }) => <InventoryAdjustmentsTab companyId={companyId} readonly={false} />,
  'bancos':              ({ companyId }) => <BankTab companyId={companyId} readonly={false} />,
  'conciliaciones':      ({ companyId }) => <BankTab companyId={companyId} readonly={false} />,
  'libro-diario':        ({ companyId }) => <JournalTab companyId={companyId} readonly={false} />,
  'asiento-contable':    ({ companyId }) => <JournalTab companyId={companyId} readonly={false} />,
  'libro-mayor':         ({ companyId }) => <LedgerTab companyId={companyId} />,
  'mayorizacion':        ({ companyId }) => <MayorizacionTab companyId={companyId} />,
  'estados-financieros': ({ companyId, companyName }) => <ReportsTab companyId={companyId} companyName={companyName} />,
  'activos':             ({ companyId }) => <FixedAssetsTab companyId={companyId} />,
  'nomina':              ({ companyId }) => <PayrollTab companyId={companyId} />,
  'balance-comprobacion':({ companyId }) => <BalanceComprobacionTab companyId={companyId} />,
  'ajustes':             ({ companyId }) => (
    <SpecialJournalTab companyId={companyId} readonly={false} prefix="ADJ"
      emptyLabel="Todavía no registraste asientos de ajuste." />
  ),
  'asientos-cierre':     ({ companyId }) => (
    <SpecialJournalTab companyId={companyId} readonly={false} prefix="CIER"
      emptyLabel="Todavía no registraste asientos de cierre." />
  ),
};
