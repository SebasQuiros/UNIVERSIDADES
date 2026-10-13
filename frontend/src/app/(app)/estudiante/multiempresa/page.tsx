'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { SceneEmptyBox } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Users, LogIn, ArrowRight, Building2, GraduationCap, Hash, Clock,
} from 'lucide-react';

/**
 * Espacio Multiempresa: las aulas donde los grupos comercian entre sí.
 *
 * Antes esta pantalla listaba grupos de práctica formados por las empresas
 * del Espacio Contador. Eso mezclaba dos mundos que no se tocan: la empresa
 * que un estudiante lleva por su cuenta no tiene nada que hacer compitiendo
 * en el aula de un profesor.
 *
 * El modelo correcto es el aula: el profesor abre una, reparte UN código, los
 * estudiantes entran, se arman en grupos, y cada grupo opera UNA empresa
 * compartida que factura y compra a los otros grupos de la misma aula.
 */

type EstadoAula =
  | 'DRAFT' | 'LOBBY' | 'EN_CURSO' | 'TRIBUTACION'
  | 'AUDITORIA' | 'CALIFICACION' | 'FINALIZADA' | 'CANCELADA';

interface Aula {
  participantId: string;
  joinedAt: string;
  classSessionId: string;
  code: string;
  status: EstadoAula;
  minGroupSize: number;
  maxGroupSize: number;
  exercise: {
    id: string;
    title: string;
    course?: { id: string; name: string } | null;
    teacher?: { id: string; name: string } | null;
  } | null;
  empresa: { id: string; name: string; legalId: string | null; _count?: { memberships: number } } | null;
}

const ESTADO: Record<EstadoAula, { texto: string; variante: 'emerald' | 'amber' | 'slate' | 'red' }> = {
  DRAFT:        { texto: 'Sin abrir',        variante: 'slate'   },
  LOBBY:        { texto: 'Armando grupos',   variante: 'amber'   },
  EN_CURSO:     { texto: 'En curso',         variante: 'emerald' },
  TRIBUTACION:  { texto: 'Tributación',      variante: 'amber'   },
  AUDITORIA:    { texto: 'Auditoría',        variante: 'amber'   },
  CALIFICACION: { texto: 'Calificando',      variante: 'amber'   },
  FINALIZADA:   { texto: 'Finalizada',       variante: 'slate'   },
  CANCELADA:    { texto: 'Cancelada',        variante: 'red'     },
};

export default function MultiempresaPage() {
  const router = useRouter();
  const [aulas, setAulas]   = useState<Aula[]>([]);
  const [loading, setLoading] = useState(true);
  const [codigo, setCodigo] = useState('');
  const [entrando, setEntrando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Aula[]>('/api/v1/class-sessions/mine');
      setAulas(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function unirse(e: React.FormEvent) {
    e.preventDefault();
    const limpio = codigo.trim().toUpperCase();
    if (limpio.length < 4) { toast.error('Escribí el código que te dio tu profesor'); return; }
    setEntrando(true);
    try {
      const { data } = await api.post<{ classSessionId: string }>(
        '/api/v1/class-sessions/join', { code: limpio },
      );
      toast.success('¡Entraste al aula!');
      router.push(`/estudiante/sesion/${data.classSessionId}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEntrando(false);
    }
  }

  const activas = aulas.filter((a) => a.status !== 'FINALIZADA' && a.status !== 'CANCELADA');
  const pasadas = aulas.filter((a) => a.status === 'FINALIZADA' || a.status === 'CANCELADA');

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      <PageHeader
        eyebrow="Espacio Multiempresa"
        title="Aulas de comercio entre empresas"
        subtitle="Tu grupo opera una empresa y le compra y le vende a los otros grupos de la misma aula."
        icon={Users}
        iconTint="#D4A017"
        className="mb-8"
      />

      {/* ── Entrar con el código ── */}
      <SectionCard
        eyebrow="Unirse"
        title="¿Te dieron un código?"
        description="Tu profesor proyecta el código del aula. Escribilo acá para entrar."
        icon={LogIn}
        iconTint="#1B2E6E"
        className="mb-8"
      >
        <form onSubmit={unirse} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Código del aula</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              autoComplete="off"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 font-mono text-lg tracking-[0.3em] uppercase focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <Button type="submit" loading={entrando} size="lg" className="cx-press">
            <LogIn className="h-4 w-4" /> Entrar al aula
          </Button>
        </form>
      </SectionCard>

      {/* ── Aulas ── */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : aulas.length === 0 ? (
        <div className="rounded-card border border-gray-200/70 bg-white shadow-card">
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="lp-drift" />}
            title="Todavía no estás en ninguna aula"
            description="Cuando tu profesor abra un aula de multiempresa te va a dar un código. Escribilo arriba y entrás con tu grupo."
          />
        </div>
      ) : (
        <>
          {activas.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.14em] text-gray-500">
                Aulas activas
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {activas.map((a) => <TarjetaAula key={a.participantId} a={a} />)}
              </div>
            </div>
          )}

          {pasadas.length > 0 && (
            <div>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.14em] text-gray-500">
                Aulas anteriores
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {pasadas.map((a) => <TarjetaAula key={a.participantId} a={a} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaAula({ a }: { a: Aula }) {
  const est = ESTADO[a.status] ?? ESTADO.DRAFT;
  // Sin empresa todavia significa que el grupo no esta armado: decirlo asi,
  // y no dejar la tarjeta muda, es lo que evita que el estudiante crea que
  // algo se rompio.
  const sinGrupo = !a.empresa;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-gray-200/70 bg-white p-5 shadow-card cx-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">
            {a.exercise?.course?.name ?? 'Aula'}
          </p>
          <h3 className="mt-0.5 font-bold leading-tight text-gray-900">
            {a.exercise?.title ?? 'Sesión de aula'}
          </h3>
          {a.exercise?.teacher?.name && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              <GraduationCap className="h-3.5 w-3.5" /> {a.exercise.teacher.name}
            </p>
          )}
        </div>
        <Badge variant={est.variante}>{est.texto}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5 font-mono text-xs text-gray-500">
          <Hash className="h-3.5 w-3.5" />{a.code}
        </span>
        {sinGrupo ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-700">
            <Clock className="h-3.5 w-3.5" /> Todavía sin grupo asignado
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-gray-700">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="font-semibold">{a.empresa!.name}</span>
            </span>
            {typeof a.empresa!._count?.memberships === 'number' && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Users className="h-3.5 w-3.5" />
                {a.empresa!._count.memberships} integrante{a.empresa!._count.memberships !== 1 ? 's' : ''}
              </span>
            )}
          </>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-400">
          Grupos de {a.minGroupSize} a {a.maxGroupSize}
        </span>
        <Link href={`/estudiante/sesion/${a.classSessionId}`}>
          <Button size="sm" className="cx-press">
            {sinGrupo ? 'Armar grupo' : 'Entrar'} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
