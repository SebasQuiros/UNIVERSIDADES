'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import {
  Home, Coins, Wallet, Package, Landmark, BookOpen, BookOpenCheck,
  Receipt, LineChart, TrendingUp, Building2, Bell, BarChart2,
  LogOut, Menu, X, ChevronDown, UserCircle,
  GraduationCap, Calculator, Users, Ticket,
  LayoutDashboard, FileText, ClipboardCheck, Presentation,
} from 'lucide-react';

// ── Paleta de marca (azul noche + acento dorado) ───────────────
const ACCENT = '#3B82F6';                                       // azul de marca (badges)
const ACTIVE = 'linear-gradient(90deg,#1E3A8A,#0F2657)';        // item activo (azul noche)
const ACTIVE_GLOW = '0 4px 16px rgba(37,99,235,0.30), inset 0 0 0 1px rgba(251,191,36,0.12)';
const GOLD_BAR = 'linear-gradient(180deg,#FDE68A,#D4A017)';     // barra/acento dorado del activo
const GOLD_EYEBROW = 'rgba(251,191,36,0.7)';                    // eyebrow dorado de sección
const SIDE_BG = 'linear-gradient(180deg,#03080F 0%,#060F1C 100%)';
const SIDE_LINE = 'rgba(59,130,246,0.14)';
const TXT = 'rgba(255,255,255,0.85)';
const TXT_FAINT = 'rgba(255,255,255,0.55)';

interface Sub {
  label: string;
  tab?: string;        // pestaña del ejercicio (?tab=)
  sub?: string;        // desambigua ítems que comparten la misma pestaña (&sub=)
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
  badge?: number;      // contador (ej. pendientes de calificar del profe)
  children?: Sub[];
  needsExercise?: boolean;
}

export function StudentSidebar() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const currentTab   = searchParams.get('tab');
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const unread = useUnreadNotifications();
  const [pending, setPending] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Un solo fetch inicial: resuelve activeId y (si es profesor) pending desde
  // la MISMA respuesta — antes eran 2 GET /attempts idénticos disparados a la
  // vez en cada montaje (login, cambio de usuario), duplicando la consulta
  // justo cuando el cache de sesión del backend está frío.
  const didMount = useRef(false);
  useEffect(() => {
    api.get<any[]>('/api/v1/attempts').then(({ data }) => {
      const list = Array.isArray(data) ? data : [];
      const a = list.find((x) => x.status === 'IN_PROGRESS')
        ?? list.find((x) => x.company)
        ?? list.find((x) => x.status === 'NOT_STARTED')
        ?? list[0];
      setActiveId(a?.id ?? null);
      if (user?.role === 'TEACHER') {
        setPending(list.filter((x) => x.status === 'IN_PROGRESS' || x.status === 'SUBMITTED').length);
      }
    }).catch(() => {});
    didMount.current = true;
  }, []);

  // Solo el profesor: mantener "pending" al día al navegar (después del montaje
  // inicial, que ya lo resolvió arriba con el mismo fetch).
  useEffect(() => {
    if (!didMount.current || user?.role !== 'TEACHER') return;
    api.get<any[]>('/api/v1/attempts')
      .then(({ data }) => setPending((Array.isArray(data) ? data : [])
        .filter((a) => a.status === 'IN_PROGRESS' || a.status === 'SUBMITTED').length))
      .catch(() => {});
  }, [pathname, user?.role]);

  // Espacio Contador: empresa-cliente de práctica abierta (si estamos en su workspace).
  const contadorCompanyId = (() => {
    const m = pathname.match(/^\/estudiante\/contador\/([0-9a-fA-F-]{36})/);
    return m ? m[1] : null;
  })();

  const base = activeId ? `/estudiante/ejercicio/${activeId}` : null;
  const subHref = (s: Sub): string => {
    // Espacio Contador → navega los libros de la empresa-cliente ABIERTA (por tab).
    if (isContador) {
      if (s.tab) return contadorCompanyId ? `/estudiante/contador/${contadorCompanyId}?tab=${s.tab}` : '/estudiante/contador';
      if (s.path) return s.path;
      return '/estudiante/contador';
    }
    // Con ejercicio activo → pestaña/subruta real del ejercicio.
    if (base && s.endsWith) return `${base}${s.endsWith}`;
    if (base && s.tab)      return `${base}?tab=${s.tab}${s.sub ? `&sub=${s.sub}` : ''}`;
    // Sin ejercicio (o ítem sólo-base) → su página base.
    if (s.path) return s.path;
    if (s.slug) return `/estudiante/modulo/${s.slug}`;
    return '/estudiante';
  };

  const GROUPS: Group[] = [
    { key: 'inicio', label: 'Inicio', icon: Home, href: '/estudiante', exact: true },
    {
      key: 'ingresos', label: 'Ciclo de ingresos', icon: Coins,
      children: [
        { label: 'Clientes',            tab: 'clients',  slug: 'clientes' },
        { label: 'Facturas emitidas',   tab: 'invoices', slug: 'facturas-venta' },
        { label: 'Cobros',              endsWith: '/cxc', slug: 'pagos-recibidos' },
        { label: 'Notas de crédito',    slug: 'notas-credito' },
        { label: 'Notas de débito',     slug: 'notas-debito' },
        { label: 'Presupuestos',        tab: 'quotes', slug: 'cotizaciones' },
      ],
    },
    {
      key: 'gastos', label: 'Ciclo de egresos', icon: Wallet,
      children: [
        { label: 'Proveedores',         tab: 'suppliers', slug: 'proveedores' },
        { label: 'Solicitudes de compra', tab: 'purchase-proposals' },
        { label: 'Requerimientos',      tab: 'procurement' },
        { label: 'Facturas recibidas',  endsWith: '/compras', slug: 'facturas-compra' },
        { label: 'Órdenes de compra',   tab: 'purchase-orders', slug: 'ordenes-compra' },
        { label: 'Recepción de bienes', tab: 'purchase-orders', slug: 'recepcion-comprobantes', sub: 'recepcion' },
      ],
    },
    {
      key: 'inventario', label: 'Inventario', icon: Package,
      children: [
        { label: 'Catálogo de productos', tab: 'products', slug: 'productos' },
        { label: 'Valorización',         slug: 'valor-inventario' },
        { label: 'Ajustes',              tab: 'inventory-adjustments', slug: 'ajustes-inventario' },
        { label: 'Categorías',           slug: 'categorias' },
      ],
    },
    {
      key: 'bancos', label: 'Tesorería', icon: Landmark,
      children: [
        { label: 'Bancos y cajas',           tab: 'bank', slug: 'bancos' },
        { label: 'Conciliaciones bancarias', tab: 'bank', slug: 'conciliaciones', sub: 'conciliaciones' },
      ],
    },
    {
      key: 'contabilidad', label: 'Registro contable', icon: BookOpenCheck,
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
        { label: 'Tutor IA',                tab: 'tutor' },
      ],
    },
    { key: 'reportes', label: 'Estados y análisis', icon: BarChart2, children: [
        { label: 'Estados financieros', tab: 'reports', slug: 'estados-financieros' },
    ]},
    { key: 'tribu', label: 'Tributación · TRIBU', icon: Receipt, href: '/estudiante/impuestos', path: '/estudiante/impuestos' },
    // Andamiaje fase 1 (maqueta): unirse a una "Sesión de Aula" con código de
    // profesor (lobby → mi empresa → auditoría entre pares → resultados).
    { key: 'sesion', label: 'Sesión de aula', icon: Ticket, href: '/estudiante/sesion/unirse', path: '/estudiante/sesion' },
  ];

  const LEARN: Group[] = [
    { key: 'sim',  label: 'Simulador financiero', icon: LineChart,  href: '/estudiante/simulador', path: '/estudiante/simulador' },
    { key: 'emp',  label: 'Mis empresas',         icon: Building2,  href: '/estudiante/empresas',  path: '/estudiante/empresas' },
    { key: 'prog', label: 'Mi progreso',          icon: TrendingUp, href: '/estudiante/progreso',  path: '/estudiante/progreso' },
    { key: 'notif',label: 'Notificaciones',       icon: Bell,       href: '/estudiante/notificaciones', path: '/estudiante/notificaciones', isNotif: true },
  ];

  // ── Espacio Contador: menú "de contador real", contabilidad separada por
  //    empresa. Los ítems del ciclo contable navegan la empresa-cliente ABIERTA
  //    (deep-link ?tab=). Sin sección Aprendizaje. (Multiempresa es su propio espacio.)
  const CONTADOR_TOP: Group[] = [
    { key: 'c-emp', label: 'Mis empresas-cliente', icon: Building2, href: '/estudiante/contador', path: '/estudiante/contador', exact: true },
    { key: 'c-res', label: 'Resumen de práctica', icon: TrendingUp, href: '/estudiante/contador/resumen', path: '/estudiante/contador/resumen' },
  ];
  // ── Espacio Multiempresa: grupos de práctica + comercio entre empresas.
  const MULTIEMPRESA_TOP: Group[] = [
    { key: 'm-grp', label: 'Grupos de práctica', icon: Users, href: '/estudiante/multiempresa', path: '/estudiante/multiempresa', exact: true },
  ];
  // ── Espacio Docencia (solo profesor): sus herramientas de docencia. El profe
  //    tiene TODO lo del estudiante (los otros 3 espacios) MÁS estos accesos,
  //    para ver el sistema tal como lo usa un estudiante.
  const DOCENCIA_TOP: Group[] = [
    { key: 'd-dash', label: 'Panel docente',           icon: LayoutDashboard, href: '/profesor',            path: '/profesor', exact: true },
    { key: 'd-cur',  label: 'Mis cursos',              icon: BookOpen,        href: '/profesor/cursos',     path: '/profesor/cursos' },
    { key: 'd-ejer', label: 'Mis ejercicios',          icon: FileText,        href: '/profesor/ejercicios', path: '/profesor/ejercicios' },
    { key: 'd-ses',  label: 'Sesiones de aula',        icon: Presentation,    href: '/profesor/sesiones',   path: '/profesor/sesiones' },
    { key: 'd-pen',  label: 'Pendientes de calificar', icon: ClipboardCheck,  href: '/profesor/pendientes', path: '/profesor/pendientes', badge: pending },
  ];
  const CONTADOR_GROUPS: Group[] = [
    { key: 'c-ing', label: 'Ciclo de ingresos', icon: Coins, children: [
      { label: 'Clientes',          tab: 'clients' },
      { label: 'Facturas emitidas', tab: 'invoices' },
    ]},
    { key: 'c-gas', label: 'Ciclo de egresos', icon: Wallet, children: [
      { label: 'Proveedores', tab: 'suppliers' },
    ]},
    { key: 'c-inv', label: 'Inventario', icon: Package, children: [
      { label: 'Catálogo de productos', tab: 'products' },
    ]},
    { key: 'c-ban', label: 'Tesorería', icon: Landmark, children: [
      { label: 'Bancos y cajas', tab: 'bank' },
    ]},
    { key: 'c-con', label: 'Registro contable', icon: BookOpenCheck, children: [
      { label: 'Diario (asientos)',       tab: 'journal' },
      { label: 'Libro mayor',             tab: 'ledger' },
      { label: 'Mayorización',            tab: 'mayorizacion' },
      { label: 'Balance de comprobación', tab: 'balance-comprobacion' },
      { label: 'Ajustes',                 tab: 'ajustes' },
      { label: 'Balance ajustado',        tab: 'balance-ajustado' },
      { label: 'Asientos de cierre',      tab: 'asientos-cierre' },
      { label: 'Balanza post-cierre',     tab: 'balanza-post-cierre' },
      { label: 'Activos fijos',           tab: 'fixed-assets' },
      { label: 'Nómina',                  tab: 'payroll' },
    ]},
    { key: 'c-rep', label: 'Estados y análisis', icon: BarChart2, children: [
      { label: 'Estados financieros', tab: 'reports' },
    ]},
  ];

  const inExercise = pathname.includes('/ejercicio/');
  const isMultiempresa = pathname.startsWith('/estudiante/multiempresa');
  const isContador = pathname.startsWith('/estudiante/contador');
  const isDocencia = pathname.startsWith('/profesor');
  const isTeacher = user?.role === 'TEACHER';
  const subActive = (s: Sub) => {
    if (isContador) {
      if (s.path && pathname.startsWith(s.path)) return true;
      if (s.tab) return !!contadorCompanyId && (currentTab ?? 'dashboard') === s.tab;
      return false;
    }
    if (s.path && pathname.startsWith(s.path)) return true;
    if (s.slug && pathname.startsWith(`/estudiante/modulo/${s.slug}`)) return true;
    if (base && s.endsWith) return pathname.endsWith(s.endsWith);
    if (base && s.tab) {
      const tabMatch = inExercise && !pathname.endsWith('/compras') && (currentTab ?? 'dashboard') === s.tab;
      if (!tabMatch) return false;
      // Varios ítems comparten pestaña (ej. Facturas/Pagos → invoices): desambiguar por &sub=.
      const currentSub = searchParams.get('sub');
      return s.sub ? currentSub === s.sub : !currentSub;
    }
    return false;
  };
  const groupActive = (g: Group) => {
    if (g.exact) return pathname === (g.path ?? g.href);
    if (g.href && g.path) return pathname.startsWith(g.path);
    return !!g.children?.some(subActive);
  };
  const isExpanded = (g: Group) => expanded[g.key] ?? groupActive(g);
  const toggle = (k: string) => setExpanded((e) => ({ ...e, [k]: !(e[k] ?? false) }));

  function renderGroup(g: Group, i: number) {
    const Icon = g.icon;
    const muted = g.needsExercise && !activeId;
    const delay = `${Math.min(i, 9) * 0.045}s`;   // entrada escalonada (lp-in)

    // Grupo-enlace directo (sin hijos)
    if (!g.children) {
      const active = groupActive(g);
      return (
        <Link key={g.key} href={g.href!} onClick={() => setOpen(false)}
          className="lp-in relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors duration-100"
          style={active
            ? { background: ACTIVE, color: '#fff', boxShadow: ACTIVE_GLOW, animationDelay: delay }
            : { color: muted ? TXT_FAINT : TXT, animationDelay: delay }}
          onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#fff'; } }}
          onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = muted ? TXT_FAINT : TXT; } }}>
          {active && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full" style={{ background: GOLD_BAR, boxShadow: '0 0 8px rgba(251,191,36,0.5)' }} />}
          <Icon className="flex-shrink-0" style={{ width: 18, height: 18, color: active ? '#fff' : 'rgba(96,165,250,0.75)' }} />
          <span className="flex-1">{g.label}</span>
          {g.isNotif && unread > 0 && (
            <span className="text-[11px] font-mono font-bold rounded px-1.5 py-0.5 min-w-[18px] text-center leading-none"
              style={{ background: active ? 'rgba(255,255,255,0.25)' : ACCENT, color: '#fff' }}>{unread > 9 ? '9+' : unread}</span>
          )}
          {typeof g.badge === 'number' && g.badge > 0 && (
            <span className="text-[11px] font-mono font-bold rounded px-1.5 py-0.5 min-w-[18px] text-center leading-none"
              style={{ background: active ? 'rgba(255,255,255,0.25)' : '#F59E0B', color: active ? '#fff' : '#1a1000' }}>{g.badge > 9 ? '9+' : g.badge}</span>
          )}
        </Link>
      );
    }

    // Grupo con submenú desplegable
    const exp = isExpanded(g);
    const gActive = groupActive(g);
    return (
      <div key={g.key} className="lp-in" style={{ animationDelay: delay }}>
        <button onClick={() => toggle(g.key)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors duration-100"
          style={{ color: gActive ? '#fff' : (muted ? TXT_FAINT : TXT) }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
          <Icon className="flex-shrink-0" style={{ width: 18, height: 18, color: gActive ? '#93C5FD' : 'rgba(96,165,250,0.6)' }} />
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
                  className="relative flex items-center px-3 py-1.5 rounded-md text-[13px] transition-colors"
                  style={active ? { background: ACTIVE, color: '#fff', boxShadow: ACTIVE_GLOW } : { color: TXT }}
                  onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#fff'; } }}
                  onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = TXT; } }}>
                  {active && <span aria-hidden className="absolute -left-3 top-1 bottom-1 w-[2px] rounded-r-full" style={{ background: GOLD_BAR }} />}
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
        <Link href="/estudiante" onClick={() => setOpen(false)} className="flex items-center gap-3 group">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-[10px] overflow-hidden flex items-center justify-center" style={{ background: '#000' }}>
              <img src="/sjqa-logo.png" alt="ContaSJ" className="w-9 h-9 object-contain" />
            </div>
            <div className="absolute inset-0 rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ boxShadow: '0 0 16px rgba(59,130,246,0.55)' }} />
          </div>
          <div>
            <h1 className="text-[15px] font-black text-white tracking-wide leading-none">ContaSJ</h1>
            <p className="text-[10.5px] mt-1 leading-none" style={{ color: TXT_FAINT }}>{isDocencia ? 'Espacio Docencia' : isMultiempresa ? 'Espacio Multiempresa' : isContador ? 'Espacio Contador' : 'Espacio Educación'}</p>
          </div>
        </Link>
      </div>

      {/* Switch de espacios — solo en móvil; en escritorio vive arriba a la derecha (TopBar) */}
      <div className="lp-in lg:hidden mx-3 mt-3 p-1 rounded-lg space-y-1" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${SIDE_LINE}` }}>
        <Link href="/estudiante" onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-all"
          style={(!isContador && !isMultiempresa && !isDocencia)
            ? { background: ACCENT, color: '#fff', boxShadow: ACTIVE_GLOW }
            : { color: TXT_FAINT }}>
          <GraduationCap className="w-4 h-4 flex-shrink-0" /> Educación
        </Link>
        <Link href="/estudiante/contador" onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-all"
          style={isContador
            ? { background: '#D4A017', color: '#1a1205', boxShadow: '0 2px 12px rgba(212,160,23,0.35)' }
            : { color: TXT_FAINT }}>
          <Calculator className="w-4 h-4 flex-shrink-0" /> Contador
        </Link>
        <Link href="/estudiante/multiempresa" onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-all"
          style={isMultiempresa
            ? { background: '#7C3AED', color: '#fff', boxShadow: '0 2px 12px rgba(124,58,237,0.35)' }
            : { color: TXT_FAINT }}>
          <Users className="w-4 h-4 flex-shrink-0" /> Multiempresa
        </Link>
        {isTeacher && (
          <Link href="/profesor" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-all"
            style={isDocencia
              ? { background: '#4F46E5', color: '#fff', boxShadow: '0 2px 12px rgba(79,70,229,0.35)' }
              : { color: TXT_FAINT }}>
            <Presentation className="w-4 h-4 flex-shrink-0" /> Docencia
          </Link>
        )}
      </div>


      {!activeId && !isContador && !isMultiempresa && !isDocencia && (
        <div className="mx-3 mt-2 mb-1 px-2.5 py-2 rounded-md text-[10.5px] leading-snug" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.3)', color: '#93C5FD' }}>
          Inicia un ejercicio para operar tu empresa.
        </div>
      )}

      {isDocencia ? (
        <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
          <div className="mx-0.5 mt-1 mb-3 px-2.5 py-2 rounded-md text-[10.5px] leading-snug" style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.3)', color: '#C7D2FE' }}>
            Docencia — administrá tus cursos, ejercicios y sesiones de aula. Con los otros espacios ves el sistema tal como lo usa un estudiante.
          </div>
          <div className="space-y-0.5">{DOCENCIA_TOP.map(renderGroup)}</div>
        </nav>
      ) : isMultiempresa ? (
        <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
          <div className="mx-0.5 mt-1 mb-3 px-2.5 py-2 rounded-md text-[10.5px] leading-snug" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', color: '#C4B5FD' }}>
            Multiempresa — formá grupos con otros contadores y comerciá entre sus empresas de práctica (compra/venta, inventario, CxC/CxP y asientos reales).
          </div>
          <div className="space-y-0.5">{MULTIEMPRESA_TOP.map(renderGroup)}</div>
        </nav>
      ) : isContador ? (
        <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
          <div className="mx-0.5 mt-1 mb-3 px-2.5 py-2 rounded-md text-[10.5px] leading-snug" style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)', color: '#F5D67B' }}>
            {contadorCompanyId
              ? 'Estás operando una empresa-cliente. El menú de abajo navega SUS libros.'
              : 'Espacio Contador — tu contabilidad separada por empresa. Abrí una empresa-cliente para operar sus libros.'}
          </div>
          <div className="space-y-0.5 mb-4">{CONTADOR_TOP.map(renderGroup)}</div>
          {/* Con una empresa-cliente abierta, la barra de pestañas de esa página
              YA es la navegación completa de sus libros (Resumen/Clientes/
              Proveedores/.../Mayorización) — repetir eso acá era vista doble
              (dos navegaciones distintas apuntando al mismo ?tab=). Solo mostramos
              este submenú como preview/atajo mientras NO hay empresa abierta. */}
          {!contadorCompanyId && (
            <>
              <p className="px-2.5 mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: GOLD_EYEBROW }}>
                Contabilidad · abrí una empresa
              </p>
              <div className="space-y-0.5">{CONTADOR_GROUPS.map(renderGroup)}</div>
            </>
          )}
        </nav>
      ) : (
        <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
          <div className="space-y-0.5 mb-4">{GROUPS.map(renderGroup)}</div>
          <p className="px-2.5 mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: GOLD_EYEBROW }}>Aprendizaje</p>
          <div className="space-y-0.5">{LEARN.map(renderGroup)}</div>
        </nav>
      )}

      {/* User + Logout */}
      <div className="p-2.5" style={{ borderTop: `1px solid ${SIDE_LINE}` }}>
        <Link href="/estudiante/perfil" onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-2.5 py-2 mb-1 rounded-md transition-colors" style={{ border: `1px solid ${SIDE_LINE}` }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
          <div className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0" style={{ background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)' }}>
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
      <aside className="hidden lg:flex flex-col w-64 h-full flex-shrink-0" style={{ background: SIDE_BG, borderRight: '1px solid rgba(59,130,246,0.1)' }}>
        {sidebarContent}
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between" style={{ background: SIDE_BG, borderBottom: `1px solid ${SIDE_LINE}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: '#000' }}>
            <img src="/sjqa-logo.png" alt="ContaSJ" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="text-[15px] font-black text-white leading-none tracking-wide">ContaSJ</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && <span className="text-[11px] font-mono font-bold rounded px-1.5 py-0.5" style={{ background: ACCENT, color: '#fff' }}>{unread}</span>}
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
