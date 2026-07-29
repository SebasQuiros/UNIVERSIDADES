'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Store, Handshake, Building2, X, Package } from 'lucide-react';
import { ARCHETYPE_LABELS } from '@/lib/classSession';
import { NewNegotiationModal } from './NegotiationsPanel';

interface MarketRow {
  companyId: string; name: string; archetype: string;
  score: number; onlineCount?: number; memberCount?: number;
  activity?: { entries: number; invoices: number };
}

interface Dimension {
  valor: number | null; etiqueta: string;
  despachadas?: number; pedidas?: number;
  pagadas?: number; facturadas?: number;
  aceptadas?: number; cerradas?: number;
}
interface CompanyProfile {
  companyId: string; name: string; economicActivity: string | null; archetype: string;
  reputacion: number | null;
  dimensiones: { entrega: Dimension; pago: Dimension; seriedad: Dimension };
  catalogo: Array<{ id: string; name: string; price: string; unit: string | null }>;
}

/**
 * Mercado empresarial (spec Multiempresa cap. 5): directorio de las empresas
 * de la sesión. Desde acá el estudiante puede iniciar una negociación con
 * cualquier otra empresa. Read-only (reusa el endpoint /ranking).
 */
export function MarketDirectory({ sessionId, myCompanyId }: { sessionId: string; myCompanyId?: string }) {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [negotiateWith, setNegotiateWith] = useState<string | null>(null);
  const [profileOf, setProfileOf] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.get<{ ranking: MarketRow[] }>(`/api/v1/class-sessions/${sessionId}/ranking`)
      .then(({ data }) => { if (alive) setRows(data.ranking ?? []); }).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [sessionId]);

  const others = rows.filter((r) => r.companyId !== myCompanyId);
  const companiesForModal = others.map((r) => ({ companyId: r.companyId, name: r.name }));

  return (
    <SectionCard icon={Store} iconTint="#2563EB" eyebrow="Mercado" title="Empresas del mercado"
      description="Explorá las demás empresas de la sesión y empezá a negociar con ellas."
      className="lp-in">
      {others.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">Todavía no hay otras empresas activas.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {others.map((r) => (
            <div key={r.companyId} className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{r.name}</p>
                  <p className="truncate text-xs text-gray-500">{(ARCHETYPE_LABELS as any)[r.archetype] ?? r.archetype}</p>
                </div>
                {(r.onlineCount ?? 0) > 0 && (
                  <span className="flex flex-shrink-0 items-center gap-1 text-[10px] font-medium text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {r.onlineCount}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Badge variant="gold">{r.score} pts</Badge>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setProfileOf(r.companyId)}>
                    Ver perfil
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setNegotiateWith(r.companyId)}>
                    <Handshake className="h-4 w-4" /> Negociar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {negotiateWith && myCompanyId && (
        <NewNegotiationModal
          sessionId={sessionId}
          buyerCompanyId={myCompanyId}
          companies={companiesForModal}
          preselectSellerId={negotiateWith}
          onClose={() => setNegotiateWith(null)}
          onCreated={() => setNegotiateWith(null)}
        />
      )}

      {profileOf && (
        <CompanyProfileModal
          sessionId={sessionId} companyId={profileOf}
          onClose={() => setProfileOf(null)}
          onNegotiate={() => { setNegotiateWith(profileOf); setProfileOf(null); }}
          canNegotiate={Boolean(myCompanyId)}
        />
      )}
    </SectionCard>
  );
}

/** Color del semáforo de reputación. Debajo de 60 hay un problema real. */
function repTone(v: number) {
  if (v >= 80) return { text: 'text-emerald-700', bg: 'bg-emerald-500', label: 'Confiable' };
  if (v >= 60) return { text: 'text-amber-700',   bg: 'bg-amber-500',   label: 'Irregular' };
  return          { text: 'text-red-700',     bg: 'bg-red-500',     label: 'Poco confiable' };
}

/**
 * Perfil público: con quién estás por hacer negocios. La reputación sale de
 * conducta verificable dentro de la sesión (entregar, pagar, cerrar tratos),
 * no de un puntaje arbitrario.
 */
function CompanyProfileModal({ sessionId, companyId, onClose, onNegotiate, canNegotiate }: {
  sessionId: string; companyId: string; onClose: () => void;
  onNegotiate: () => void; canNegotiate: boolean;
}) {
  const [p, setP] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<CompanyProfile>(`/api/v1/class-sessions/${sessionId}/companies/${companyId}/profile`)
      .then(({ data }) => { if (alive) setP(data); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [sessionId, companyId]);

  const dims = p ? [p.dimensiones.entrega, p.dimensiones.pago, p.dimensiones.seriedad] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-bold text-gray-900">{p?.name ?? 'Cargando…'}</h3>
            {p && (
              <p className="truncate text-xs text-gray-500">
                {(ARCHETYPE_LABELS as any)[p.archetype] ?? p.archetype}
                {p.economicActivity ? ` · ${p.economicActivity}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {error && <p className="py-6 text-center text-sm text-gray-400">No se pudo cargar el perfil.</p>}
        {!error && !p && <p className="py-6 text-center text-sm text-gray-400">Cargando…</p>}

        {p && (
          <>
            {/* Reputación general */}
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 text-center">
              {p.reputacion === null ? (
                <>
                  <p className="text-sm font-semibold text-gray-600">Todavía sin historial</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Esta empresa aún no ha cerrado negocios en la sesión. No tener historial
                    no es lo mismo que tener mal historial.
                  </p>
                </>
              ) : (
                <>
                  <p className={`text-3xl font-bold tabular-nums ${repTone(p.reputacion).text}`}>
                    {p.reputacion}<span className="text-lg">/100</span>
                  </p>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Reputación · {repTone(p.reputacion).label}
                  </p>
                </>
              )}
            </div>

            {/* De dónde sale ese número */}
            <div className="mb-4 space-y-2.5">
              {dims.map((d) => (
                <div key={d.etiqueta}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-gray-700">{d.etiqueta}</span>
                    <span className="text-xs tabular-nums text-gray-500">
                      {d.valor === null ? 'sin datos' : (
                        <>
                          {d.valor}%
                          <span className="ml-1 text-gray-400">
                            ({d.despachadas ?? d.pagadas ?? d.aceptadas} de {d.pedidas ?? d.facturadas ?? d.cerradas})
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    {d.valor !== null && (
                      <div className={`h-full rounded-full ${repTone(d.valor).bg}`} style={{ width: `${d.valor}%` }} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Qué vende */}
            <div className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Package className="h-3.5 w-3.5" /> Qué vende
              </p>
              {p.catalogo.length === 0 ? (
                <p className="text-xs text-gray-400">Todavía no publicó productos.</p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {p.catalogo.map((prod) => (
                    <li key={prod.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate text-sm text-gray-700">{prod.name}</span>
                      <span className="flex-shrink-0 font-mono text-sm tabular-nums text-gray-900">
                        ₡{Number(prod.price).toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                        {prod.unit ? <span className="text-xs text-gray-400"> /{prod.unit}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
              {canNegotiate && (
                <Button size="sm" onClick={onNegotiate}><Handshake className="h-4 w-4" /> Negociar</Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
