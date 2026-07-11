'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { Notification } from '@/types';
import {
  Home, ArrowDownCircle, ArrowUpCircle, Package, Landmark, BookOpen,
  Receipt, LineChart, TrendingUp, Building2, Bell, BarChart2,
  LogOut, Menu, X, ChevronRight, ChevronDown, UserCircle,
  GraduationCap, Calculator,
} from 'lucide-react';

// ── Paleta v2 (plana, "libro mayor") ───────────────────────────
const TEAL = '#3B82F6';                                        // acento (logo, badge)
const ACTIVE = 'linear-gradient(90deg,#1E3A8A,#0F2657)';        // item activo (navy)
const ACTIVE_GLOW = '0 2px 12px rgba(59,130,246,0.35)';
const SIDE_BG = 'linear-gradient(180deg,#03080F 0%,#060F1C 100%)';
const SIDE_LINE = 'rgba(59,130,246,0.12)';
const TXT = 'rgba(255,255,255,0.85)';
const TXT_FAINT = 'rgba(255,255,255,0.55)';

interface Sub {
  label: string;
  tab?: string;        // pestaña del ejercicio (?tab=)
  endsWith?: string;   // subruta del ejercicio (/compras)
  path?: string;       // ruta global directa
  slug?: string;       // página base (/estudiante/modulo/<slug>) usada si no hay ejercicio
  soon?: boolean;
}
interface Group {
  key: string;
  label: string;
  icon: React.ElementType;
  href?: string;       // grupo-enlace directo (sin hijos)
  exact?: boolean;
  path?: string;
  isNotif?: boolean;
  children?: Sub[];
  needsExercise?: boolean;
}

export function StudentSidebar() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const currentTab   = searchParams.get('tab');
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [university, setUniversity] = useState<{ name: string; shortName: string | null; logoUrl: string | null } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user?.universityId) return;
    api.get('/api/v1/universities/mine').then(({ data }) => setUniversity(data)).catch(() => {});
  }, [user?.universityId]);

  useEffect(() => {
    api.get<any[]>('/api/v1/attempts').then(({ data }) => {
      const list = Array.isArray(data) ? data : [];
      const a = list.find((x) => x.status === 'IN_PROGRESS')
        ?? list.find((x) => x.company)
        ?? list.find((x) => x.status === 'NOT_STARTED')
        ?? list[0];
      setActiveId(a?.id ?? null);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchUnread = () => api.get<Notification[]>('/api/v1/notifications')
      .then(({ data }) => setUnread(data.filter((n) => !n.isRead).length)).catch(() => {});
    fetchUnread();
    const id = setInterval(fetchUnread, 15_000);
    return () => clearInterval(id);
  }, [pathname]);

  const base = activeId ? `/estudiante/ejercicio/${activeId}` : null;
  const subHref = (s: Sub): string => {
    // Con ejercicio activo → pestaña/subruta real del ejercicio.
    if (base && s.endsWith) return `${base}${s.endsWith}`;
    if (base && s.tab)      return `${base}?tab=${s.tab}`;
    // Sin ejercicio (o ítem sólo-base) → su página base.
    if (s.path) return s.path;
    if (s.slug) return `/estudiante/modulo/${s.slug}`;
    return '/estudiante';
  };

  const GROUPS: Group[] = [
    { key: 'inicio', label: 'Inicio', icon: Home, href: '/estudiante', exact: true },
    {
      key: 'ingresos', label: 'Ingresos', icon: ArrowDownCircle,
      children: [
        { label: 'Clientes',            tab: 'clients',  slug: 'clientes' },
        { label: 'Facturas de venta',   tab: 'invoices', slug: 'facturas-venta' },
        { label: 'Pagos recibidos',     tab: 'invoices', slug: 'pagos-recibidos' },
        { label: 'Facturas recurrentes', slug: 'facturas-recurrentes' },
        { label: 'Notas de crédito',    slug: 'notas-credito' },
        { label: 'Notas de débito',     slug: 'notas-debito' },
        { label: 'Cotizaciones',        slug: 'cotizaciones' },
        { label: 'Remisiones',          slug: 'remisiones' },
      ],
    },
    {
      key: 'gastos', label: 'Gastos', icon: ArrowUpCircle,
      children: [
        { label: 'Proveedores',         tab: 'suppliers', slug: 'proveedores' },
        { label: 'Propuestas de compra', tab: 'purchase-proposals' },
        { label: 'Facturas de compra',  endsWith: '/compras', slug: 'facturas-compra' },
        { label: 'Órdenes de compra',   slug: 'ordenes-compra' },
        { label: 'Pagos recurrentes',   slug: 'pagos-recurrentes' },
        { label: 'Recepción de comprobantes', slug: 'recepcion-comprobantes' },
      ],
    },
    {
      key: 'inventario', label: 'Inventario', icon: Package,
      children: [
        { label: 'Ítems y productos',   tab: 'products', slug: 'productos' },
        { label: 'Valor de inventario', slug: 'valor-inventario' },
        { label: 'Ajustes de inventario', slug: 'ajustes-inventario' },
        { label: 'Listas de precios',   slug: 'listas-precios' },
        { label: 'Bodegas',             slug: 'bodegas' },
        { label: 'Categorías',          slug: 'categorias' },
        { label: 'Atributos',           slug: 'atributos' },
      ],
    },
    {
      key: 'bancos', label: 'Bancos', icon: Landmark,
      children: [
        { label: 'Bancos y cajas',           tab: 'bank', slug: 'bancos' },
        { label: 'Conciliaciones bancarias', tab: 'bank', slug: 'conciliaciones' },
      ],
    },
    {
      key: 'contabilidad', label: 'Contabilidad', icon: BookOpen,
      children: [
        { label: 'Catálogo de cuentas',     slug: 'catalogo-cuentas' },
        { label: 'Diario (asientos)',       tab: 'journal',        slug: 'asiento-contable' },
        { label: 'Libro mayor',             tab: 'ledger',         slug: 'libro-mayor' },
        { label: 'Mayorización',            tab: 'mayorizacion' },
        { label: 'Balance de comprobación', tab: 'balance-comprobacion', slug: 'balance-comprobacion' },
        { label: 'Ajustes',                 tab: 'ajustes',        slug: 'ajustes' },
        { label: 'Balance ajustado',        tab: 'balance-ajustado' },
        { label: 'Asientos de cierre',      tab: 'asientos-cierre', slug: 'asientos-cierre' },
        { label: 'Balanza post-cierre',     tab: 'balanza-post-cierre' },
        { label: 'Activos fijos',           tab: 'fixed-assets',   slug: 'activos' },
        { label: 'Nómina',                  tab: 'payroll' },
      ],
    },
    { key: 'reportes', label: 'Reportes', icon: BarChart2, children: [
        { label: 'Estados financieros', tab: 'reports', slug: 'estados-financieros' },
    ]},
    { key: 'tribu', label: 'Tributación · TRIBU', icon: Receipt, href: '/estudiante/impuestos', path: '/estudiante/impuestos' },
  ];

  const LEARN: Group[] = [
    { key: 'sim',  label: 'Simulador financiero', icon: LineChart,  href: '/estudiante/simulador', path: '/estudiante/simulador' },
    { key: 'prog', label: 'Mi progreso',          icon: TrendingUp, href: '/estudiante/progreso',  path: '/estudiante/progreso' },
    { key: 'emp',  label: 'Mis empresas',         icon: Building2,  href: '/estudiante/empresas',  path: '/estudiante/empresas' },
    { key: 'notif',label: 'Notificaciones',       icon: Bell,       href: '/estudiante/notificaciones', path: '/estudiante/notificaciones', isNotif: true },
  ];

  const inExercise = pathname.includes('/ejercicio/');
  const isContador = pathname.startsWith('/estudiante/contador');
  const subActive = (s: Sub) => {
    if (s.path && pathname.startsWith(s.path)) return true;
    if (s.slug && pathname.startsWith(`/estudiante/modulo/${s.slug}`)) return true;
    if (base && s.endsWith) return pathname.endsWith(s.endsWith);
    if (base && s.tab) return inExercise && !pathname.endsWith('/compras') && (currentTab ?? 'dashboard') === s.tab;
    return false;
  };
  const groupActive = (g: Group) => {
    if (g.exact) return pathname === '/estudiante';
    if (g.href && g.path) return pathname.startsWith(g.path);
    return !!g.children?.some(subActive);
  };
  const isExpanded = (g: Group) => expanded[g.key] ?? groupActive(g);
  const toggle = (k: string) => setExpanded((e) => ({ ...e, [k]: !(e[k] ?? false) }));

  function renderGroup(g: Group) {
    const Icon = g.icon;
    const muted = g.needsExercise && !activeId;

    // Grupo-enlace directo (sin hijos)
    if (!g.children) {
      const active = groupActive(g);
      return (
        <Link key={g.key} href={g.href!} onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors duration-100"
          style={active ? { background: ACTIVE, color: '#fff', boxShadow: ACTIVE_GLOW } : { color: muted ? TXT_FAINT : TXT }}
          onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#fff'; } }}
          onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = muted ? TXT_FAINT : TXT; } }}>
          <Icon className="flex-shrink-0" style={{ width: 18, height: 18, color: active ? '#fff' : 'rgba(255,255,255,0.7)' }} />
          <span className="flex-1">{g.label}</span>
          {g.isNotif && unread > 0 && (
            <span className="text-[11px] font-mono font-bold rounded px-1.5 py-0.5 min-w-[18px] text-center leading-none"
              style={{ background: active ? 'rgba(255,255,255,0.25)' : TEAL, color: '#fff' }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </Link>
      );
    }

    // Grupo con submenú desplegable
    const exp = isExpanded(g);
    const gActive = groupActive(g);
    return (
      <div key={g.key}>
        <button onClick={() => toggle(g.key)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors duration-100"
          style={{ color: gActive ? '#fff' : (muted ? TXT_FAINT : TXT) }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
          <Icon className="flex-shrink-0" style={{ width: 18, height: 18, color: gActive ? TEAL : 'rgba(255,255,255,0.7)' }} />
          <span className="flex-1 text-left">{g.label}</span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: TXT_FAINT, transform: exp ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
        </button>
        {exp && (
          <div className="mt-0.5 mb-1 ml-4 pl-3 space-y-0.5" style={{ borderLeft: `1px solid ${SIDE_LINE}` }}>
            {g.children.map((s) => {
              const href = subHref(s);
              const active = subActive(s);
              return (
                <Link key={s.label} href={href} onClick={() => setOpen(false)}
                  className="flex items-center px-3 py-1.5 rounded-md text-[13px] transition-colors"
                  style={active ? { background: ACTIVE, color: '#fff', boxShadow: ACTIVE_GLOW } : { color: TXT }}
                  onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#fff'; } }}
                  onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = TXT; } }}>
                  <span className="flex-1">{s.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4" style={{ borderBottom: `1px solid ${SIDE_LINE}` }}>
        <Link href="/estudiante" onClick={() => setOpen(false)} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 font-mono font-extrabold text-white text-base" style={{ background: TEAL }}>C</div>
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-wide leading-none">ContaSJ</h1>
            <p className="text-[10.5px] mt-1 leading-none" style={{ color: TXT_FAINT }}>{isContador ? 'Espacio Contador' : 'Espacio Estudiante'}</p>
          </div>
        </Link>
      </div>

      {/* Switch de espacios: Estudiante (ejercicios/nota) ↔ Contador (práctica libre) */}
      <div className="mx-3 mt-3 p-1 rounded-lg flex gap-1" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${SIDE_LINE}` }}>
        <Link href="/estudiante" onClick={() => setOpen(false)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-semibold transition-all"
          style={!isContador
            ? { background: TEAL, color: '#fff', boxShadow: ACTIVE_GLOW }
            : { color: TXT_FAINT }}>
          <GraduationCap className="w-3.5 h-3.5" /> Estudiante
        </Link>
        <Link href="/estudiante/contador" onClick={() => setOpen(false)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-semibold transition-all"
          style={isContador
            ? { background: '#D4A017', color: '#1a1205', boxShadow: '0 2px 12px rgba(212,160,23,0.35)' }
            : { color: TXT_FAINT }}>
          <Calculator className="w-3.5 h-3.5" /> Contador
        </Link>
      </div>

      {university && !isContador && (
        <div className="mx-3 mt-3 mb-1 px-2.5 py-2 rounded-md flex items-center gap-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${SIDE_LINE}` }}>
          {university.logoUrl ? (
            <img src={university.logoUrl} alt={university.name} className="w-5 h-5 rounded object-contain flex-shrink-0" style={{ opacity: 0.85 }} />
          ) : (
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[11px] font-bold font-mono" style={{ background: 'rgba(37,99,235,0.28)', color: '#93C5FD' }}>
              {(university.shortName ?? university.name).charAt(0)}
            </div>
          )}
          <p className="text-[11px] truncate leading-tight" style={{ color: TXT_FAINT }}>{university.shortName ?? university.name}</p>
        </div>
      )}

      {!activeId && !isContador && (
        <div className="mx-3 mt-2 mb-1 px-2.5 py-2 rounded-md text-[10.5px] leading-snug" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.3)', color: '#7FE3CE' }}>
          Inicia un ejercicio para operar tu empresa.
        </div>
      )}

      {isContador ? (
        <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
          <div className="mx-0.5 mt-1 mb-3 px-2.5 py-2 rounded-md text-[10.5px] leading-snug" style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)', color: '#F5D67B' }}>
            Práctica libre: gestioná tus empresas-cliente sin nota. Ideal para replicar ejercicios del libro.
          </div>
          {[
            { label: 'Mis empresas-cliente', icon: Building2, href: '/estudiante/contador' },
            { label: 'Resumen de práctica',  icon: TrendingUp, href: '/estudiante/contador/resumen' },
          ].map((it) => {
            const active = pathname === it.href;
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-2 mb-0.5 rounded-md text-[14px] font-medium transition-all"
                style={active ? { background: '#D4A017', color: '#1a1205', boxShadow: '0 2px 12px rgba(212,160,23,0.3)' } : { color: TXT }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = ''; }}>
                <Icon className="w-[18px] h-[18px] flex-shrink-0" /> {it.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
          <div className="space-y-0.5 mb-4">{GROUPS.map(renderGroup)}</div>
          <p className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: TXT_FAINT }}>Aprendizaje</p>
          <div className="space-y-0.5">{LEARN.map(renderGroup)}</div>
        </nav>
      )}

      {/* User + Logout */}
      <div className="p-2.5" style={{ borderTop: `1px solid ${SIDE_LINE}` }}>
        <Link href="/estudiante/perfil" onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-2.5 py-2 mb-1 rounded-md transition-colors" style={{ border: `1px solid ${SIDE_LINE}` }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
          <div className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-[12px] font-mono flex-shrink-0" style={{ background: '#1B2E6E' }}>
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : user?.name?.charAt(0)?.toUpperCase() ?? 'E'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10.5px] truncate" style={{ color: TXT_FAINT }}>Mi perfil</p>
          </div>
          <UserCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TXT_FAINT }} />
        </Link>
        <button onClick={logout} className="flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md transition-colors" style={{ color: TXT_FAINT }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#F8B4B4'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = TXT_FAINT; }}>
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 h-full flex-shrink-0" style={{ background: SIDE_BG, borderRight: '1px solid #000' }}>
        {sidebarContent}
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between" style={{ background: SIDE_BG, borderBottom: `1px solid ${SIDE_LINE}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center font-mono font-extrabold text-white text-sm" style={{ background: TEAL }}>C</div>
          <div>
            <h1 className="text-[15px] font-bold text-white leading-none tracking-wide">ContaSJ</h1>
            {university && <p className="text-[10.5px] leading-none mt-1" style={{ color: TXT_FAINT }}>{university.shortName ?? university.name}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && <span className="text-[11px] font-mono font-bold rounded px-1.5 py-0.5" style={{ background: TEAL, color: '#fff' }}>{unread}</span>}
          <button onClick={() => setOpen(!open)} className="p-2 rounded-md transition-colors" style={{ color: TXT }}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-72 h-full overflow-y-auto" style={{ background: SIDE_BG, borderRight: `1px solid ${SIDE_LINE}` }}>
            <div className="pt-16">{sidebarContent}</div>
          </aside>
        </div>
      )}
    </>
  );
}
