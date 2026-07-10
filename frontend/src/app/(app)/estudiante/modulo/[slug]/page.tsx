'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  FileText, ShoppingCart, Package, Landmark, BookOpen, Coins,
  ClipboardList, Tag, Warehouse, Scale, RefreshCw, Building2,
  BarChart2, Inbox, FolderTree, Search, Filter, Plus, ChevronLeft,
  ChevronRight, Layers, Users, Truck, FileMinus, FilePlus, Receipt,
} from 'lucide-react';

// ── Config de cada sección (base estilo Alegra) ────────────────
interface SectionCfg {
  title: string;
  desc: string;
  icon: React.ElementType;
  cols: string[];
  create?: string;
  emptyTitle: string;
  emptyHint: string;
  kpis?: { label: string; value?: string }[];
}

const C: Record<string, SectionCfg> = {
  // ── Ingresos ──────────────────────────────────────────────
  'facturas-recurrentes': {
    title: 'Facturas recurrentes', desc: 'Programa facturas que se emiten automáticamente cada período.',
    icon: RefreshCw, create: 'Nueva factura recurrente', cols: ['Cliente', 'Frecuencia', 'Próxima', 'Monto', 'Estado'],
    emptyTitle: '¡Programa tu primera factura recurrente!', emptyHint: 'Ideal para suscripciones o cobros mensuales fijos.',
  },
  'notas-credito': {
    title: 'Notas de crédito', desc: 'Documenta devoluciones o anulaciones parciales de tus ventas.',
    icon: FileMinus, create: 'Nueva nota de crédito', cols: ['Número', 'Cliente', 'Factura', 'Fecha', 'Total'],
    emptyTitle: 'Aún no hay notas de crédito', emptyHint: 'Se generan a partir de una factura de venta emitida.',
    kpis: [{ label: 'Emitidas' }, { label: 'Total acreditado' }],
  },
  'notas-debito': {
    title: 'Notas de débito', desc: 'Aumenta el valor de una factura ya emitida (intereses, cargos).',
    icon: FilePlus, create: 'Nueva nota de débito', cols: ['Número', 'Cliente', 'Factura', 'Fecha', 'Total'],
    emptyTitle: 'Aún no hay notas de débito', emptyHint: 'Se emiten sobre una factura existente.',
  },
  'cotizaciones': {
    title: 'Cotizaciones', desc: 'Envía presupuestos a tus clientes y conviértelos en factura.',
    icon: FileText, create: 'Nueva cotización', cols: ['Número', 'Cliente', 'Fecha', 'Vence', 'Total', 'Estado'],
    emptyTitle: '¡Crea tu primera cotización!', emptyHint: 'Cuando el cliente acepte, la conviertes en factura con un clic.',
  },
  'remisiones': {
    title: 'Remisiones', desc: 'Controla la entrega de mercadería antes de facturar.',
    icon: Truck, create: 'Nueva remisión', cols: ['Número', 'Cliente', 'Fecha', 'Estado'],
    emptyTitle: 'Aún no hay remisiones', emptyHint: 'Documenta salidas de mercadería pendientes de factura.',
  },
  // ── Gastos ────────────────────────────────────────────────
  'ordenes-compra': {
    title: 'Órdenes de compra', desc: 'Solicita mercadería a tus proveedores antes de recibir la factura.',
    icon: ClipboardList, create: 'Nueva orden de compra', cols: ['Número', 'Proveedor', 'Fecha', 'Total', 'Estado'],
    emptyTitle: '¡Crea tu primera orden de compra!', emptyHint: 'Al recibir la mercadería, se convierte en factura de compra.',
  },
  'pagos-recurrentes': {
    title: 'Pagos recurrentes', desc: 'Automatiza pagos fijos a proveedores (alquiler, servicios).',
    icon: RefreshCw, create: 'Nuevo pago recurrente', cols: ['Proveedor', 'Frecuencia', 'Próximo', 'Monto'],
    emptyTitle: 'Aún no hay pagos recurrentes', emptyHint: 'Programa egresos que se repiten cada período.',
  },
  'recepcion-comprobantes': {
    title: 'Recepción de comprobantes', desc: 'Acepta o rechaza los comprobantes electrónicos que te envían.',
    icon: Inbox, create: 'Cargar comprobante', cols: ['Emisor', 'Documento', 'Fecha', 'Total', 'Estado'],
    emptyTitle: 'Sin comprobantes por recibir', emptyHint: 'Aquí aparecen las facturas electrónicas de tus proveedores.',
  },
  // ── Inventario ────────────────────────────────────────────
  'valor-inventario': {
    title: 'Valor de inventario', desc: 'Consulta el valor de tu inventario por método FIFO.',
    icon: BarChart2, cols: ['Producto', 'Existencias', 'Costo unitario', 'Valor total'],
    emptyTitle: 'Aún no hay inventario valorado', emptyHint: 'Registra compras de mercadería para ver su valoración.',
    kpis: [{ label: 'Valor total' }, { label: 'Ítems' }, { label: 'Existencias' }],
  },
  'ajustes-inventario': {
    title: 'Ajustes de inventario', desc: 'Corrige existencias por mermas, daños o conteos físicos.',
    icon: Scale, create: 'Nuevo ajuste', cols: ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo'],
    emptyTitle: 'Aún no hay ajustes', emptyHint: 'Cada ajuste genera su asiento contable automático.',
  },
  'listas-precios': {
    title: 'Listas de precios', desc: 'Define distintos precios (mayorista, minorista) por producto.',
    icon: Tag, create: 'Nueva lista de precios', cols: ['Nombre', 'Productos', 'Moneda'],
    emptyTitle: 'Solo tienes la lista General', emptyHint: 'Crea listas para segmentar precios por tipo de cliente.',
  },
  'bodegas': {
    title: 'Bodegas', desc: 'Administra múltiples ubicaciones de tu inventario.',
    icon: Warehouse, create: 'Nueva bodega', cols: ['Nombre', 'Ubicación', 'Ítems'],
    emptyTitle: 'Aún no hay bodegas', emptyHint: 'Separa tu inventario por sucursal o almacén.',
  },
  'categorias': {
    title: 'Categorías', desc: 'Organiza tus productos y servicios en categorías.',
    icon: FolderTree, create: 'Nueva categoría', cols: ['Nombre', 'Productos'],
    emptyTitle: 'Aún no hay categorías', emptyHint: 'Agrupa tus ítems para reportes más claros.',
  },
  'atributos': {
    title: 'Atributos', desc: 'Define variantes de tus productos (talla, color, etc.).',
    icon: Layers, create: 'Nuevo atributo', cols: ['Nombre', 'Valores'],
    emptyTitle: 'Aún no hay atributos', emptyHint: 'Útil para productos con variantes.',
  },
  // ── Contabilidad ──────────────────────────────────────────
  'catalogo-cuentas': {
    title: 'Catálogo de cuentas', desc: 'El plan de cuentas de tu empresa bajo NIIF (Costa Rica).',
    icon: BookOpen, cols: ['Código', 'Cuenta', 'Tipo', 'Naturaleza', 'Saldo'],
    emptyTitle: 'El catálogo se crea con tu empresa', emptyHint: 'Al constituir tu empresa en un ejercicio, se genera el plan de cuentas completo.',
  },

  // ── Secciones "funcionales" (base cuando aún no hay ejercicio activo) ──
  'clientes': {
    title: 'Clientes', desc: 'Administra a quién le vendes y su saldo por cobrar.',
    icon: Users, create: 'Nuevo cliente', cols: ['Nombre', 'Identificación', 'Correo', 'Teléfono', 'Saldo'],
    emptyTitle: '¡Registra tu primer cliente!', emptyHint: 'Los clientes se usan al emitir facturas de venta.',
  },
  'proveedores': {
    title: 'Proveedores', desc: 'Administra a quién le compras y tu saldo por pagar.',
    icon: Truck, create: 'Nuevo proveedor', cols: ['Nombre', 'Identificación', 'Correo', 'Teléfono', 'Saldo'],
    emptyTitle: '¡Registra tu primer proveedor!', emptyHint: 'Los proveedores se usan en las facturas de compra.',
  },
  'facturas-venta': {
    title: 'Facturas de venta', desc: 'Emite comprobantes electrónicos y controla tus ingresos.',
    icon: FileText, create: 'Nueva factura de venta', cols: ['Número', 'Cliente', 'Fecha', 'Vence', 'Total', 'Estado'],
    emptyTitle: '¡Crea tu primera factura!', emptyHint: 'Cada factura genera su asiento contable e IVA automático.',
    kpis: [{ label: 'Ventas del período' }, { label: 'Por cobrar' }],
  },
  'pagos-recibidos': {
    title: 'Pagos recibidos', desc: 'Registra los abonos de tus clientes a sus facturas.',
    icon: Coins, create: 'Registrar pago', cols: ['Fecha', 'Cliente', 'Factura', 'Método', 'Monto'],
    emptyTitle: 'Aún no hay pagos recibidos', emptyHint: 'Se aplican sobre facturas de venta pendientes.',
  },
  'facturas-compra': {
    title: 'Facturas de compra', desc: 'Registra tus compras a proveedores y el crédito fiscal.',
    icon: ShoppingCart, create: 'Nueva factura de compra', cols: ['Número', 'Proveedor', 'Fecha', 'Total', 'Por pagar'],
    emptyTitle: '¡Registra tu primera compra!', emptyHint: 'Genera crédito fiscal para tu D-104 y su asiento.',
    kpis: [{ label: 'Compras del período' }, { label: 'Por pagar' }],
  },
  'productos': {
    title: 'Ítems y productos', desc: 'Tu catálogo de productos y servicios.',
    icon: Package, create: 'Nuevo ítem', cols: ['Código', 'Nombre', 'Precio', 'Existencias', 'Categoría'],
    emptyTitle: '¡Crea tu primer ítem de venta!', emptyHint: 'Los ítems se usan al facturar y controlan el inventario.',
  },
  'bancos': {
    title: 'Bancos y cajas', desc: 'Controla tus cuentas bancarias y efectivo.',
    icon: Landmark, create: 'Nueva cuenta', cols: ['Cuenta', 'Banco', 'Moneda', 'Saldo'],
    emptyTitle: 'Aún no hay cuentas registradas', emptyHint: 'Agrega tus cuentas para conciliar movimientos.',
    kpis: [{ label: 'Saldo total' }],
  },
  'conciliaciones': {
    title: 'Conciliaciones bancarias', desc: 'Cuadra tus libros contra el estado del banco.',
    icon: Scale, create: 'Nueva conciliación', cols: ['Cuenta', 'Período', 'Estado', 'Diferencia'],
    emptyTitle: 'Aún no hay conciliaciones', emptyHint: 'Compara tus asientos con el extracto bancario.',
  },
  'asiento-contable': {
    title: 'Asiento contable', desc: 'Registra ajustes y traslados entre tus cuentas.',
    icon: BookOpen, create: 'Nuevo asiento contable', cols: ['N°', 'Fecha', 'Descripción', 'Débito', 'Crédito', 'Estado'],
    emptyTitle: '¡Aún no has creado tu primer asiento!', emptyHint: 'La mayoría se generan solos al facturar; aquí registras los manuales.',
  },
  'libro-diario': {
    title: 'Libro diario', desc: 'Todos los asientos en orden cronológico.',
    icon: BookOpen, cols: ['Fecha', 'Asiento', 'Cuenta', 'Débito', 'Crédito'],
    emptyTitle: 'El diario está vacío', emptyHint: 'Registra operaciones para ver sus asientos aquí.',
  },
  'libro-mayor': {
    title: 'Libro mayor', desc: 'Saldos acumulados por cuenta (mayorización).',
    icon: BookOpen, cols: ['Cuenta', 'Débitos', 'Créditos', 'Saldo'],
    emptyTitle: 'El mayor está vacío', emptyHint: 'Se arma automáticamente a partir del diario.',
  },
  'ajustes': {
    title: 'Ajustes contables', desc: 'Devengados, diferidos, depreciación e incobrables.',
    icon: RefreshCw, create: 'Nuevo ajuste', cols: ['Fecha', 'Descripción', 'Débito', 'Crédito'],
    emptyTitle: 'Aún no hay ajustes', emptyHint: 'Se registran al cierre del período contable.',
  },
  'asientos-cierre': {
    title: 'Asientos de cierre', desc: 'Cierra ingresos y gastos contra resultados.',
    icon: Scale, cols: ['Fecha', 'Descripción', 'Débito', 'Crédito'],
    emptyTitle: 'Aún no hay asientos de cierre', emptyHint: 'Se generan al final del ejercicio contable.',
  },
  'activos': {
    title: 'Activos fijos', desc: 'Registra tus activos y su depreciación.',
    icon: Building2, create: 'Nuevo activo', cols: ['Activo', 'Compra', 'Costo', 'Deprec. acum.', 'Valor en libros'],
    emptyTitle: 'Aún no hay activos fijos', emptyHint: 'Mobiliario, equipo, vehículos… con su depreciación automática.',
  },
  'balance-comprobacion': {
    title: 'Balance de comprobación', desc: 'Verifica que débitos y créditos cuadren.',
    icon: ClipboardList, cols: ['Cuenta', 'Débitos', 'Créditos', 'Saldo deudor', 'Saldo acreedor'],
    emptyTitle: 'Sin movimientos para comprobar', emptyHint: 'Registra asientos para ver el balance de comprobación.',
  },
  'estados-financieros': {
    title: 'Estados financieros', desc: 'Balance General y Estado de Resultados bajo NIIF.',
    icon: BarChart2, cols: ['Reporte', 'Período', 'Estado'],
    emptyTitle: 'Genera tus estados financieros', emptyHint: 'Con tus asientos, aquí verás el Balance General y el Estado de Resultados.',
  },
};

const AREA_OF: Record<string, string> = {
  'clientes': 'Ingresos', 'facturas-venta': 'Ingresos', 'pagos-recibidos': 'Ingresos',
  'facturas-recurrentes': 'Ingresos', 'notas-credito': 'Ingresos', 'notas-debito': 'Ingresos',
  'cotizaciones': 'Ingresos', 'remisiones': 'Ingresos',
  'proveedores': 'Gastos', 'facturas-compra': 'Gastos',
  'ordenes-compra': 'Gastos', 'pagos-recurrentes': 'Gastos', 'recepcion-comprobantes': 'Gastos',
  'productos': 'Inventario', 'valor-inventario': 'Inventario', 'ajustes-inventario': 'Inventario',
  'listas-precios': 'Inventario', 'bodegas': 'Inventario', 'categorias': 'Inventario', 'atributos': 'Inventario',
  'bancos': 'Bancos', 'conciliaciones': 'Bancos',
  'catalogo-cuentas': 'Contabilidad', 'asiento-contable': 'Contabilidad', 'libro-diario': 'Contabilidad',
  'libro-mayor': 'Contabilidad', 'ajustes': 'Contabilidad', 'asientos-cierre': 'Contabilidad', 'activos': 'Contabilidad',
  'balance-comprobacion': 'Reportes', 'estados-financieros': 'Reportes',
};

export default function ModuloPage() {
  const params = useParams();
  const slug = String(params.slug ?? '');
  const cfg = C[slug];

  if (!cfg) {
    return (
      <div className="flex-1 p-8" style={{ background: '#F4F6F8' }}>
        <div className="max-w-md mx-auto text-center py-20">
          <Package className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <h1 className="text-lg font-bold text-gray-800">Sección no encontrada</h1>
          <Link href="/estudiante" className="text-teal-700 text-sm font-semibold">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  const Icon = cfg.icon;
  const area = AREA_OF[slug];
  const soon = () => toast('Esta sección está en construcción — pronto podrás crear aquí.', { icon: '🛠️' });

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ background: '#F4F6F8' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#0D948818' }}>
              <Icon className="w-5 h-5" style={{ color: '#0D9488' }} />
            </div>
            <div>
              {area && <p className="text-[11px] font-mono font-semibold uppercase tracking-wide text-gray-400">{area}</p>}
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{cfg.title}</h1>
              <p className="text-sm text-gray-500 mt-0.5 max-w-xl">{cfg.desc}</p>
            </div>
          </div>
          {cfg.create && (
            <button onClick={soon}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold text-white"
              style={{ background: '#0D9488' }}>
              <Plus className="w-4 h-4" /> {cfg.create}
            </button>
          )}
        </div>

        {/* KPIs en cero (si aplica) */}
        {cfg.kpis && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cfg.kpis.map((k) => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4" style={{ boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
                <p className="text-[11px] font-mono font-semibold uppercase tracking-wide text-gray-500">{k.label}</p>
                <p className="mt-3 text-2xl font-bold text-gray-900 font-mono tabular-nums">{k.value ?? '₡0,00'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Card con toolbar + tabla vacía (estilo Alegra) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-wrap">
            <div className="flex items-center gap-2 px-3 h-9 rounded-lg flex-1 min-w-[180px] max-w-sm" style={{ background: '#F1F5F4', border: '1px solid #E1E7EA' }}>
              <Search className="w-4 h-4 text-gray-400" />
              <input placeholder="Buscar por nombre o código" className="bg-transparent outline-none text-sm text-gray-600 w-full placeholder:text-gray-400" />
            </div>
            <button onClick={soon} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
              <Filter className="w-4 h-4" /> Filtrar
            </button>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-mono uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  {cfg.cols.map((c) => <th key={c} className="px-4 py-2.5 font-semibold">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={cfg.cols.length} className="px-4">
                    <div className="flex flex-col items-center justify-center text-center py-16">
                      <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'linear-gradient(135deg,#F0FDFA,#F1F5F9)', boxShadow: '0 0 0 1px rgba(13,148,136,0.12), inset 0 1px 0 rgba(255,255,255,0.6)' }}>
                        <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(13,148,136,0.14), transparent 70%)' }} />
                        <Icon className="relative w-7 h-7" style={{ color: '#0D9488' }} />
                      </div>
                      <h3 className="text-gray-700 font-semibold">{cfg.emptyTitle}</h3>
                      <p className="text-gray-400 text-sm mt-1 max-w-sm">{cfg.emptyHint}</p>
                      {cfg.create && (
                        <button onClick={soon} className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-white" style={{ background: '#0D9488' }}>
                          <Plus className="w-4 h-4" /> {cfg.create}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer paginación */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-400 flex-wrap gap-2">
            <span className="flex items-center gap-2 font-mono">Resultados por página: <span className="px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-500">10</span></span>
            <span className="font-mono tabular-nums">0 de 0</span>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-300"><ChevronLeft className="w-4 h-4" /></button>
              <button className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-300"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" />
          Base de la sección lista. La creación y la lógica contable se conectan en las próximas iteraciones.
        </p>
      </div>
    </div>
  );
}
