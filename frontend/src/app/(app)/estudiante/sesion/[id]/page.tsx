'use client';

// "Mi sesión" — cambia de contenido según `me.status` (viene del backend vía
// `GET class-sessions/:id/me`, sondeado con `setInterval`). Sin selector de
// fase: la fase la determina el servidor.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { cn, getErrorMessage } from '@/lib/utils';
import {
  ARCHETYPE_ICON, ARCHETYPE_LABELS, ARCHETYPE_DESCRIPTIONS, STATUS_LABELS,
  pollIntervalMs,
} from '@/lib/classSession';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { IconTile } from '@/components/ui/IconTile';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneEmptyBox, ArtInventory, ArtReport, SceneStudentDesk } from '@/components/illustrations';
import { SessionLeaderboard } from '@/components/session/SessionLeaderboard';
import { NegotiationsPanel } from '@/components/session/NegotiationsPanel';
import { MarketDirectory } from '@/components/session/MarketDirectory';
import { CommercialCountdown } from '@/components/session/CommercialCountdown';
import {
  Users, Building2, ArrowRight, ShieldCheck, ChevronRight,
  ExternalLink, Radar, Clock, Lock, Hourglass, Trophy,
} from 'lucide-react';
import type { MeResponse, LiveResponse, AuditAssignment } from '../types';

const WAITING_FACTS: string[] = [
  'En Costa Rica el XML es el comprobante legal ante Hacienda; el PDF es solo una representación.',
  'La ecuación contable nunca descansa: Activo = Pasivo + Patrimonio, siempre.',
  'Bajo NIIF para PYMES, el inventario se valúa al menor entre el costo y el valor neto realizable.',
  'Un auditor no prueba fraude: reporta diferencias y limitaciones al alcance (NIA 240 lo deja clarísimo).',
  '"Circularizar" es pedirle confirmación directa a un tercero — no volver a preguntarle a la propia empresa.',
  'El FIFO asume que lo primero que entra a la bodega es lo primero que sale.',
  'Una opinión "con salvedades" no invalida los estados financieros: los limita a un punto concreto.',
];

function archetypeBlurb(archetype: keyof typeof ARCHETYPE_LABELS) {
  return ARCHETYPE_DESCRIPTIONS[archetype];
}

export default function MiSesionPage() {
  const { id } = useParams<{ id: string }>();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<MeResponse>(`/api/v1/class-sessions/${id}/me`);
      setMe(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  const bucket = pollIntervalMs(me?.status) <= 4000 ? 'fast' : 'slow';
  useEffect(() => {
    const ms = bucket === 'fast' ? 4000 : 9000;
    const t = setInterval(refresh, ms);
    return () => clearInterval(t);
  }, [bucket, refresh]);

  // Heartbeat — mantiene el `onlineStatus` en ACTIVE para el tablero del profesor.
  useEffect(() => {
    const t = setInterval(() => {
      api.post(`/api/v1/class-sessions/${id}/ping`).catch(() => { /* silencioso */ });
    }, 45000);
    return () => clearInterval(t);
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
        <div className="space-y-6">
          <Skeleton className="h-16 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      </div>
    );
  }

  if (loadError || !me) {
    return (
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
        <div className="rounded-card border border-gray-200/70 bg-white shadow-card">
          <EmptyState
            illustration={<SceneEmptyBox size={180} />}
            title="No se pudo cargar tu sesión"
            description={loadError ?? 'Sesión no encontrada.'}
            action={
              <Link href="/estudiante/sesion/unirse">
                <Button variant="secondary">Unirme con otro código</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      <PageHeader
        eyebrow="Sesión de aula"
        title={me.company?.name ?? 'Tu sesión'}
        subtitle={STATUS_LABELS[me.status]}
        icon={Users}
        className="mb-6"
        actions={<Badge variant="blue">{STATUS_LABELS[me.status]}</Badge>}
      />

      {me.status === 'EN_CURSO' && <CommercialCountdown sessionId={id} />}
      {me.status !== 'DRAFT' && <SessionAnnouncements sessionId={id} />}

      {(me.status === 'DRAFT' || me.status === 'LOBBY') && !me.companyId && (
        <LobbyWaitPhase sessionId={id} />
      )}
      {(me.status === 'DRAFT' || me.status === 'LOBBY') && me.companyId && (
        <MiEmpresaPhase me={me} waitingToStart />
      )}
      {me.status === 'EN_CURSO' && <MiEmpresaPhase me={me} sessionId={id} />}
      {me.status === 'TRIBUTACION' && <TributacionPhase me={me} />}
      {me.status === 'AUDITORIA' && <AuditoriaPhase sessionId={id} me={me} />}
      {(me.status === 'CALIFICACION' || me.status === 'FINALIZADA') && <ResultsPendingPhase me={me} />}
    </div>
  );
}

// ── LOBBY — esperando asignación de grupo ───────────────────────────────────
function LobbyWaitPhase({ sessionId }: { sessionId: string }) {
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [factIdx, setFactIdx] = useState(0);

  const loadLive = useCallback(async () => {
    try {
      const { data } = await api.get<LiveResponse>(`/api/v1/class-sessions/${sessionId}/live`);
      setLive(data);
    } catch { /* silencioso: sección secundaria */ }
  }, [sessionId]);

  useEffect(() => { loadLive(); }, [loadLive]);
  useEffect(() => {
    const t = setInterval(loadLive, 4000);
    return () => clearInterval(t);
  }, [loadLive]);

  useEffect(() => {
    const id = setInterval(() => setFactIdx((i) => (i + 1) % WAITING_FACTS.length), 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 flex flex-col gap-5">
        <Card variant="onDark" className="lp-in">
          <div className="flex items-center gap-5 px-6 lg:px-7 py-6">
            <SceneStudentDesk size={110} className="hidden sm:block lp-float flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="cx-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                Estás dentro
              </p>
              <h2 className="text-lg font-bold leading-snug">Esperando a que tu profesor arme los grupos…</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-md">
                Cuando te asigne a un grupo vas a ver acá el arquetipo de negocio y a tus compañeros de equipo.
              </p>
            </div>
          </div>
        </Card>

        <div key={factIdx} className="cx-pop rounded-card border border-gold-100 bg-gold-50 px-5 py-4 flex items-start gap-3">
          <IconTile icon={Radar} tint="#B8860B" size={38} />
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-gold-900 mb-0.5">Mientras esperás</p>
            <p className="text-sm text-gray-700 leading-relaxed">{WAITING_FACTS[factIdx]}</p>
          </div>
        </div>
      </div>

      <SectionCard
        icon={Users}
        iconTint="#2563EB"
        eyebrow={live ? `${live.participantsCount} conectados` : 'Conectando…'}
        title="Empresas que ya se armaron"
        flushBody
        className="lp-in lp-in-d1"
      >
        {!live || live.groups.length === 0 ? (
          <div className="px-6 py-8 lg:px-7">
            <EmptyState
              illustration={<SceneEmptyBox size={120} />}
              title="Todavía no hay empresas"
              description="Tu profesor las va a ir creando durante la sala de espera."
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {live.groups.map((g) => {
              const Icon = ARCHETYPE_ICON[g.archetype];
              return (
                <div key={g.companyId} className="flex items-center gap-3 px-6 lg:px-7 py-2.5">
                  <IconTile icon={Icon} tint="#1B2E6E" size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{g.name}</p>
                    <p className="text-xs text-gray-400">{ARCHETYPE_LABELS[g.archetype]}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Clock className="w-3 h-3" /> {g.memberCount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── MI EMPRESA ───────────────────────────────────────────────────────────────
function MiEmpresaPhase({ me, waitingToStart, sessionId }: { me: MeResponse; waitingToStart?: boolean; sessionId?: string }) {
  const { user } = useAuth();
  if (!me.company) return null;
  const archetype = me.company.archetype;

  return (
    <div className="flex flex-col gap-5">
      <Card variant="onDark" className="lp-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
          <div className="flex-1 min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
              Te tocó
            </p>
            <h2 className="text-xl font-bold leading-snug">{me.company.name}</h2>
            <p className="mt-1 text-sm text-blue-200/80">
              Cédula jurídica {me.company.legalId || 'sin asignar'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="gold">{ARCHETYPE_LABELS[archetype]}</Badge>
              <Badge variant="blue">{me.groupMembers.length} integrantes</Badge>
            </div>
            <p className="mt-3 text-sm text-blue-100/90 max-w-lg">{archetypeBlurb(archetype)}</p>
          </div>
          <ArtInventory size={150} className="lp-drift flex-shrink-0" />
        </div>
      </Card>

      {waitingToStart && (
        <div className="flex items-center gap-3 rounded-card border border-gold-100 bg-gold-50/70 p-4 shadow-card">
          <IconTile icon={Hourglass} tint="#B8860B" size={38} />
          <p className="text-sm text-gray-700">Ya estás en tu grupo. Esperá a que tu profesor inicie el periodo para empezar a operar.</p>
        </div>
      )}

      {!waitingToStart && sessionId && (
        <>
          <MarketDirectory sessionId={sessionId} myCompanyId={me.companyId ?? undefined} />
          <NegotiationsPanel sessionId={sessionId} myCompanyId={me.companyId ?? undefined} />
          <SessionLeaderboard sessionId={sessionId} myCompanyId={me.companyId ?? undefined} />
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard icon={Users} iconTint="#2563EB" eyebrow="Tu grupo" title="Compañeros de equipo" className="lp-in lp-in-d1">
          <div className="flex flex-col gap-2.5">
            {me.groupMembers.map((m) => {
              const isYou = m.id === user?.id;
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 border',
                    isYou ? 'bg-gold-50 border-gold-100' : 'bg-gray-50 border-gray-100',
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: isYou ? 'linear-gradient(145deg,#D4A017,#B8860B)' : 'linear-gradient(145deg,#2563EB,#1B2E6E)' }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {m.name}{isYou && <span className="text-gold-900"> (vos)</span>}
                    </p>
                    <p className="text-xs text-gray-500">{m.role === 'LEADER' ? 'Representante del grupo' : 'Integrante'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard icon={Building2} iconTint="#B8860B" eyebrow="Operá la empresa" title="Libros contables del grupo" className="lp-in lp-in-d2">
          {me.attemptId ? (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Tu grupo ya tiene un ejercicio abierto para {me.company.name}. Ahí registrás facturas, inventario, asientos y todo el ciclo contable.
              </p>
              <Link href={`/estudiante/ejercicio/${me.attemptId}`}>
                <Button variant="gold" className="w-full sm:w-auto">
                  Ir al workspace contable <ExternalLink className="w-4 h-4" />
                </Button>
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Tu ejercicio se crea automáticamente cuando el profesor inicie el periodo.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ── TRIBUTACIÓN ──────────────────────────────────────────────────────────────
const DECLARACIONES = [
  { code: 'd104', label: 'D-104 IVA' },
  { code: 'd101', label: 'D-101 Renta' },
  { code: 'd103', label: 'D-103 Retenciones' },
  { code: 'd115', label: 'D-115 Dividendos' },
] as const;

function TributacionPhase({ me }: { me: MeResponse }) {
  return (
    <div className="flex flex-col gap-5">
      <MiEmpresaPhase me={me} />
      <div className="flex items-start gap-3.5 rounded-card border border-gold-100 bg-gold-50/60 p-5 shadow-card">
        <IconTile icon={Lock} tint="#B8860B" size={44} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-gold-900">El período está cerrado</p>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
            Tu empresa ya no admite nuevos asientos. Si te falta presentar alguna declaración (D-101, D-103,
            D-104 o D-115), este es el momento. Cuando tu profesor publique el snapshot, empieza la auditoría
            cruzada entre empresas.
          </p>
        </div>
      </div>
      {/* Enlaces a las declaraciones ANCLADAS a la empresa del grupo (companyId):
          así lo que presente el equipo entra al snapshot de auditoría de ESTA
          empresa y no se mezcla con otras declaraciones del estudiante. */}
      {me.companyId && (
        <div className="rounded-card border border-gray-100 bg-white p-5 shadow-card">
          <p className="text-sm font-bold text-gray-800">Presentá las declaraciones de tu empresa</p>
          <p className="mt-1 text-xs text-gray-500">
            Quedan ancladas a {me.company?.name ?? 'tu empresa'} para la auditoría cruzada.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DECLARACIONES.map(d => (
              <Link
                key={d.code}
                href={`/estudiante/impuestos/${d.code}?companyId=${me.companyId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gold-300 hover:bg-gold-50"
              >
                <ExternalLink className="h-4 w-4 text-gold-700" /> {d.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AUDITORÍA (resumen; el expediente completo vive en /auditoria) ─────────
function AuditoriaPhase({ sessionId, me }: { sessionId: string; me: MeResponse }) {
  const [assignment, setAssignment] = useState<AuditAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get<AuditAssignment>(`/api/v1/class-sessions/${sessionId}/audit/assignment`)
      .then(({ data }) => { if (active) setAssignment(data); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [sessionId]);

  return (
    <div className="flex flex-col gap-5">
      {me.company && <MiEmpresaPhase me={me} />}

      <Card variant="onDark" className="lp-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
          <div className="flex-1 min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
              Te toca auditar a
            </p>
            {assignment ? (
              <>
                <h2 className="text-xl font-bold leading-snug">{assignment.auditeeName}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="gold">{ARCHETYPE_LABELS[assignment.archetype]}</Badge>
                </div>
                <p className="mt-3 text-sm text-blue-100/90 max-w-lg">
                  Vas a recibir su paquete de estados financieros <strong>congelado</strong>. No vas a ver sus
                  libros vivos — como un auditor real, trabajás solo con lo que la empresa entrega.
                </p>
              </>
            ) : error ? (
              <p className="text-sm text-red-200">{error}</p>
            ) : (
              <Skeleton className="h-6 w-48" />
            )}
          </div>
          <ArtReport size={140} className="lp-drift flex-shrink-0" />
        </div>
      </Card>

      <Link href={`/estudiante/sesion/${sessionId}/auditoria`} className="self-start">
        <Button variant="gold" size="lg">
          Abrir expediente de auditoría <ChevronRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}

// ── CALIFICACIÓN / FINALIZADA ───────────────────────────────────────────────
// El backend todavía no expone un resultado consolidado para el estudiante
// (los puntajes y el podio solo están en el dashboard del profesor). Mientras
// no exista ese endpoint, se muestra un estado de cierre honesto.
function ResultsPendingPhase({ me }: { me: MeResponse }) {
  return (
    <div className="flex flex-col gap-5">
      {me.company && <MiEmpresaPhase me={me} />}
      <Card variant="onDark" className="lp-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
          <div className="flex-1 min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
              {me.status === 'FINALIZADA' ? 'Sesión finalizada' : 'Cerrando la sesión'}
            </p>
            <h2 className="text-xl font-bold leading-snug">
              {me.status === 'FINALIZADA' ? 'La sesión terminó' : 'Tu profesor está calificando'}
            </h2>
            <p className="mt-1.5 text-sm text-blue-200/80 max-w-md">
              Tu profesor va a compartir el resultado y las devoluciones en clase.
            </p>
          </div>
          <IconTile icon={Trophy} tint="#B8860B" size={64} onDark />
        </div>
      </Card>
    </div>
  );
}

// ── Anuncios del profesor (noticias de la sesión) ─────────────────────────────
interface Announcement { id: string; kind: string; title: string; body: string | null; createdAt: string; }

function SessionAnnouncements({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.get<Announcement[]>(`/api/v1/class-sessions/${sessionId}/announcements`)
        .then(({ data }) => { if (alive) setItems(Array.isArray(data) ? data : []); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [sessionId]);

  if (items.length === 0) return null;
  const style = (k: string) => k === 'ALERTA'
    ? { bg: 'bg-red-50', bd: 'border-red-200', tx: 'text-red-800', chip: 'bg-red-600' }
    : k === 'EVENTO'
    ? { bg: 'bg-purple-50', bd: 'border-purple-200', tx: 'text-purple-800', chip: 'bg-purple-600' }
    : { bg: 'bg-blue-50', bd: 'border-blue-200', tx: 'text-blue-800', chip: 'bg-blue-600' };

  return (
    <div className="mb-6 space-y-2">
      {items.slice(0, 3).map((a) => {
        const s = style(a.kind);
        return (
          <div key={a.id} className={cn('flex items-start gap-3 rounded-card border px-4 py-3', s.bg, s.bd)}>
            <span className={cn('mt-0.5 flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white', s.chip)}>{a.kind}</span>
            <div className="min-w-0">
              <p className={cn('text-sm font-bold', s.tx)}>{a.title}</p>
              {a.body && <p className="mt-0.5 text-sm text-gray-600">{a.body}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

