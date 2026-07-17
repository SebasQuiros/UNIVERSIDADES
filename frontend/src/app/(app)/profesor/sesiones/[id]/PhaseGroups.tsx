'use client';

/**
 * Fase GROUPS — armar los grupos y asignar un arquetipo de negocio a cada uno.
 *
 * Muestra la cadena de suministro que resulta de los arquetipos asignados
 * (quién le compra a quién) y permite un reparto automático (Fase 1: mezcla
 * cosmética local, sin persistencia).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SectionCard } from '@/components/ui/SectionCard';
import {
  MOCK_COMPANIES, ARCHETYPE_LABELS, deriveSupplyChain, companyName,
  type SessionCompany, type BusinessArchetype,
} from './_mock';
import { ARCHETYPE_ICON, ARCHETYPE_TINT } from './archetypeStyle';
import {
  Shuffle, ArrowRight, Users, Crown,
  GitBranch, ArrowRightLeft,
} from 'lucide-react';

const ARCHETYPE_KEYS: BusinessArchetype[] = ['FERRETERIA', 'DISTRIBUIDORA_MAYORISTA', 'AGENCIA_PUBLICIDAD', 'BUFETE_CONTABLE'];

function shuffleCompanies(base: SessionCompany[]): SessionCompany[] {
  const pool = base.flatMap((c) => c.members.map((m) => ({ studentId: m.studentId, name: m.name })));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return base.map((c, idx) => {
    const chunk = pool.slice(idx * 5, idx * 5 + 5);
    return {
      ...c,
      archetype: ARCHETYPE_KEYS[Math.floor(Math.random() * ARCHETYPE_KEYS.length)],
      members: chunk.map((m, i) => ({ ...m, isLeader: i === 0 })),
    };
  });
}

export function PhaseGroups({ onAdvance }: { onAdvance: () => void }) {
  const [companies, setCompanies] = useState<SessionCompany[]>(MOCK_COMPANIES);
  const chain = deriveSupplyChain(companies);

  function setArchetype(companyId: string, archetype: BusinessArchetype) {
    setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, archetype } : c)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <IconTile icon={Users} tint="#2563EB" size={40} />
          <div>
            <h3 className="text-sm font-bold text-gray-900">Empresas de la sesión</h3>
            <p className="text-xs text-gray-500">{companies.length} empresas · 5 estudiantes por empresa · elegí el arquetipo de cada una</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setCompanies(shuffleCompanies(companies))} className="cx-press">
          <Shuffle className="w-4 h-4" /> Reparto automático
        </Button>
      </div>

      {/* Empresas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {companies.map((c, i) => {
          const Icon = ARCHETYPE_ICON[c.archetype];
          const tint = ARCHETYPE_TINT[c.archetype];
          return (
            <div key={c.id} className={`overflow-hidden rounded-card border border-gray-200/70 bg-white shadow-card transition-all cx-lift cx-pop cx-d${Math.min(i + 1, 6)}`}>
              <div className="flex items-start gap-3 border-b border-gray-100 bg-gray-50/70 p-4">
                <IconTile icon={Icon} tint={tint} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.legalId}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Arquetipo de negocio</label>
                  <select
                    value={c.archetype}
                    onChange={(e) => setArchetype(c.id, e.target.value as BusinessArchetype)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                  >
                    {ARCHETYPE_KEYS.map((k) => (
                      <option key={k} value={k}>{ARCHETYPE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-gray-500">Integrantes</p>
                  <ul className="space-y-1">
                    {c.members.map((m) => (
                      <li key={m.studentId} className="flex items-center gap-1.5 text-xs text-gray-700">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[10px] font-bold text-blue-700">
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{m.name}</span>
                        {m.isLeader && <Crown className="h-3 w-3 flex-shrink-0 text-gold-600" aria-label="Representante del grupo" />}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cadena de suministro resultante */}
      <SectionCard
        icon={GitBranch}
        iconTint="#1B2E6E"
        eyebrow="Se recalcula con cada arquetipo"
        title="Cadena de suministro resultante"
        description="Quién le compra a quién, según los arquetipos asignados arriba."
      >
        <div className="space-y-2.5">
          {companies.map((seller) => {
            const outgoing = chain.filter((e) => e.fromId === seller.id);
            return (
              <div key={seller.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <span className="flex-shrink-0 text-sm font-semibold text-gray-800">{seller.name}</span>
                {outgoing.length === 0 ? (
                  <span className="text-xs italic text-gray-400">No les vende directamente a otras empresas de la sesión (vende al consumidor final).</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {outgoing.map((e) => (
                      <span key={`${e.fromId}-${e.toId}`} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        <ArrowRight className="h-3 w-3" /> {companyName(e.toId)}
                        <span className="text-blue-400">· {e.product}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={ArrowRightLeft} tint="#059669" size={40} />
          <p className="text-sm text-gray-600">Cuando los grupos estén listos, arrancá el periodo para que empiecen a comprar y venderse entre sí.</p>
        </div>
        <Button onClick={onAdvance} className="w-full cx-press sm:w-auto">
          Iniciar periodo <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
