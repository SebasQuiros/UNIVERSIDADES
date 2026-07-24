import {
  Injectable, BadRequestException,
  NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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
];

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

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
      data:  { name: dto.name ?? account.name, description: dto.description },
    });
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
}
