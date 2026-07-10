'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown, Home, Users, Truck,
  FileText, Coins, RefreshCw, ShoppingCart, ClipboardList, Inbox,
  Package, BarChart2, Scale, Tag, Warehouse, FolderTree, Layers,
  Landmark, BookOpen, Building2, Receipt, LineChart, TrendingUp,
  Bell, UserCircle, Sparkles,
} from 'lucide-react';

interface Cmd {
  label: string;
  group: string;
  href: string;
  keywords?: string;
  icon: React.ElementType;
}

const M = (s: string) => `/estudiante/modulo/${s}`;

const COMMANDS: Cmd[] = [
  { group: 'Principal', label: 'Inicio · Resumen del negocio', href: '/estudiante', icon: Home, keywords: 'dashboard resumen inicio home panel' },

  { group: 'Ingresos', label: 'Clientes',            href: M('clientes'),             icon: Users,        keywords: 'contactos clientes cxc cobrar' },
  { group: 'Ingresos', label: 'Facturas de venta',   href: M('facturas-venta'),       icon: FileText,     keywords: 'factura venta ingreso emitir facturar' },
  { group: 'Ingresos', label: 'Pagos recibidos',     href: M('pagos-recibidos'),      icon: Coins,        keywords: 'pago cobro abono recibido' },
  { group: 'Ingresos', label: 'Facturas recurrentes', href: M('facturas-recurrentes'), icon: RefreshCw,   keywords: 'recurrente suscripcion' },
  { group: 'Ingresos', label: 'Notas de crédito',    href: M('notas-credito'),        icon: FileText,     keywords: 'nota credito devolucion anulacion nc' },
  { group: 'Ingresos', label: 'Notas de débito',     href: M('notas-debito'),         icon: FileText,     keywords: 'nota debito nd' },
  { group: 'Ingresos', label: 'Cotizaciones',        href: M('cotizaciones'),         icon: FileText,     keywords: 'cotizacion presupuesto proforma' },
  { group: 'Ingresos', label: 'Remisiones',          href: M('remisiones'),           icon: Truck,        keywords: 'remision entrega mercaderia' },

  { group: 'Gastos', label: 'Proveedores',           href: M('proveedores'),          icon: Truck,        keywords: 'proveedor cxp pagar' },
  { group: 'Gastos', label: 'Facturas de compra',    href: M('facturas-compra'),      icon: ShoppingCart, keywords: 'compra gasto proveedor credito fiscal' },
  { group: 'Gastos', label: 'Órdenes de compra',     href: M('ordenes-compra'),       icon: ClipboardList,keywords: 'orden compra pedido' },
  { group: 'Gastos', label: 'Pagos recurrentes',     href: M('pagos-recurrentes'),    icon: RefreshCw,    keywords: 'pago recurrente alquiler servicio' },
  { group: 'Gastos', label: 'Recepción de comprobantes', href: M('recepcion-comprobantes'), icon: Inbox,  keywords: 'recepcion comprobante hacienda aceptar' },

  { group: 'Inventario', label: 'Ítems y productos', href: M('productos'),            icon: Package,      keywords: 'producto item servicio catalogo' },
  { group: 'Inventario', label: 'Valor de inventario', href: M('valor-inventario'),   icon: BarChart2,    keywords: 'valor inventario fifo costo' },
  { group: 'Inventario', label: 'Ajustes de inventario', href: M('ajustes-inventario'), icon: Scale,      keywords: 'ajuste inventario merma conteo' },
  { group: 'Inventario', label: 'Listas de precios', href: M('listas-precios'),       icon: Tag,          keywords: 'precio lista mayorista' },
  { group: 'Inventario', label: 'Bodegas',           href: M('bodegas'),              icon: Warehouse,    keywords: 'bodega almacen ubicacion' },
  { group: 'Inventario', label: 'Categorías',        href: M('categorias'),           icon: FolderTree,   keywords: 'categoria grupo' },
  { group: 'Inventario', label: 'Atributos',         href: M('atributos'),            icon: Layers,       keywords: 'atributo variante talla color' },

  { group: 'Bancos', label: 'Bancos y cajas',        href: M('bancos'),               icon: Landmark,     keywords: 'banco caja efectivo cuenta' },
  { group: 'Bancos', label: 'Conciliaciones',        href: M('conciliaciones'),       icon: Scale,        keywords: 'conciliacion bancaria extracto' },

  { group: 'Contabilidad', label: 'Catálogo de cuentas', href: M('catalogo-cuentas'), icon: BookOpen,     keywords: 'catalogo cuentas plan niif' },
  { group: 'Contabilidad', label: 'Asiento contable', href: M('asiento-contable'),    icon: BookOpen,     keywords: 'asiento diario debito credito partida doble' },
  { group: 'Contabilidad', label: 'Libro diario',    href: M('libro-diario'),         icon: BookOpen,     keywords: 'libro diario cronologico' },
  { group: 'Contabilidad', label: 'Libro mayor',     href: M('libro-mayor'),          icon: BookOpen,     keywords: 'libro mayor mayorizacion saldo cuenta t' },
  { group: 'Contabilidad', label: 'Ajustes',         href: M('ajustes'),              icon: RefreshCw,    keywords: 'ajuste devengado depreciacion incobrable' },
  { group: 'Contabilidad', label: 'Asientos de cierre', href: M('asientos-cierre'),   icon: Scale,        keywords: 'cierre resultado' },
  { group: 'Contabilidad', label: 'Activos fijos',   href: M('activos'),              icon: Building2,    keywords: 'activo fijo depreciacion mobiliario equipo' },

  { group: 'Reportes', label: 'Balance de comprobación', href: M('balance-comprobacion'), icon: ClipboardList, keywords: 'balance comprobacion sumas saldos' },
  { group: 'Reportes', label: 'Estados financieros', href: M('estados-financieros'),  icon: BarChart2,    keywords: 'estado financiero balance general resultados' },

  { group: 'Tributación', label: 'Tributación · TRIBU', href: '/estudiante/impuestos', icon: Receipt,     keywords: 'impuesto tributacion hacienda d104 d101 iva renta' },

  { group: 'Aprendizaje', label: 'Simulador financiero', href: '/estudiante/simulador', icon: LineChart,  keywords: 'simulador accion bolsa valoracion macro' },
  { group: 'Aprendizaje', label: 'Mi progreso',      href: '/estudiante/progreso',    icon: TrendingUp,   keywords: 'progreso xp nivel ranking gamificacion' },
  { group: 'Aprendizaje', label: 'Mis empresas',     href: '/estudiante/empresas',    icon: Building2,    keywords: 'empresa compania' },

  { group: 'Cuenta', label: 'Mi perfil',             href: '/estudiante/perfil',      icon: UserCircle,   keywords: 'perfil cuenta ajustes' },
  { group: 'Cuenta', label: 'Notificaciones',        href: '/estudiante/notificaciones', icon: Bell,      keywords: 'notificacion aviso alerta' },
];

const DIACRITICS = /[̀-ͯ]/g;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(DIACRITICS, '');

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setQ(''); setSel(0); }, []);

  // Abrir con ⌘K / Ctrl+K o evento global (buscador de la topbar)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('contasj:cmdk', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('contasj:cmdk', onOpen); };
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20); }, [open]);

  const results = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return COMMANDS;
    return COMMANDS.filter((c) => norm(`${c.label} ${c.group} ${c.keywords ?? ''}`).includes(nq));
  }, [q]);

  useEffect(() => { setSel(0); }, [q]);

  const go = useCallback((c?: Cmd) => {
    const target = c ?? results[sel];
    if (!target) return;
    close();
    router.push(target.href);
  }, [results, sel, router, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); go(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, sel, go]);

  // mantener el seleccionado visible
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel, open]);

  if (!open) return null;

  // Agrupar resultados preservando orden
  const groups: { group: string; items: { c: Cmd; idx: number }[] }[] = [];
  results.forEach((c, idx) => {
    let g = groups.find((x) => x.group === c.group);
    if (!g) { g = { group: c.group, items: [] }; groups.push(g); }
    g.items.push({ c, idx });
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_.12s_ease]" onClick={close} />
      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden border shadow-2xl animate-[cmdIn_.14s_cubic-bezier(.2,.8,.2,1)]"
        style={{ background: '#03080F', borderColor: 'rgba(96,165,250,0.28)', boxShadow: '0 24px 80px rgba(0,0,0,0.55)' }}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Search className="w-5 h-5 flex-shrink-0" style={{ color: '#60A5FA' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar sección, acción o concepto contable…"
            className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-white/35"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <p className="text-sm text-white/45">Sin resultados para “{q}”.</p>
            </div>
          ) : groups.map((g) => (
            <div key={g.group} className="mb-1">
              <p className="px-4 pt-2 pb-1 text-[10px] font-mono font-bold uppercase tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.35)' }}>{g.group}</p>
              {g.items.map(({ c, idx }) => {
                const Icon = c.icon;
                const active = idx === sel;
                return (
                  <button
                    key={c.href}
                    data-idx={idx}
                    onMouseMove={() => setSel(idx)}
                    onClick={() => go(c)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                    style={{ background: active ? '#2563EB' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.8)' }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                    <span className="flex-1 text-[13.5px]">{c.label}</span>
                    {active && <CornerDownLeft className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.85)' }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 h-9 border-t text-[11px]" style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
          <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> navegar</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> abrir</span>
          <span className="ml-auto flex items-center gap-1 font-mono"><Sparkles className="w-3 h-3" style={{ color: '#60A5FA' }} /> ContaSJ ⌘K</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cmdIn { from { opacity: 0; transform: translateY(-8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}

export default CommandPalette;
