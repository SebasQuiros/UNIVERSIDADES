import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { ActivityLogService } from '../../common/activity/activity-log.service';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';
import { JournalSource } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateTransferDto } from './dto/transfers.dto';

/** Cuenta de banco/caja que mueve el dinero en ambos lados. */
const BANCO = '1.1.01.02';   // Banco Nacional de CR (₡)

/**
 * Asientos por concepto. Mover dinero entre dos empresas NO tiene un asiento
 * único "correcto": depende de QUÉ representa el movimiento. Por eso el
 * concepto es obligatorio y de él se derivan las contrapartidas.
 *
 *   PRESTAMO   → el que envía adquiere un derecho de cobro; el que recibe, deuda.
 *   PAGO_DEUDA → cancela una cuenta por pagar en quien paga y una por cobrar en
 *                quien cobra (el caso típico tras una compra a crédito).
 *   ANTICIPO   → pago por adelantado: anticipo a proveedor / anticipo de cliente.
 */
const CONCEPTS = {
  PRESTAMO: {
    label: 'Préstamo entre empresas',
    from: { counter: '1.1.02.02', desc: 'Préstamo otorgado (documento por cobrar)' },
    to:   { counter: '2.1.01.02', desc: 'Préstamo recibido (documento por pagar)' },
  },
  PAGO_DEUDA: {
    label: 'Pago de deuda',
    from: { counter: '2.1.01.01', desc: 'Pago a proveedor' },
    to:   { counter: '1.1.02.01', desc: 'Cobro a cliente' },
  },
  ANTICIPO: {
    label: 'Anticipo',
    from: { counter: '1.1.06.01', desc: 'Anticipo entregado a proveedor' },
    to:   { counter: '2.1.01.03', desc: 'Anticipo recibido de cliente' },
  },
} as const;

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Transfiere dinero de una empresa a otra generando el asiento en AMBAS,
   * dentro de una única transacción: o se registran los dos lados o ninguno.
   */
  async create(userId: string, dto: CreateTransferDto) {
    if (dto.fromCompanyId === dto.toCompanyId) {
      throw new BadRequestException('El origen y el destino no pueden ser la misma empresa.');
    }
    const amount = new Decimal(dto.amount.toString());
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('El monto debe ser mayor a cero.');
    }
    const cfg = CONCEPTS[dto.concept];
    if (!cfg) throw new BadRequestException('Concepto de transferencia inválido.');

    // Solo un integrante de la empresa que ENVÍA puede ordenar la salida de dinero.
    await assertCompanyAccess(this.prisma, dto.fromCompanyId, userId);

    const [from, to] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: dto.fromCompanyId }, select: { id: true, name: true, exerciseId: true } }),
      this.prisma.company.findUnique({ where: { id: dto.toCompanyId },   select: { id: true, name: true, exerciseId: true } }),
    ]);
    if (!from) throw new NotFoundException('Empresa de origen no encontrada.');
    if (!to)   throw new NotFoundException('Empresa de destino no encontrada.');

    // Aislamiento: ambas deben pertenecer al MISMO ejercicio (mismo mercado).
    // Sin esto se podría mover dinero hacia la empresa de otra institución.
    if (!from.exerciseId || from.exerciseId !== to.exerciseId) {
      throw new ForbiddenException('Solo se puede transferir entre empresas del mismo ejercicio.');
    }

    const date = dto.date ? new Date(dto.date) : new Date();
    const note = dto.note?.slice(0, 200) || cfg.label;

    const transfer = await this.prisma.$transaction(async (tx) => {
      // Lado que ENVÍA: sale dinero del banco (credit), contrapartida según concepto.
      const fromEntry = await this.journal.createAutoEntry(
        from.id,
        `${cfg.label} → ${to.name}: ${note}`,
        date,
        [
          { accountCode: cfg.from.counter, debit: amount.toNumber(), credit: 0, description: cfg.from.desc },
          { accountCode: BANCO,            debit: 0, credit: amount.toNumber(), description: `Transferencia a ${to.name}` },
        ],
        userId, JournalSource.MANUAL, tx,
        undefined, undefined, 'COMPANY_TRANSFER_OUT', undefined,
      );

      // Lado que RECIBE: entra dinero al banco (debit), contrapartida según concepto.
      const toEntry = await this.journal.createAutoEntry(
        to.id,
        `${cfg.label} ← ${from.name}: ${note}`,
        date,
        [
          { accountCode: BANCO,          debit: amount.toNumber(), credit: 0, description: `Transferencia de ${from.name}` },
          { accountCode: cfg.to.counter, debit: 0, credit: amount.toNumber(), description: cfg.to.desc },
        ],
        userId, JournalSource.MANUAL, tx,
        undefined, undefined, 'COMPANY_TRANSFER_IN', undefined,
      );

      return tx.companyTransfer.create({
        data: {
          classSessionId: dto.classSessionId ?? null,
          fromCompanyId:  from.id,
          toCompanyId:    to.id,
          amount,
          concept:        dto.concept as any,
          note,
          fromEntryId:    (fromEntry as any)?.id ?? null,
          toEntryId:      (toEntry as any)?.id ?? null,
          createdById:    userId,
        },
      });
    });

    void this.activityLog.log({
      userId, companyId: from.id,
      action: 'TRANSFER_SENT', entity: 'CompanyTransfer', entityId: transfer.id,
      details: { destino: to.name, concepto: cfg.label, monto: amount.toFixed(2) },
    });
    void this.activityLog.log({
      userId, companyId: to.id,
      action: 'TRANSFER_RECEIVED', entity: 'CompanyTransfer', entityId: transfer.id,
      details: { origen: from.name, concepto: cfg.label, monto: amount.toFixed(2) },
    });

    return { ...transfer, fromName: from.name, toName: to.name, conceptLabel: cfg.label };
  }

  /** Transferencias de una empresa (enviadas y recibidas). */
  async listForCompany(companyId: string, userId: string) {
    await assertCompanyAccess(this.prisma, companyId, userId);
    const rows = await this.prisma.companyTransfer.findMany({
      where:   { OR: [{ fromCompanyId: companyId }, { toCompanyId: companyId }] },
      orderBy: { createdAt: 'desc' },
      take:    100,
    });
    const ids = Array.from(new Set(rows.flatMap((r) => [r.fromCompanyId, r.toCompanyId])));
    const names = new Map(
      (await this.prisma.company.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }))
        .map((c) => [c.id, c.name]),
    );
    return rows.map((r) => ({
      ...r,
      fromName:     names.get(r.fromCompanyId) ?? '—',
      toName:       names.get(r.toCompanyId) ?? '—',
      direction:    r.fromCompanyId === companyId ? 'OUT' : 'IN',
      conceptLabel: (CONCEPTS as any)[r.concept]?.label ?? r.concept,
    }));
  }

  /** Catálogo de conceptos para la UI. */
  concepts() {
    return Object.entries(CONCEPTS).map(([key, c]) => ({
      key, label: c.label,
      envia:  c.from.desc,
      recibe: c.to.desc,
    }));
  }
}
