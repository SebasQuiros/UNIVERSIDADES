'use client';

// ── FASE 1 — Andamiaje de maqueta ────────────────────────────────────────────
// "Mi sesión" — cambia de contenido según la fase de la Sesión de Aula. En una
// sesión real la fase la controla el profesor desde su panel (`/profesor/sesiones`)
// y este componente la recibiría por API/WebSocket; acá se maneja con
// `useState` y un selector de fase VISIBLE (marcado como andamiaje) para poder
// recorrer las 4 pantallas sin backend. En fase 2, reemplazar por datos reales
// y el selector desaparece.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { IconTile } from '@/components/ui/IconTile';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ArtInventory, ArtReport, ArtGrowth, SceneStudentDesk } from '@/components/illustrations';
import {
  Users, FlaskConical, Building2, ArrowRight, ShieldCheck, ChevronRight,
  Trophy, Crown, Medal, Store, Wallet, CircleAlert, CheckCircle2,
  ExternalLink, Ticket, ClipboardList, Handshake, Radar, Clock,
} from 'lucide-react';
import {
  MOCK_SESSION, LOBBY_PARTICIPANTS, WAITING_FACTS, MY_COMPANY, ARCHETYPES,
  MY_AUDIT_ASSIGNMENT, MY_COMPANY_AUDITOR_NAME, FINDINGS_AGAINST_MY_COMPANY,
  SESSION_RESULTS, PHASES,
  type SessionPhase,
} from '../_mock';

export default function MiSesionPage() {
  const [phase, setPhase] = useState<SessionPhase>('LOBBY');

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      <PageHeader
        eyebrow="Sesión de aula"
        title={MOCK_SESSION.title}
        subtitle={`${MOCK_SESSION.courseName} · ${MOCK_SESSION.teacherName}`}
        icon={Users}
        className="mb-5"
        actions={
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200/70 shadow-card">
            <span className="text-xs text-gray-400">Código</span>
            <code className="text-sm font-mono font-bold text-gray-900 tracking-widest">{MOCK_SESSION.code}</code>
          </div>
        }
      />

      {/* Andamiaje: selector de fase (fase 1, sin backend) */}
      <div className="lp-in mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-700">
          <FlaskConical className="w-3.5 h-3.5" /> Andamiaje · recorré las fases
        </span>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {PHASES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPhase(p.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-all cx-press',
                phase === p.key
                  ? 'bg-blue-600 text-white shadow-card'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {phase === 'LOBBY' && <LobbyPhase />}
      {phase === 'MI_EMPRESA' && <MiEmpresaPhase />}
      {phase === 'AUDITORIA' && <AuditoriaPhase sessionId={MOCK_SESSION.id} />}
      {phase === 'RESULTADOS' && <ResultadosPhase />}
    </div>
  );
}

// ── LOBBY ────────────────────────────────────────────────────────────────────
function LobbyPhase() {
  const { user } = useAuth();
  const [factIdx, setFactIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFactIdx((i) => (i + 1) % WAITING_FACTS.length), 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 flex flex-col gap-5">
        {/* Estado de espera */}
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
              <h2 className="text-lg font-bold leading-snug">Esperando a que tu profesor inicie la sesión…</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-md">
                Cuando arranque, cada quien queda en un grupo con un arquetipo de negocio. Mientras tanto, quedate en esta pantalla.
              </p>
            </div>
          </div>
        </Card>

        {/* Dato contable curioso, para que la espera no sea aburrida */}
        <div key={factIdx} className="cx-pop rounded-card border border-gold-100 bg-gold-50 px-5 py-4 flex items-start gap-3">
          <IconTile icon={Radar} tint="#B8860B" size={38} />
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-gold-900 mb-0.5">Mientras esperás</p>
            <p className="text-sm text-gray-700 leading-relaxed">{WAITING_FACTS[factIdx]}</p>
          </div>
        </div>
      </div>

      {/* Participantes */}
      <SectionCard
        icon={Users}
        iconTint="#2563EB"
        eyebrow={`${MOCK_SESSION.participantsCount} conectados`}
        title="Quién más se unió"
        flushBody
        className="lp-in lp-in-d1"
      >
        <div className="max-h-[26rem] overflow-y-auto divide-y divide-gray-100">
          {LOBBY_PARTICIPANTS.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-3 px-6 lg:px-7 py-2.5 cx-pop',
                i < 6 ? `cx-d${i + 1}` : undefined,
                p.isYou && 'bg-blue-50/60',
              )}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ background: p.isYou ? 'linear-gradient(145deg,#D4A017,#B8860B)' : 'linear-gradient(145deg,#2563EB,#1B2E6E)' }}
              >
                {(p.isYou ? (user?.name ?? p.name) : p.name).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {p.isYou ? (user?.name ?? p.name) : p.name}
                  {p.isYou && <span className="text-blue-700 font-bold"> (vos)</span>}
                </p>
              </div>
              <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                <Clock className="w-3 h-3" /> {p.joinedAgo}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ── MI EMPRESA ───────────────────────────────────────────────────────────────
function MiEmpresaPhase() {
  const { user } = useAuth();
  const archetype = ARCHETYPES[MY_COMPANY.archetype];

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado de empresa */}
      <Card variant="onDark" className="lp-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
          <div className="flex-1 min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
              Te tocó
            </p>
            <h2 className="text-xl font-bold leading-snug">{MY_COMPANY.name}</h2>
            <p className="mt-1 text-sm text-blue-200/80">
              Cédula jurídica {MY_COMPANY.legalId}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="gold">{archetype.label}</Badge>
              <Badge variant="blue">{MY_COMPANY.members.length} integrantes</Badge>
            </div>
            <p className="mt-3 text-sm text-blue-100/90 max-w-lg">{archetype.description}</p>
          </div>
          <ArtInventory size={150} className="lp-drift flex-shrink-0" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Compañeros de equipo */}
        <SectionCard icon={Users} iconTint="#2563EB" eyebrow="Tu grupo" title="Compañeros de equipo" className="lp-in lp-in-d1">
          <div className="flex flex-col gap-2.5">
            {MY_COMPANY.members.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 border',
                  m.isYou ? 'bg-gold-50 border-gold-100' : 'bg-gray-50 border-gray-100',
                )}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: m.isYou ? 'linear-gradient(145deg,#D4A017,#B8860B)' : 'linear-gradient(145deg,#2563EB,#1B2E6E)' }}
                >
                  {(m.isYou ? (user?.name ?? m.name) : m.name).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {m.isYou ? (user?.name ?? m.name) : m.name}{m.isYou && <span className="text-gold-900"> (vos)</span>}
                  </p>
                  <p className="text-xs text-gray-500">{m.suggestedRole}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Ir al workspace */}
        <SectionCard icon={Store} iconTint="#B8860B" eyebrow="Operá la empresa" title="Libros contables del grupo" className="lp-in lp-in-d2">
          <p className="text-sm text-gray-500 mb-4">
            Tu grupo ya tiene un ejercicio abierto para {MY_COMPANY.name}. Ahí registrás facturas, inventario, asientos y todo el ciclo contable.
          </p>
          <Link href={`/estudiante/ejercicio/${MY_COMPANY.attemptId}`}>
            <Button variant="gold" className="w-full sm:w-auto">
              Ir al workspace contable <ExternalLink className="w-4 h-4" />
            </Button>
          </Link>
        </SectionCard>
      </div>

      {/* Cadena de suministro */}
      <SectionCard
        icon={ArrowRight}
        iconTint="#1B2E6E"
        eyebrow="Comercio entre empresas"
        title="A quién le comprás y a quién le vendés"
        description="Cada compra/venta entre grupos genera inventario, CxC/CxP y asientos en ambas empresas."
        className="lp-in lp-in-d3"
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4">
          {/* Le compra a */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Le podés comprar a</p>
            <div className="flex flex-col gap-2">
              {MY_COMPANY.buysFrom.map((s) => (
                <div key={s.companyId} className="rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-3">
                  <p className="text-sm font-semibold text-gray-900">{s.companyName}</p>
                  <p className="text-xs text-blue-700 font-medium mb-1">{ARCHETYPES[s.archetype].label}</p>
                  <p className="text-xs text-gray-500">{s.note}</p>
                </div>
              ))}
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-gray-300 mx-auto hidden md:block" />

          {/* Mi empresa (centro) */}
          <div className="rounded-xl border-2 border-gold-100 bg-gold-50 px-4 py-4 text-center">
            <Building2 className="w-5 h-5 text-gold-900 mx-auto mb-1.5" />
            <p className="text-sm font-bold text-gray-900">{MY_COMPANY.name}</p>
            <p className="text-xs text-gold-900">(vos y tu grupo)</p>
          </div>

          <ArrowRight className="w-5 h-5 text-gray-300 mx-auto hidden md:block" />

          {/* Le vende a */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Le podés vender a</p>
            <div className="flex flex-col gap-2">
              {MY_COMPANY.sellsTo.map((s) => (
                <div key={s.companyId} className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-3">
                  <p className="text-sm font-semibold text-gray-900">{s.companyName}</p>
                  <p className="text-xs text-emerald-700 font-medium mb-1">{ARCHETYPES[s.archetype].label}</p>
                  <p className="text-xs text-gray-500">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── AUDITORÍA (resumen; el expediente completo vive en /auditoria) ─────────
function AuditoriaPhase({ sessionId }: { sessionId: string }) {
  const a = MY_AUDIT_ASSIGNMENT;
  const archetype = ARCHETYPES[a.auditeeArchetype];

  return (
    <div className="flex flex-col gap-5">
      <Card variant="onDark" className="lp-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
          <div className="flex-1 min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
              Te toca auditar a
            </p>
            <h2 className="text-xl font-bold leading-snug">{a.auditeeCompanyName}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="gold">{archetype.label}</Badge>
              <Badge variant="blue">{a.periodLabel}</Badge>
            </div>
            <p className="mt-3 text-sm text-blue-100/90 max-w-lg">
              Vas a recibir su paquete de estados financieros <strong>congelado</strong>, comparativo contra {a.priorPeriodLabel}.
              No vas a ver sus libros vivos — como un auditor real, trabajás solo con lo que la empresa entrega.
            </p>
          </div>
          <ArtReport size={140} className="lp-drift flex-shrink-0" />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Presupuesto de auditoría" value={`${a.budgetTotal} fichas`} hint="para pedir evidencia y reportar hallazgos" icon={Ticket} tint="#B8860B" className="lp-in lp-in-d1" />
        <StatCard label="Empresa auditada" value={archetype.label} hint={a.auditeeCompanyName} icon={Building2} tint="#2563EB" className="lp-in lp-in-d2" />
        <StatCard label="A vos te audita" value={MY_COMPANY_AUDITOR_NAME} hint="revisa los estados de tu empresa" icon={ShieldCheck} tint="#1B2E6E" className="lp-in lp-in-d3" />
      </div>

      <SectionCard icon={ClipboardList} iconTint="#1B2E6E" eyebrow="Cómo funciona" title="Dos reglas del expediente" className="lp-in lp-in-d4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <IconTile icon={Wallet} tint="#B8860B" size={40} />
            <div>
              <p className="text-sm font-semibold text-gray-900">El presupuesto es finito</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Cada evidencia y cada hallazgo reportado gasta fichas. No te van a alcanzar para pedirlo todo: priorizá por riesgo.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <IconTile icon={Handshake} tint="#2563EB" size={40} />
            <div>
              <p className="text-sm font-semibold text-gray-900">Todo hallazgo cita evidencia</p>
              <p className="text-sm text-gray-500 mt-0.5">
                No se vale reportar "algo se ve raro". Cada hallazgo debe señalar el documento concreto que lo respalda.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <Link href={`/estudiante/sesion/${sessionId}/auditoria`} className="self-start">
        <Button variant="gold" size="lg">
          Abrir expediente de auditoría <ChevronRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}

// ── RESULTADOS ───────────────────────────────────────────────────────────────
function rankVisual(rank: number) {
  if (rank === 1) return { bg: 'linear-gradient(135deg,#FBBF24,#B8860B)', icon: Crown, color: '#fff' };
  if (rank === 2) return { bg: 'linear-gradient(135deg,#CBD5E1,#94A3B8)', icon: Medal, color: '#fff' };
  if (rank === 3) return { bg: 'linear-gradient(135deg,#D4A017,#8A6608)', icon: Medal, color: '#fff' };
  return { bg: '#F1F5F9', icon: Trophy, color: '#64748B' };
}

function ResultadosPhase() {
  const ranked = [...SESSION_RESULTS].sort((a, b) => b.combinedScore - a.combinedScore);
  const mine = ranked.find((r) => r.isMine);
  const myRank = mine ? ranked.indexOf(mine) + 1 : null;

  return (
    <div className="flex flex-col gap-5">
      <Card variant="onDark" className="lp-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
          <div className="flex-1 min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
              Cerró la sesión
            </p>
            <h2 className="text-xl font-bold leading-snug">
              {mine ? `Tu empresa quedó en el puesto #${myRank} de ${ranked.length}` : 'Resultados de la sesión'}
            </h2>
            <p className="mt-1.5 text-sm text-blue-200/80 max-w-md">
              El puntaje combina lo bien que llevaron la contabilidad de {MY_COMPANY.name} y la calidad de tu trabajo como auditor.
            </p>
          </div>
          <ArtGrowth size={140} className="lp-drift flex-shrink-0" />
        </div>
      </Card>

      {mine && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Contabilidad" value={`${mine.accountingScore}/100`} hint="tu empresa, como se llevaron los libros" icon={Building2} tint="#2563EB" className="lp-in lp-in-d1" />
          <StatCard label="Auditoría" value={`${mine.auditScore}/100`} hint="tu desempeño auditando" icon={ShieldCheck} tint="#B8860B" className="lp-in lp-in-d2" />
          <StatCard label="Puntaje combinado" value={mine.combinedScore.toFixed(1)} hint={`Puesto #${myRank} de ${ranked.length}`} icon={Trophy} tint="#1B2E6E" className="lp-in lp-in-d3" />
        </div>
      )}

      {/* Tabla de posiciones */}
      <SectionCard icon={Trophy} iconTint="#B8860B" eyebrow={`${ranked.length} empresas`} title="Posiciones de la sesión" flushBody className="lp-in lp-in-d4">
        <div className="divide-y divide-gray-100">
          {ranked.map((r, i) => {
            const rank = i + 1;
            const rv = rankVisual(rank);
            const RankIcon = rv.icon;
            return (
              <div
                key={r.companyId}
                className={cn('flex items-center gap-3 px-6 lg:px-7 py-3.5 cx-pop', i < 6 ? `cx-d${i + 1}` : undefined, r.isMine && 'bg-blue-50/60')}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm font-mono tabular-nums" style={{ background: rv.bg, color: rv.color }}>
                  {rank <= 3 ? <RankIcon className="w-4 h-4" /> : rank}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {r.companyName}{r.isMine && <span className="text-blue-700 font-bold"> (tu empresa)</span>}
                  </p>
                  <p className="text-xs text-gray-400">{ARCHETYPES[r.archetype].label}</p>
                </div>
                <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-xs text-gray-500">
                  <span>Contab. <strong className="text-gray-800">{r.accountingScore}</strong></span>
                  <span>Audit. <strong className="text-gray-800">{r.auditScore}</strong></span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-base font-extrabold text-gray-900 font-mono tabular-nums">{r.combinedScore.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Hallazgos sobre mi empresa */}
      <SectionCard
        icon={CircleAlert}
        iconTint="#B8860B"
        eyebrow={`Auditada por ${MY_COMPANY_AUDITOR_NAME}`}
        title="Hallazgos reportados sobre tu empresa"
        className="lp-in lp-in-d5"
      >
        {FINDINGS_AGAINST_MY_COMPANY.length === 0 ? (
          <p className="text-sm text-gray-500">Tu auditor no reportó hallazgos sobre {MY_COMPANY.name}.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {FINDINGS_AGAINST_MY_COMPANY.map((f) => (
              <div key={f.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                  <Badge variant={f.status === 'ACEPTADO' ? 'amber' : f.status === 'RECHAZADO' ? 'slate' : 'blue'}>
                    {f.status === 'ACEPTADO' && <CheckCircle2 className="w-3 h-3" />}
                    {f.status === 'ACEPTADO' ? 'Aceptado por el profesor' : f.status === 'RECHAZADO' ? 'Rechazado' : 'En revisión'}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mb-1.5">Cuenta: {f.accountRef}</p>
                <p className="text-xs text-gray-600 italic">"{f.teacherNote}"</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
