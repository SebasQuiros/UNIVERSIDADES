import {
  Injectable, BadRequestException,
  NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/activity/activity-log.service';
import { readSpreadsheet } from '../../common/upload/read-spreadsheet';
import { AccountType, NormalBalance } from '@prisma/client';
import { CreateAccountDto, UpdateAccountDto } from './dto/accounts.dto';

// ── Standard 50-account chart for Costa Rica ─────────────────
const CHART: Array<{
  code: string; name: string;
  type: AccountType; normal: NormalBalance;
  level: number; parent: string | null; isHeader: boolean;
}> = [
  // ── 1. ACTIVOS ──────────────────────────────────────────────
  { code:'1',          name:'ACTIVOS',                         type:'ASSET',     normal:'DEBIT',  level:1, parent:null,      isHeader:true  },
  { code:'1.1',        name:'Activo Corriente',                type:'ASSET',     normal:'DEBIT',  level:2, parent:'1',       isHeader:true  },
  { code:'1.1.01',     name:'Caja y Equivalentes',             type:'ASSET',     normal:'DEBIT',  level:3, parent:'1.1',     isHeader:true  },
  { code:'1.1.01.01',  name:'Caja General',                    type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.01',  isHeader:false },
  { code:'1.1.01.02',  name:'Banco Nacional de CR (₡)',        type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.01',  isHeader:false },
  { code:'1.1.01.03',  name:'Banco de Costa Rica (₡)',         type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.01',  isHeader:false },
  { code:'1.1.02',     name:'Cuentas por Cobrar',              type:'ASSET',     normal:'DEBIT',  level:3, parent:'1.1',     isHeader:true  },
  { code:'1.1.02.01',  name:'Clientes Comerciales',            type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.02',  isHeader:false },
  { code:'1.1.02.02',  name:'Documentos por Cobrar',           type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.02',  isHeader:false },
  { code:'1.1.02.03',  name:'Estimación para Cuentas Incobrables', type:'ASSET', normal:'CREDIT', level:4, parent:'1.1.02',  isHeader:false },
  { code:'1.1.03',     name:'Inventarios',                     type:'ASSET',     normal:'DEBIT',  level:3, parent:'1.1',     isHeader:true  },
  { code:'1.1.03.01',  name:'Inventario de Mercadería',        type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.03',  isHeader:false },
  { code:'1.1.03.02',  name:'Inventario de Materias Primas',   type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.03',  isHeader:false },
  { code:'1.1.03.03',  name:'Inventario de Productos en Proceso', type:'ASSET',  normal:'DEBIT',  level:4, parent:'1.1.03',  isHeader:false },
  { code:'1.1.04',     name:'Impuestos por Recuperar',         type:'ASSET',     normal:'DEBIT',  level:3, parent:'1.1',     isHeader:true  },
  { code:'1.1.04.01',  name:'IVA Crédito Fiscal',              type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.04',  isHeader:false },
  { code:'1.1.05',     name:'Gastos Pagados por Anticipado',   type:'ASSET',     normal:'DEBIT',  level:3, parent:'1.1',     isHeader:true  },
  { code:'1.1.05.01',  name:'Seguros Prepagados',              type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.05',  isHeader:false },
  { code:'1.1.05.02',  name:'Alquileres Pagados por Anticipado', type:'ASSET',   normal:'DEBIT',  level:4, parent:'1.1.05',  isHeader:false },
  { code:'1.1.06',     name:'Otras Cuentas por Cobrar',        type:'ASSET',     normal:'DEBIT',  level:3, parent:'1.1',     isHeader:true  },
  { code:'1.1.06.01',  name:'Anticipo a Proveedores',          type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.06',  isHeader:false },
  { code:'1.1.06.02',  name:'Cuentas por Cobrar a Empleados',  type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.06',  isHeader:false },
  { code:'1.2',        name:'Activo No Corriente',             type:'ASSET',     normal:'DEBIT',  level:2, parent:'1',       isHeader:true  },
  { code:'1.2.01',     name:'Propiedad, Planta y Equipo',      type:'ASSET',     normal:'DEBIT',  level:3, parent:'1.2',     isHeader:true  },
  { code:'1.2.01.01',  name:'Equipo de Cómputo',               type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.02',  name:'Vehículos',                       type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.03',  name:'Mobiliario y Equipo de Oficina',  type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.04',  name:'Edificios',                       type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.05',  name:'Terrenos',                        type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.06',  name:'Maquinaria y Equipo',              type:'ASSET',    normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.02',     name:'Depreciación Acumulada',          type:'ASSET',     normal:'CREDIT', level:3, parent:'1.2',     isHeader:true  },
  { code:'1.2.02.01',  name:'Dep. Acum. Equipo de Cómputo',    type:'ASSET',     normal:'CREDIT', level:4, parent:'1.2.02',  isHeader:false },
  { code:'1.2.02.02',  name:'Depreciación Acumulada — General', type:'ASSET',    normal:'CREDIT', level:4, parent:'1.2.02',  isHeader:false },
  { code:'1.2.03',     name:'Activos Intangibles',             type:'ASSET',     normal:'DEBIT',  level:3, parent:'1.2',     isHeader:true  },
  { code:'1.2.03.01',  name:'Software y Licencias',            type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.03',  isHeader:false },
  { code:'1.2.03.02',  name:'Marcas y Patentes',                type:'ASSET',    normal:'DEBIT',  level:4, parent:'1.2.03',  isHeader:false },
  // ── 2. PASIVOS ──────────────────────────────────────────────
  { code:'2',          name:'PASIVOS',                         type:'LIABILITY', normal:'CREDIT', level:1, parent:null,      isHeader:true  },
  { code:'2.1',        name:'Pasivo Corriente',                type:'LIABILITY', normal:'CREDIT', level:2, parent:'2',       isHeader:true  },
  { code:'2.1.01',     name:'Cuentas por Pagar',               type:'LIABILITY', normal:'CREDIT', level:3, parent:'2.1',     isHeader:true  },
  { code:'2.1.01.01',  name:'Proveedores Comerciales',         type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.01',  isHeader:false },
  { code:'2.1.01.02',  name:'Documentos por Pagar',            type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.01',  isHeader:false },
  { code:'2.1.01.03',  name:'Anticipos de Clientes',           type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.01',  isHeader:false },
  { code:'2.1.02',     name:'Impuestos por Pagar',             type:'LIABILITY', normal:'CREDIT', level:3, parent:'2.1',     isHeader:true  },
  { code:'2.1.02.01',  name:'IVA por Pagar (13%)',             type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.02',  isHeader:false },
  { code:'2.1.02.02',  name:'Retenciones por Pagar',           type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.02',  isHeader:false },
  { code:'2.1.02.03',  name:'IVA a Pagar Hacienda',            type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.02',  isHeader:false },
  { code:'2.1.02.04',  name:'Impuesto Renta por Pagar',        type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.02',  isHeader:false },
  { code:'2.1.03',     name:'Gastos Acumulados por Pagar',     type:'LIABILITY', normal:'CREDIT', level:3, parent:'2.1',     isHeader:true  },
  { code:'2.1.03.01',  name:'Salarios por Pagar',              type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.03',  isHeader:false },
  { code:'2.1.03.02',  name:'Servicios por Pagar',             type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.03',  isHeader:false },
  // ── Nómina y Cargas Sociales ─────────────────────────────────
  { code:'2.1.04',     name:'Obligaciones Laborales por Pagar', type:'LIABILITY', normal:'CREDIT', level:3, parent:'2.1',    isHeader:true  },
  { code:'2.1.04.01',  name:'Sueldos por Pagar',               type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.04', isHeader:false },
  { code:'2.1.04.02',  name:'CCSS por Pagar',                  type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.04', isHeader:false },
  { code:'2.1.04.03',  name:'Aguinaldo por Pagar',             type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.04', isHeader:false },
  { code:'2.1.04.04',  name:'Imp. Renta Retención por Pagar',  type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.04', isHeader:false },
  { code:'2.1.05',     name:'Dividendos por Pagar',             type:'LIABILITY', normal:'CREDIT', level:3, parent:'2.1',     isHeader:true  },
  { code:'2.1.05.01',  name:'Dividendos Declarados por Pagar', type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.05',  isHeader:false },
  { code:'2.2',        name:'Pasivo No Corriente',             type:'LIABILITY', normal:'CREDIT', level:2, parent:'2',       isHeader:true  },
  { code:'2.2.01',     name:'Préstamos Bancarios L/P',         type:'LIABILITY', normal:'CREDIT', level:3, parent:'2.2',     isHeader:true  },
  { code:'2.2.01.01',  name:'Préstamo Banco Nacional L/P',     type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.2.01',  isHeader:false },
  // ── 3. PATRIMONIO ───────────────────────────────────────────
  { code:'3',          name:'PATRIMONIO',                      type:'EQUITY',    normal:'CREDIT', level:1, parent:null,      isHeader:true  },
  { code:'3.1',        name:'Capital Social',                  type:'EQUITY',    normal:'CREDIT', level:2, parent:'3',       isHeader:true  },
  { code:'3.1.01',     name:'Capital Aportado',                type:'EQUITY',    normal:'CREDIT', level:3, parent:'3.1',     isHeader:true  },
  { code:'3.1.01.01',  name:'Capital Social Ordinario',        type:'EQUITY',    normal:'CREDIT', level:4, parent:'3.1.01',  isHeader:false },
  { code:'3.1.02',     name:'Reservas',                        type:'EQUITY',    normal:'CREDIT', level:3, parent:'3.1',     isHeader:true  },
  { code:'3.1.02.01',  name:'Reserva Legal',                   type:'EQUITY',    normal:'CREDIT', level:4, parent:'3.1.02',  isHeader:false },
  { code:'3.2',        name:'Resultados',                      type:'EQUITY',    normal:'CREDIT', level:2, parent:'3',       isHeader:true  },
  { code:'3.2.01',     name:'Utilidades Retenidas',            type:'EQUITY',    normal:'CREDIT', level:3, parent:'3.2',     isHeader:true  },
  { code:'3.2.01.01',  name:'Utilidades de Períodos Anteriores', type:'EQUITY',  normal:'CREDIT', level:4, parent:'3.2.01',  isHeader:false },
  { code:'3.2.02',     name:'Resultado del Período',           type:'EQUITY',    normal:'CREDIT', level:3, parent:'3.2',     isHeader:true  },
  { code:'3.2.02.01',  name:'Utilidad / Pérdida del Período',  type:'EQUITY',    normal:'CREDIT', level:4, parent:'3.2.02',  isHeader:false },
  // ── 4. INGRESOS ─────────────────────────────────────────────
  { code:'4',          name:'INGRESOS',                        type:'INCOME',    normal:'CREDIT', level:1, parent:null,      isHeader:true  },
  { code:'4.1',        name:'Ingresos Operativos',             type:'INCOME',    normal:'CREDIT', level:2, parent:'4',       isHeader:true  },
  { code:'4.1.01',     name:'Ventas',                          type:'INCOME',    normal:'CREDIT', level:3, parent:'4.1',     isHeader:true  },
  { code:'4.1.01.01',  name:'Ventas de Mercadería',            type:'INCOME',    normal:'CREDIT', level:4, parent:'4.1.01',  isHeader:false },
  { code:'4.1.01.02',  name:'Ventas de Servicios',             type:'INCOME',    normal:'CREDIT', level:4, parent:'4.1.01',  isHeader:false },
  { code:'4.1.02',     name:'Devoluciones y Descuentos sobre Ventas', type:'INCOME', normal:'DEBIT', level:3, parent:'4.1',  isHeader:true  },
  { code:'4.1.02.01',  name:'Devoluciones sobre Ventas',       type:'INCOME',    normal:'DEBIT',  level:4, parent:'4.1.02',  isHeader:false },
  { code:'4.1.02.02',  name:'Descuentos sobre Ventas',         type:'INCOME',    normal:'DEBIT',  level:4, parent:'4.1.02',  isHeader:false },
  { code:'4.2',        name:'Ingresos No Operativos',          type:'INCOME',    normal:'CREDIT', level:2, parent:'4',       isHeader:true  },
  { code:'4.2.01',     name:'Otros Ingresos',                  type:'INCOME',    normal:'CREDIT', level:3, parent:'4.2',     isHeader:true  },
  { code:'4.2.01.01',  name:'Intereses Ganados',               type:'INCOME',    normal:'CREDIT', level:4, parent:'4.2.01',  isHeader:false },
  // Fase 19 — ajustes manuales de inventario (sobrante/corrección al alza).
  { code:'4.2.01.02',  name:'Ajuste de Inventario — Sobrante', type:'INCOME',    normal:'CREDIT', level:4, parent:'4.2.01',  isHeader:false },
  { code:'4.2.01.03',  name:'Ganancia por Diferencial Cambiario', type:'INCOME', normal:'CREDIT', level:4, parent:'4.2.01',  isHeader:false },
  // ── 5. GASTOS ────────────────────────────────────────────────
  { code:'5',          name:'GASTOS',                          type:'EXPENSE',   normal:'DEBIT',  level:1, parent:null,      isHeader:true  },
  { code:'5.1',        name:'Costo de Ventas',                 type:'EXPENSE',   normal:'DEBIT',  level:2, parent:'5',       isHeader:true  },
  { code:'5.1.01',     name:'Costo de Mercadería Vendida',     type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'5.1',     isHeader:true  },
  { code:'5.1.01.01',  name:'CMV - Mercadería',                type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.1.01',  isHeader:false },
  // Fase 19 — ajustes manuales de inventario (merma/conteo físico/daño).
  { code:'5.1.01.02',  name:'Ajuste de Inventario — Merma',    type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.1.01',  isHeader:false },
  { code:'5.2',        name:'Gastos de Operación',             type:'EXPENSE',   normal:'DEBIT',  level:2, parent:'5',       isHeader:true  },
  { code:'5.2.01',     name:'Gastos Administrativos',          type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'5.2',     isHeader:true  },
  { code:'5.2.01.01',  name:'Sueldos y Salarios',              type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.02',  name:'Alquiler de Local',               type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.03',  name:'Servicios Públicos (Agua, Luz)',   type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.04',  name:'Comunicaciones y Internet',        type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.05',  name:'Gasto por Depreciación',           type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.06',  name:'Papelería y Útiles de Oficina',    type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.07',  name:'Mantenimiento y Reparaciones',     type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.08',  name:'Seguros',                          type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.09',  name:'Combustibles y Lubricantes',       type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.10',  name:'Capacitación y Desarrollo',        type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.11',  name:'Honorarios Profesionales',         type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.02',     name:'Gastos de Ventas',                type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'5.2',     isHeader:true  },
  { code:'5.2.02.01',  name:'Publicidad y Propaganda',         type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },
  { code:'5.2.02.02',  name:'Fletes y Envíos',                 type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },
  { code:'5.2.02.03',  name:'Comisiones sobre Ventas',         type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },
  { code:'5.3',        name:'Gastos Financieros',              type:'EXPENSE',   normal:'DEBIT',  level:2, parent:'5',       isHeader:true  },
  { code:'5.3.01',     name:'Intereses y Comisiones Bancarias', type:'EXPENSE',  normal:'DEBIT',  level:3, parent:'5.3',     isHeader:true  },
  { code:'5.3.01.01',  name:'Intereses Bancarios',             type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.3.01',  isHeader:false },
  { code:'5.3.01.02',  name:'Comisiones Bancarias',             type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.3.01',  isHeader:false },
  { code:'5.3.01.03',  name:'Pérdida por Diferencial Cambiario', type:'EXPENSE',  normal:'DEBIT',  level:4, parent:'5.3.01',  isHeader:false },
  // ── 6. GASTOS DE PERSONAL (NÓMINA CCSS) ────────────────────────────────
  { code:'6',          name:'GASTOS DE PERSONAL',              type:'EXPENSE',   normal:'DEBIT',  level:1, parent:null,      isHeader:true  },
  { code:'6.1',        name:'Remuneraciones y Cargas Sociales', type:'EXPENSE',  normal:'DEBIT',  level:2, parent:'6',       isHeader:true  },
  { code:'6.1.01',     name:'Sueldos y Salarios',              type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'6.1',     isHeader:true  },
  { code:'6.1.01.01',  name:'Sueldos y Salarios',              type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'6.1.01',  isHeader:false },
  { code:'6.1.02',     name:'Cargas Sociales Patrono',         type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'6.1',     isHeader:true  },
  { code:'6.1.02.01',  name:'Cargas Sociales Patrono (CCSS)',  type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'6.1.02',  isHeader:false },
  { code:'6.1.03',     name:'Provisiones Laborales',           type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'6.1',     isHeader:true  },
  { code:'6.1.03.01',  name:'Aguinaldo — Provisión',           type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'6.1.03',  isHeader:false },
  { code:'6.1.04',     name:'Vacaciones y Otros',              type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'6.1',     isHeader:true  },
  { code:'6.1.04.01',  name:'Vacaciones — Provisión',          type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'6.1.04',  isHeader:false },

  // ── Subcuentas específicas adicionales (catálogo más detallado) ──────────
  // Bancos y efectivo
  { code:'1.1.01.04',  name:'Caja Chica',                      type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.01',  isHeader:false },
  { code:'1.1.01.05',  name:'BAC San José (₡)',                type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.01',  isHeader:false },
  { code:'1.1.01.06',  name:'Banco Nacional de CR (US$)',      type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.01',  isHeader:false },
  { code:'1.1.01.07',  name:'Cuenta de Ahorros',               type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.01',  isHeader:false },
  // Cuentas por cobrar
  { code:'1.1.02.04',  name:'Tarjetas por Cobrar',             type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.02',  isHeader:false },
  { code:'1.1.02.05',  name:'Cheques por Depositar',           type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.02',  isHeader:false },
  // Inventarios
  { code:'1.1.03.04',  name:'Inventario de Suministros',       type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.03',  isHeader:false },
  { code:'1.1.03.05',  name:'Mercadería en Tránsito',          type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.03',  isHeader:false },
  // Impuestos por recuperar
  { code:'1.1.04.02',  name:'Retenciones de Renta a Favor',    type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.04',  isHeader:false },
  { code:'1.1.04.03',  name:'IVA Crédito Fiscal (tarifas reducidas)', type:'ASSET', normal:'DEBIT', level:4, parent:'1.1.04', isHeader:false },
  // PPE y depreciación
  { code:'1.2.01.07',  name:'Equipo de Reparto',               type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.08',  name:'Herramientas',                    type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.02.03',  name:'Dep. Acum. Vehículos',            type:'ASSET',     normal:'CREDIT', level:4, parent:'1.2.02',  isHeader:false },
  { code:'1.2.02.04',  name:'Dep. Acum. Edificios',            type:'ASSET',     normal:'CREDIT', level:4, parent:'1.2.02',  isHeader:false },
  { code:'1.2.02.05',  name:'Dep. Acum. Mobiliario y Equipo',  type:'ASSET',     normal:'CREDIT', level:4, parent:'1.2.02',  isHeader:false },
  // Pasivos
  { code:'2.1.01.04',  name:'Acreedores Varios',               type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.01',  isHeader:false },
  // Puente entre la RECEPCION y la FACTURA de compra. La mercaderia ya entro
  // (esta en el kardex y hay que responder por ella), pero el proveedor
  // todavia no factura, asi que no es una cuenta por pagar todavia. Sin esta
  // cuenta, recibir mercaderia subia el kardex y no tocaba los libros: el
  // inventario fisico y el contable se separaban en silencio.
  { code:'2.1.01.05',  name:'Mercaderia Recibida por Facturar', type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.01',  isHeader:false },
  { code:'2.1.03.03',  name:'Intereses por Pagar',             type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.03',  isHeader:false },
  { code:'2.1.03.04',  name:'Servicios Públicos por Pagar',    type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.03',  isHeader:false },
  // Ingresos
  { code:'4.1.01.03',  name:'Ventas de Exportación',           type:'INCOME',    normal:'CREDIT', level:4, parent:'4.1.01',  isHeader:false },
  { code:'4.2.01.04',  name:'Ingresos por Alquileres',         type:'INCOME',    normal:'CREDIT', level:4, parent:'4.2.01',  isHeader:false },
  { code:'4.2.01.05',  name:'Ingresos por Comisiones',         type:'INCOME',    normal:'CREDIT', level:4, parent:'4.2.01',  isHeader:false },
  // Gastos administrativos
  { code:'5.2.01.12',  name:'Cuotas y Suscripciones',          type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.13',  name:'Gastos Legales y Notariales',     type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.14',  name:'Limpieza y Seguridad',            type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.15',  name:'Gastos de Representación',        type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.16',  name:'Impuestos Municipales y Patentes', type:'EXPENSE',  normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  // Gastos de ventas
  { code:'5.2.02.04',  name:'Empaque y Embalaje',              type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },
  { code:'5.2.02.05',  name:'Viáticos de Ventas',              type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },

  // ═══════════════════════════════════════════
  //  Catalogo del plan de estudios (carrera de Contabilidad)
  //
  //  Se AGREGAN dentro de la jerarquia existente en vez de reemplazarla: el
  //  motor contable resuelve las cuentas por codigo (1.1.01.01 = Caja,
  //  1.1.03.01 = Inventario, 4.1.01.01 = Ventas...). Renumerar a los codigos
  //  de tres digitos del plan dejaria sin cuentas a facturacion, compras,
  //  nomina, depreciacion e inventario: todo lo automatico.
  // ═══════════════════════════════════════════

  // Inventarios por naturaleza
  { code:'1.1.03.06',  name:'Inventario de Suministros de Oficina', type:'ASSET', normal:'DEBIT', level:4, parent:'1.1.03', isHeader:false },
  { code:'1.1.03.07',  name:'Inventario de Materiales',        type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.03',  isHeader:false },
  { code:'1.1.03.08',  name:'Inventario de Papeleria y Utiles de Oficina', type:'ASSET', normal:'DEBIT', level:4, parent:'1.1.03', isHeader:false },
  { code:'1.1.03.09',  name:'Inventario de Materiales Publicitarios', type:'ASSET', normal:'DEBIT', level:4, parent:'1.1.03', isHeader:false },
  { code:'1.1.03.10',  name:'Inventario de Articulos de Oficina', type:'ASSET',   normal:'DEBIT',  level:4, parent:'1.1.03',  isHeader:false },

  // Gastos pagados por adelantado: cada poliza por separado
  { code:'1.1.05.03',  name:'Seguro de Incendio Pagado por Adelantado', type:'ASSET', normal:'DEBIT', level:4, parent:'1.1.05', isHeader:false },
  { code:'1.1.05.04',  name:'Seguro de Vehiculo Pagado por Adelantado', type:'ASSET', normal:'DEBIT', level:4, parent:'1.1.05', isHeader:false },
  { code:'1.1.05.05',  name:'Seguro de Vida Pagado por Adelantado', type:'ASSET', normal:'DEBIT', level:4, parent:'1.1.05', isHeader:false },
  { code:'1.1.05.06',  name:'Seguro contra Robo Pagado por Adelantado', type:'ASSET', normal:'DEBIT', level:4, parent:'1.1.05', isHeader:false },
  { code:'1.1.05.07',  name:'Licencias Pagadas por Adelantado', type:'ASSET',   normal:'DEBIT',  level:4, parent:'1.1.05',  isHeader:false },
  { code:'1.1.05.08',  name:'Publicidad Pagada por Adelantado', type:'ASSET',   normal:'DEBIT',  level:4, parent:'1.1.05',  isHeader:false },

  // Por cobrar: acumulados e hipoteca
  { code:'1.1.02.06',  name:'Intereses Acumulados por Cobrar', type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.02',  isHeader:false },
  { code:'1.1.02.07',  name:'Alquileres Acumulados por Cobrar', type:'ASSET',    normal:'DEBIT',  level:4, parent:'1.1.02',  isHeader:false },
  { code:'1.1.02.08',  name:'Hipoteca por Cobrar C.P.',        type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.02',  isHeader:false },
  { code:'1.1.06.03',  name:'Inversiones Transitorias C.P.',   type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.1.06',  isHeader:false },

  // Activo no corriente
  { code:'1.2.01.09',  name:'Mobiliario y Equipo de Computo',  type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.10',  name:'Herramientas Menores',            type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.11',  name:'Sistemas de Computo',             type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.12',  name:'Rotulo Publicitario',             type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.01.13',  name:'Biblioteca Tecnica',              type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.01',  isHeader:false },
  { code:'1.2.03.03',  name:'Licencias de Computo',            type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.03',  isHeader:false },
  { code:'1.2.03.04',  name:'Derecho Telefonico',              type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.03',  isHeader:false },
  { code:'1.2.04',     name:'Inversiones a Largo Plazo',       type:'ASSET',     normal:'DEBIT',  level:3, parent:'1.2',     isHeader:true  },
  { code:'1.2.04.01',  name:'Inversiones de Largo Plazo',      type:'ASSET',     normal:'DEBIT',  level:4, parent:'1.2.04',  isHeader:false },

  // Depreciacion acumulada por tipo de activo (contra-activo: saldo CREDITO)
  { code:'1.2.02.06',  name:'Dep. Acum. Maquinaria y Equipo',  type:'ASSET',     normal:'CREDIT', level:4, parent:'1.2.02',  isHeader:false },
  { code:'1.2.02.07',  name:'Dep. Acum. Equipo de Reparto',    type:'ASSET',     normal:'CREDIT', level:4, parent:'1.2.02',  isHeader:false },
  { code:'1.2.02.08',  name:'Dep. Acum. Mobiliario y Equipo de Computo', type:'ASSET', normal:'CREDIT', level:4, parent:'1.2.02', isHeader:false },

  // Pasivo: cobrado por adelantado, acumulados y largo plazo
  { code:'2.1.06',     name:'Ingresos Recibidos por Adelantado', type:'LIABILITY', normal:'CREDIT', level:3, parent:'2.1',   isHeader:true  },
  { code:'2.1.06.01',  name:'Ingresos Recibidos por Adelantado', type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.06', isHeader:false },
  { code:'2.1.06.02',  name:'Honorarios Recibidos por Adelantado', type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.06', isHeader:false },
  { code:'2.1.03.05',  name:'Gastos Acumulados por Pagar',     type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.1.03',  isHeader:false },
  { code:'2.2.01.02',  name:'Documentos por Pagar L.P.',       type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.2.01',  isHeader:false },
  { code:'2.2.01.03',  name:'Hipotecas por Pagar L.P.',        type:'LIABILITY', normal:'CREDIT', level:4, parent:'2.2.01',  isHeader:false },

  // Patrimonio
  { code:'3.1.01.02',  name:'Cuenta Capital',                  type:'EQUITY',    normal:'CREDIT', level:4, parent:'3.1.01',  isHeader:false },
  { code:'3.1.01.03',  name:'Retiros de Capital',              type:'EQUITY',    normal:'DEBIT',  level:4, parent:'3.1.01',  isHeader:false },
  { code:'3.2.01.02',  name:'Dividendos Pagados',              type:'EQUITY',    normal:'DEBIT',  level:4, parent:'3.2.01',  isHeader:false },
  { code:'3.2.01.03',  name:'Ganancias y Perdidas',            type:'EQUITY',    normal:'CREDIT', level:4, parent:'3.2.01',  isHeader:false },

  // Ventas: devoluciones y descuentos son CONTRA-ingreso (saldo deudor)
  { code:'4.1.01.04',  name:'Devoluciones sobre Ventas',       type:'INCOME',    normal:'DEBIT',  level:4, parent:'4.1.01',  isHeader:false },
  { code:'4.1.01.05',  name:'Descuentos sobre Ventas',         type:'INCOME',    normal:'DEBIT',  level:4, parent:'4.1.01',  isHeader:false },
  { code:'4.2.01.06',  name:'Ingresos por Servicios Profesionales', type:'INCOME', normal:'CREDIT', level:4, parent:'4.2.01', isHeader:false },
  { code:'4.2.01.07',  name:'Ingresos por Honorarios',         type:'INCOME',    normal:'CREDIT', level:4, parent:'4.2.01',  isHeader:false },
  { code:'4.2.01.08',  name:'Ingresos por Venta de Taquillas', type:'INCOME',    normal:'CREDIT', level:4, parent:'4.2.01',  isHeader:false },

  // Compras: SISTEMA PERIODICO.
  // El motor trabaja con inventario perpetuo (cada venta descarga su costo),
  // pero el curso enseña primero el periodico. Estas cuentas permiten
  // registrarlo a mano sin chocar con lo automatico.
  { code:'5.1.02',     name:'Compras (sistema periodico)',     type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'5.1',     isHeader:true  },
  { code:'5.1.02.01',  name:'Compras',                         type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.1.02',  isHeader:false },
  { code:'5.1.02.02',  name:'Fletes sobre Compras',            type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.1.02',  isHeader:false },
  { code:'5.1.02.03',  name:'Devoluciones sobre Compras',      type:'EXPENSE',   normal:'CREDIT', level:4, parent:'5.1.02',  isHeader:false },
  { code:'5.1.02.04',  name:'Descuentos sobre Compras',        type:'EXPENSE',   normal:'CREDIT', level:4, parent:'5.1.02',  isHeader:false },

  // Gastos administrativos que faltaban
  { code:'5.2.01.17',  name:'Gastos por Agua',                 type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.18',  name:'Reparacion y Mantenimiento de Maquinaria', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.01', isHeader:false },
  { code:'5.2.01.19',  name:'Reparacion y Mantenimiento de Equipo', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.01', isHeader:false },
  { code:'5.2.01.20',  name:'Reparacion y Mantenimiento de Edificios', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.01', isHeader:false },
  { code:'5.2.01.21',  name:'Reparacion y Mantenimiento de Equipo de Computo', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.01', isHeader:false },
  { code:'5.2.01.22',  name:'Reparacion y Mantenimiento de Vehiculos', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.01', isHeader:false },
  { code:'5.2.01.23',  name:'Gastos por Fotocopias',           type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.24',  name:'Gastos por Servicios Telefonicos', type:'EXPENSE',  normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.25',  name:'Materiales de Reparacion',        type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.26',  name:'Gastos por Licencias de Operacion', type:'EXPENSE', normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.27',  name:'Gastos por Seguros de Incendio',  type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.28',  name:'Gastos por Seguros de Vehiculos', type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.29',  name:'Gastos por Cuentas Incobrables',  type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.30',  name:'Gastos por Suministros de Oficina', type:'EXPENSE', normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },
  { code:'5.2.01.31',  name:'Gastos por Articulos de Oficina', type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.01',  isHeader:false },

  // Gasto por depreciacion, separado por activo
  { code:'5.2.03',     name:'Gastos por Depreciacion',         type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'5.2',     isHeader:true  },
  { code:'5.2.03.01',  name:'Gasto por Depreciacion de Edificios', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.03', isHeader:false },
  { code:'5.2.03.02',  name:'Gasto por Depreciacion de Maquinaria y Equipo', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.03', isHeader:false },
  { code:'5.2.03.03',  name:'Gasto por Depreciacion de Vehiculos', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.03', isHeader:false },
  { code:'5.2.03.04',  name:'Gasto por Depreciacion de Equipo de Reparto', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.03', isHeader:false },
  { code:'5.2.03.05',  name:'Gasto por Depreciacion de Mobiliario y Equipo de Oficina', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.03', isHeader:false },
  { code:'5.2.03.06',  name:'Gasto por Depreciacion de Equipo de Computo', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.03', isHeader:false },

  // Gastos de VENTAS: el plan los separa de los administrativos
  { code:'5.2.02.06',  name:'Gastos por Salarios de Ventas',   type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },
  { code:'5.2.02.07',  name:'Gastos por Electricidad - Ventas', type:'EXPENSE',  normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },
  { code:'5.2.02.08',  name:'Gastos por Agua - Ventas',        type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },
  { code:'5.2.02.09',  name:'Gastos por Combustibles - Ventas', type:'EXPENSE',  normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },
  { code:'5.2.02.10',  name:'Gastos por Alquileres - Ventas',  type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },
  { code:'5.2.02.11',  name:'Reparacion y Mantenimiento - Ventas', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.02', isHeader:false },
  { code:'5.2.02.12',  name:'Gastos por Patentes Municipales - Ventas', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.02', isHeader:false },
  { code:'5.2.02.13',  name:'Gasto por Depreciacion Mobiliario y Equipo - Ventas', type:'EXPENSE', normal:'DEBIT', level:4, parent:'5.2.02', isHeader:false },
  { code:'5.2.02.14',  name:'Gastos por Incobrables - Ventas', type:'EXPENSE',   normal:'DEBIT',  level:4, parent:'5.2.02',  isHeader:false },

  // ── 5.4 IMPUESTO SOBRE LA RENTA ──────────────────────────────────────────
  // El Estado de Resultados escalonado lo presenta DESPUES de la utilidad
  // antes de impuestos, en su propio renglon. Existia el pasivo (2.1.02.04
  // Impuesto Renta por Pagar) pero no el gasto contra el cual asentarlo, asi
  // que el ultimo escalon del estado no se podia registrar.
  { code:'5.4',        name:'Impuesto sobre la Renta',         type:'EXPENSE',   normal:'DEBIT',  level:2, parent:'5',       isHeader:true  },
  { code:'5.4.01',     name:'Impuesto sobre la Renta',         type:'EXPENSE',   normal:'DEBIT',  level:3, parent:'5.4',     isHeader:true  },
  { code:'5.4.01.01',  name:'Gasto por Impuesto sobre la Renta', type:'EXPENSE', normal:'DEBIT',  level:4, parent:'5.4.01',  isHeader:false },
];

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ── Get full chart with hierarchy ────────────────────────────
  async findAll(companyId: string) {
    return this.prisma.account.findMany({
      where:   { companyId, isActive: true },
      orderBy: { code: 'asc' },
      include: { parent: { select: { id: true, code: true, name: true } } },
    });
  }

  // ── Get one account with current balance ──────────────────────
  async findOne(companyId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, companyId },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const balance = await this.prisma.journalLine.aggregate({
      // Solo asientos CONFIRMED afectan saldos. Los PENDING (HYBRID
      // sin confirmar) y REJECTED quedan excluidos automáticamente.
      where: { accountId, companyId, entry: { status: 'CONFIRMED' } },
      _sum:  { debit: true, credit: true },
    });

    return {
      ...account,
      totalDebit:  balance._sum.debit  ?? 0,
      totalCredit: balance._sum.credit ?? 0,
      balance: (Number(balance._sum.debit ?? 0)) - (Number(balance._sum.credit ?? 0)),
    };
  }

  // ── Create custom account ─────────────────────────────────────
  async create(companyId: string, dto: CreateAccountDto) {
    const existing = await this.prisma.account.findFirst({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Ya existe una cuenta con el código "${dto.code}"`);
    }

    let level = dto.level ?? 4;
    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentId, companyId },
      });
      if (!parent) throw new NotFoundException('Cuenta padre no encontrada');
      level = parent.level + 1;
    }

    return this.prisma.account.create({
      data: {
        companyId,
        code:          dto.code,
        name:          dto.name,
        type:          dto.type,
        normalBalance: dto.normalBalance,
        parentId:      dto.parentId ?? null,
        level,
        isHeader:      dto.isHeader ?? (level < 4),
        description:   dto.description,
        altCode:       dto.altCode?.trim() || null,
        isActive:      true,
      },
    });
  }

  // ── Update account name/description ──────────────────────────
  async update(companyId: string, accountId: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, companyId },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    return this.prisma.account.update({
      where: { id: accountId },
      data: {
        name:        dto.name ?? account.name,
        description: dto.description,
        // `undefined` = no lo tocamos; cadena vacia = el profesor lo quita.
        ...(dto.altCode === undefined ? {} : { altCode: dto.altCode.trim() || null }),
      },
    });
  }

  // ── Codigos del profesor, en lote ─────────────────────────────
  //
  // Recibe { "1.1.01.04": "103", "1.1.03.01": "110", ... }: codigo del sistema
  // → codigo del plan del curso. Devuelve cuales no existen en la empresa en
  // vez de fallar entera, porque un plan suele traer cuentas que esta empresa
  // no usa. Un valor vacio borra el codigo alterno de esa cuenta.
  async setAltCodes(companyId: string, mapping: Record<string, string>, userId?: string) {
    const codes = Object.keys(mapping ?? {}).map(c => c.trim()).filter(Boolean);
    if (codes.length === 0) {
      throw new BadRequestException('No se recibio ningun codigo.');
    }

    const existing = await this.prisma.account.findMany({
      where:  { companyId, code: { in: codes } },
      select: { id: true, code: true },
    });
    const byCode = new Map(existing.map(a => [a.code, a.id]));

    let updated = 0;
    const noEncontradas: string[] = [];
    for (const code of codes) {
      const id = byCode.get(code);
      if (!id) { noEncontradas.push(code); continue; }
      await this.prisma.account.update({
        where: { id },
        data:  { altCode: String(mapping[code] ?? '').trim() || null },
      });
      updated++;
    }

    if (userId) {
      void this.activityLog.log({
        userId, companyId,
        action: 'ACCOUNT_ALT_CODES_SET', entity: 'Account',
        details: { actualizadas: updated, noEncontradas: noEncontradas.length },
      });
    }

    return { updated, notFound: noEncontradas };
  }

  // ── Seed 50-account standard chart ───────────────────────────
  async seedChartOfAccounts(companyId: string): Promise<void> {
    const count = await this.prisma.account.count({ where: { companyId } });
    if (count > 0) return; // already seeded

    const codeToId: Record<string, string> = {};

    for (const acc of CHART) {
      const parentId = acc.parent ? (codeToId[acc.parent] ?? null) : null;
      const created  = await this.prisma.account.create({
        data: {
          companyId,
          code:          acc.code,
          name:          acc.name,
          type:          acc.type,
          normalBalance: acc.normal,
          parentId,
          level:         acc.level,
          isHeader:      acc.isHeader,
          isActive:      true,
        },
      });
      codeToId[acc.code] = created.id;
    }

    // Initialize journal sequence
    await this.prisma.journalSequence.upsert({
      where:  { companyId },
      update: {},
      create: { companyId, lastNumber: 0 },
    });
  }

  // ── Find account by code (used internally) ────────────────────
  async findByCode(companyId: string, code: string) {
    return this.prisma.account.findFirst({
      where: { companyId, code },
    });
  }

  // ── Importar catálogo de cuentas desde Excel ──────────────────
  // Columnas esperadas (fila 1 = encabezados, insensible a mayúsculas/acentos):
  //   codigo | nombre | tipo | naturaleza
  // - tipo: Activo/Pasivo/Patrimonio/Ingreso/Gasto (o ASSET/LIABILITY/…)
  // - naturaleza: Debe/Deudora/DEBIT · Haber/Acreedora/CREDIT (opcional: se
  //   infiere del tipo si falta). Nivel y cuenta padre se derivan del código
  //   punteado (p.ej. 1.1.01.01 → nivel 4, padre 1.1.01). Cabecera = tiene hijos.
  async importFromExcel(companyId: string, fileBuffer: Buffer, originalName = '', userId?: string) {
    // Lectura con exceljs (ver read-spreadsheet.ts): `xlsx` tiene CVEs sin
    // parche y este buffer viene de una subida de usuario.
    const rows: unknown[][] = await readSpreadsheet(fileBuffer, originalName);
    if (!rows || rows.length < 2) {
      throw new BadRequestException('El archivo no tiene filas de datos (fila 1 = encabezados).');
    }

    const norm = (s: any) => String(s ?? '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const headers = (rows[0] as any[]).map(norm);
    const col = (...names: string[]) => headers.findIndex(h => names.includes(h));
    const iCode = col('codigo', 'cuenta', 'code');
    const iName = col('nombre', 'descripcion', 'name');
    const iType = col('tipo', 'type', 'clase');
    const iNat  = col('naturaleza', 'saldo', 'normal', 'naturalezasaldo');
    // Columna opcional con la numeracion del plan del curso ("103", "400").
    const iAlt  = col('codigoprofesor', 'codigo profesor', 'codigo alterno',
                      'codigoalterno', 'codigo curso', 'codigocurso', 'altcode');
    if (iCode < 0 || iName < 0) {
      throw new BadRequestException('Faltan columnas obligatorias: "codigo" y "nombre".');
    }

    const TYPE_MAP: Record<string, AccountType> = {
      activo: 'ASSET', activos: 'ASSET', asset: 'ASSET',
      pasivo: 'LIABILITY', pasivos: 'LIABILITY', liability: 'LIABILITY',
      patrimonio: 'EQUITY', capital: 'EQUITY', equity: 'EQUITY',
      ingreso: 'INCOME', ingresos: 'INCOME', income: 'INCOME',
      gasto: 'EXPENSE', gastos: 'EXPENSE', costo: 'EXPENSE', costos: 'EXPENSE', expense: 'EXPENSE',
    };
    const typeFromCode = (code: string): AccountType => {
      const d = code.trim()[0];
      return d === '1' ? 'ASSET' : d === '2' ? 'LIABILITY' : d === '3' ? 'EQUITY'
        : d === '4' ? 'INCOME' : 'EXPENSE';
    };
    const natFrom = (raw: any, type: AccountType): NormalBalance => {
      const n = norm(raw);
      if (['debe', 'deudora', 'deudor', 'debito', 'debit', 'd'].includes(n)) return 'DEBIT';
      if (['haber', 'acreedora', 'acreedor', 'credito', 'credit', 'h', 'c'].includes(n)) return 'CREDIT';
      return type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT';
    };

    // Parsear filas → cuentas normalizadas
    type Parsed = { code: string; name: string; type: AccountType; normal: NormalBalance; level: number; parent: string | null; alt: string | null };
    const parsed: Parsed[] = [];
    const errors: string[] = [];
    const seenCodes = new Set<string>();
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] as any[];
      const code = String(row[iCode] ?? '').trim();
      const name = String(row[iName] ?? '').trim();
      if (!code && !name) continue;
      if (!code || !name) { errors.push(`Fila ${r + 1}: código o nombre vacío.`); continue; }
      if (code.length > 20) { errors.push(`Fila ${r + 1}: código "${code}" supera 20 caracteres.`); continue; }
      if (seenCodes.has(code)) { errors.push(`Fila ${r + 1}: código "${code}" duplicado en el archivo.`); continue; }
      seenCodes.add(code);
      const type = (iType >= 0 && TYPE_MAP[norm(row[iType])]) || typeFromCode(code);
      const normal = natFrom(iNat >= 0 ? row[iNat] : '', type);
      const segs = code.split('.').filter(Boolean);
      const level = Math.min(segs.length, 4);
      const parent = segs.length > 1 ? segs.slice(0, -1).join('.') : null;
      const alt = iAlt >= 0 ? String(row[iAlt] ?? '').trim().slice(0, 20) : '';
      parsed.push({ code, name: name.slice(0, 150), type, normal, level, parent, alt: alt || null });
    }
    if (parsed.length === 0) {
      throw new BadRequestException(`No se importó ninguna cuenta válida. ${errors.slice(0, 3).join(' ')}`);
    }

    // Cabecera = alguna otra cuenta la tiene como prefijo padre
    const codeSet = new Set(parsed.map(p => p.code));
    const isHeaderOf = (code: string) => parsed.some(p => p.parent === code);

    // Cuentas ya existentes (para no chocar con @@unique(companyId, code))
    const existing = await this.prisma.account.findMany({
      where: { companyId }, select: { id: true, code: true },
    });
    const codeToId: Record<string, string> = {};
    existing.forEach(e => { codeToId[e.code] = e.id; });
    const existingCodes = new Set(existing.map(e => e.code));

    // Crear por niveles (padres primero) para resolver parentId por código.
    parsed.sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
    let created = 0, skipped = 0, altUpdated = 0;
    for (const p of parsed) {
      if (existingCodes.has(p.code)) {
        // La cuenta ya existe. Si el archivo trae codigo del profesor, ese
        // dato SI es nuevo: se aplica en vez de descartar la fila entera.
        if (p.alt && codeToId[p.code]) {
          await this.prisma.account.update({
            where: { id: codeToId[p.code] }, data: { altCode: p.alt },
          }).then(() => { altUpdated++; }).catch(() => {});
        }
        skipped++;
        continue;
      }
      const parentId = p.parent ? (codeToId[p.parent] ?? null) : null;
      try {
        const acc = await this.prisma.account.create({
          data: {
            companyId, code: p.code, name: p.name, type: p.type,
            normalBalance: p.normal, level: p.level, parentId,
            isHeader: isHeaderOf(p.code) || p.level < 4,
            altCode: p.alt,
            isActive: true,
          },
        });
        codeToId[p.code] = acc.id;
        existingCodes.add(p.code);
        created++;
      } catch {
        skipped++;
        errors.push(`No se pudo crear "${p.code} — ${p.name}".`);
      }
    }

    // Asegurar secuencia de asientos (por si es una empresa recién creada).
    await this.prisma.journalSequence.upsert({
      where: { companyId }, update: {}, create: { companyId, lastNumber: 0 },
    });

    // Cargar un catálogo altera la estructura contra la que se asienta todo:
    // queda registrado quién lo hizo y con qué archivo.
    if (userId) {
      void this.activityLog.log({
        userId, companyId,
        action: 'CHART_OF_ACCOUNTS_IMPORTED', entity: 'Account',
        details: {
          archivo: originalName || 'sin nombre',
          creadas: created, omitidas: skipped, filas: parsed.length,
          errores: errors.length, codigosProfesor: altUpdated,
        },
      });
    }

    return { created, skipped, altUpdated, total: parsed.length, errors: errors.slice(0, 20) };
  }
}
