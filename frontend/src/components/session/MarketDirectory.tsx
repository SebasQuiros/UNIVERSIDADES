'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Store, Handshake, Building2 } from 'lucide-react';
import { ARCHETYPE_LABELS } from '@/lib/classSession';
import { NewNegotiationModal } from './NegotiationsPanel';

interface MarketRow {
  companyId: string; name: string; archetype: string;
  score: number; onlineCount?: number; memberCount?: number;
  activity?: { entries: number; invoices: number };
}

/**
 * Mercado empresarial (spec Multiempresa cap. 5): directorio de las empresas
 * de la sesión. Desde acá el estudiante puede iniciar una negociación con
 * cualquier otra empresa. Read-only (reusa el endpoint /ranking).
 */
export function MarketDirectory({ sessionId, myCompanyId }: { sessionId: string; myCompanyId?: string }) {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [negotiateWith, setNegotiateWith] = useState<string | null>(null);

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
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="gold">{r.score} pts</Badge>
                <Button size="sm" variant="secondary" onClick={() => setNegotiateWith(r.companyId)}>
                  <Handshake className="h-4 w-4" /> Negociar
                </Button>
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
    </SectionCard>
  );
}
