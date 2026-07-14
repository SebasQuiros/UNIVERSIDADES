'use client';

/**
 * Página de configuración del ejercicio (Fase 1 — Config Engine).
 *
 * Acceso: TEACHER / ADMIN / SUPERADMIN.
 * Bloqueo: si el ejercicio está publicado (`isPublished=true`), todos los
 * controles se ven deshabilitados y el botón "Guardar" está oculto.
 * El backend también valida el lock; el lock visual es solo UX.
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Lock, Save, Users, BookOpen, ShieldCheck, Boxes, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneSearchEmpty } from '@/components/illustrations';
import { getErrorMessage } from '@/lib/utils';
import { GroupsPanel } from './GroupsPanel';

// ── Types alineados con el DTO del backend ────────────────────────
type CompanyMode = 'INDIVIDUAL' | 'GROUP';

interface ExerciseConfig {
  id: string;
  exerciseId: string;
  companyMode: CompanyMode;
  autoJournal: boolean;
  autoLedger: boolean;
  autoTrialBalance: boolean;
  autoAR: boolean;
  autoAP: boolean;
  autoInventory: boolean;
  autoTransactionsBetweenCompanies: boolean;
}

interface ExerciseLite {
  id: string;
  title: string;
  isPublished: boolean;
  isArchived: boolean;
}

// ── Toggle inline (sin agregar dependencias) ──────────────────────
function Toggle({
  checked, onChange, disabled, label, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label className={`flex items-start gap-3 py-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cx-press ${
          checked ? 'bg-gradient-to-br from-blue-600 to-[#1B2E6E]' : 'bg-gray-300'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
      </div>
    </label>
  );
}

export default function ExerciseConfigPage() {
  const { id }       = useParams<{ id: string }>();
  const search       = useSearchParams();
  const cursoId      = search.get('cursoId') ?? '';

  const [config,   setConfig]   = useState<ExerciseConfig | null>(null);
  const [exercise, setExercise] = useState<ExerciseLite | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // En paralelo: config + ejercicio (necesitamos isPublished para el lock).
        const [cfgRes, exRes] = await Promise.all([
          api.get<ExerciseConfig>(`/api/v1/exercises/${id}/config`),
          cursoId
            ? api.get<ExerciseLite>(`/api/v1/courses/${cursoId}/exercises/${id}`)
            : Promise.resolve({ data: null as ExerciseLite | null }),
        ]);
        if (cancelled) return;
        setConfig(cfgRes.data);
        if (exRes.data) setExercise(exRes.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, cursoId]);

  const isLocked = !!exercise?.isPublished;

  function patch<K extends keyof ExerciseConfig>(key: K, value: ExerciseConfig[K]) {
    if (!config || isLocked) return;
    setConfig({ ...config, [key]: value });
  }

  /**
   * Persiste la config en el backend. Usado por:
   *   1. El botón "Guardar configuración" — guarda todos los toggles juntos.
   *   2. El cambio de `companyMode` — auto-save inmediato porque ese cambio
   *      determina si aparece el GroupsPanel; sin auto-save, el profe podía
   *      seleccionar "Grupal" en UI, ver el panel, intentar crear empresa,
   *      y el backend rechazaba con "modo INDIVIDUAL" porque la config no
   *      estaba persistida aún.
   */
  async function persistConfig(override?: Partial<ExerciseConfig>) {
    if (!config) return;
    const next = { ...config, ...(override ?? {}) };
    setSaving(true);
    try {
      // Whitelist explícita: el DTO del backend usa `forbidNonWhitelisted: true`
      // y solo acepta estos campos. Mandar `id`, `exerciseId`, `createdAt`,
      // `updatedAt` (que vienen en la respuesta del GET) genera 400 silente.
      const payload = {
        companyMode:                      next.companyMode,
        autoJournal:                      next.autoJournal,
        autoLedger:                       next.autoLedger,
        autoTrialBalance:                 next.autoTrialBalance,
        autoAR:                           next.autoAR,
        autoAP:                           next.autoAP,
        autoInventory:                    next.autoInventory,
        autoTransactionsBetweenCompanies: next.autoTransactionsBetweenCompanies,
      };
      const { data } = await api.put<ExerciseConfig>(
        `/api/v1/exercises/${id}/config`,
        payload,
      );
      setConfig(data);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const ok = await persistConfig();
    if (ok) toast.success('Configuración guardada');
  }

  /** Cambio de modo de empresa con auto-save inmediato. */
  async function changeCompanyMode(mode: 'INDIVIDUAL' | 'GROUP') {
    if (!config || isLocked || config.companyMode === mode) return;
    // Optimistic update para UI instantánea, luego PUT.
    setConfig({ ...config, companyMode: mode });
    const ok = await persistConfig({ companyMode: mode });
    if (ok) {
      toast.success(
        mode === 'GROUP'
          ? 'Modo cambiado a Grupal — ya podés crear empresas abajo'
          : 'Modo cambiado a Individual',
      );
    } else {
      // Revertir UI si falló el save
      setConfig(c => c ? { ...c, companyMode: config.companyMode } : c);
    }
  }

  if (loading) {
    return <div className="flex-1 flex justify-center bg-[#F4F6F8] py-20"><Spinner size="lg" /></div>;
  }
  if (!config) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6 lg:p-8">
        <div className="mx-auto max-w-3xl rounded-card border border-gray-200/70 bg-white shadow-card">
          <EmptyState
            illustration={<SceneSearchEmpty size={190} className="cx-float" />}
            title="No se encontró la configuración"
            description="Vuelve al ejercicio e inténtalo de nuevo."
          />
        </div>
      </div>
    );
  }

  const backHref = cursoId
    ? `/profesor/ejercicios/${id}?cursoId=${cursoId}`
    : `/profesor/ejercicios/${id}`;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href={backHref} className="flex items-center gap-1 transition-colors hover:text-gray-700">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al ejercicio
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">Configuración</span>
        </div>

        <PageHeader
          eyebrow="Configuración"
          title="Configuración del ejercicio"
          subtitle={exercise?.title ?? '—'}
          icon={Settings2}
          actions={
            !isLocked ? (
              <Button onClick={handleSave} disabled={saving} loading={saving} className="cx-press">
                <Save className="w-4 h-4" />
                {saving ? 'Guardando…' : 'Guardar configuración'}
              </Button>
            ) : undefined
          }
        />

        {/* Banner: bloqueado si publicado */}
        {isLocked && (
          <div className="flex items-start gap-3 rounded-card border border-gold-100 bg-gold-50 px-5 py-4 text-gold-900 cx-pop">
            <Lock className="mt-0.5 w-5 h-5 flex-shrink-0 text-gold-700" />
            <div className="text-sm">
              <strong>Configuración bloqueada.</strong>{' '}
              El ejercicio ya fue publicado, por lo que la configuración quedó congelada
              para garantizar consistencia entre estudiantes.
              Para modificarla, despublicá el ejercicio primero.
            </div>
          </div>
        )}

        {/* Modo empresa */}
        <SectionCard
          icon={Users}
          iconTint="#2563EB"
          eyebrow="Estructura"
          title="Modo de empresa"
          description="Definí si cada estudiante tiene su propia empresa (individual) o si los estudiantes se agrupan en empresas compartidas (grupal)."
          className="cx-pop cx-d1"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(['INDIVIDUAL', 'GROUP'] as const).map(mode => {
              const active = config.companyMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={isLocked}
                  onClick={() => changeCompanyMode(mode)}
                  className={`rounded-xl border-2 p-4 text-left transition cx-press ${
                    active
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <div className="text-sm font-bold text-gray-900">
                    {mode === 'INDIVIDUAL' ? 'Individual' : 'Grupal'}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-gray-600">
                    {mode === 'INDIVIDUAL'
                      ? 'Cada estudiante recibe una empresa propia (una empresa = un estudiante).'
                      : 'Varios estudiantes comparten la misma empresa (proyectos en equipo).'}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Empresas grupales — solo cuando companyMode === GROUP */}
        {config.companyMode === 'GROUP' && (
          <GroupsPanel exerciseId={String(id)} locked={isLocked} />
        )}

        {/* Automatización contable */}
        <SectionCard
          icon={BookOpen}
          iconTint="#059669"
          eyebrow="Motor contable"
          title="Automatización contable"
          description="Si está activado, el sistema genera automáticamente los registros al ocurrir un hecho contable. Si está desactivado, el estudiante debe crearlos manualmente."
          className="cx-pop cx-d2"
        >
          <div className="divide-y divide-gray-100">
            <Toggle
              disabled={isLocked}
              checked={config.autoJournal}
              onChange={v => patch('autoJournal', v)}
              label="Asientos automáticos en el diario"
              hint="Cada venta/compra genera la partida doble correspondiente."
            />
            <Toggle
              disabled={isLocked}
              checked={config.autoLedger}
              onChange={v => patch('autoLedger', v)}
              label="Mayor automático"
              hint="Las cuentas se actualizan al guardar asientos."
            />
            <Toggle
              disabled={isLocked}
              checked={config.autoTrialBalance}
              onChange={v => patch('autoTrialBalance', v)}
              label="Balance de comprobación automático"
              hint="Se recalcula al cierre del período."
            />
            <Toggle
              disabled={isLocked}
              checked={config.autoAR}
              onChange={v => patch('autoAR', v)}
              label="Cuentas por Cobrar automáticas"
              hint="Toda factura crea su saldo en el auxiliar de clientes."
            />
            <Toggle
              disabled={isLocked}
              checked={config.autoAP}
              onChange={v => patch('autoAP', v)}
              label="Cuentas por Pagar automáticas"
              hint="Toda compra crea su saldo en el auxiliar de proveedores."
            />
          </div>
        </SectionCard>

        {/* Inventario y triangulación */}
        <SectionCard
          icon={Boxes}
          iconTint="#B8860B"
          eyebrow="Operaciones"
          title="Inventario y triangulación"
          className="cx-pop cx-d3"
        >
          <div className="divide-y divide-gray-100">
            <Toggle
              disabled={isLocked}
              checked={config.autoInventory}
              onChange={v => patch('autoInventory', v)}
              label="Inventario automático (FIFO)"
              hint="Las compras crean lotes; las ventas consumen el más antiguo y registran COGS."
            />
            <Toggle
              disabled={isLocked}
              checked={config.autoTransactionsBetweenCompanies}
              onChange={v => patch('autoTransactionsBetweenCompanies', v)}
              label="Transacciones automáticas entre empresas"
              hint="Cuando una empresa del ejercicio le vende a otra, se crean las contrapartidas en ambas."
            />
          </div>
        </SectionCard>

        {/* Aviso de alcance */}
        <div className="flex items-start gap-2 px-1 pb-8 text-xs text-gray-500">
          <ShieldCheck className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          <span>
            Esta configuración aplica a <strong>todas</strong> las empresas y a
            todos los intentos derivados de este ejercicio.
          </span>
        </div>
      </div>
    </div>
  );
}
