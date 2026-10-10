import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBankTransactionDto, UpdateBankTransactionDto, BulkImportDto } from './dto/bank.dto';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { JournalService } from '../journal/journal.service';
import { JournalSource } from '@prisma/client';
import { ACCOUNT_CODES } from '../accounting/constants/account-codes';

@Injectable()
export class BankService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
    private readonly journal: JournalService,
  ) {}

  // Fase 1: delegamos al helper que soporta INDIVIDUAL + GROUP.
  // Pasamos `redis` para reusar el core cacheado por el guard (fail-open a DB).
  private async _verifyCompany(companyId: string, userId: string) {
    return assertCompanyAccess(this.prisma, companyId, userId, { redis: this.redis });
  }

  async findAll(companyId: string, userId: string) {
    await this._verifyCompany(companyId, userId);
    return this.prisma.bankTransaction.findMany({
      where: { companyId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Registra un movimiento de banco Y su asiento contable.
   *
   * Antes solo guardaba la fila: lo que se anotaba en Bancos no existia para
   * la contabilidad, ni la contabilidad alimentaba este libro. El modulo era
   * una isla — el estudiante creia que habia registrado algo y no habia
   * registrado nada.
   *
   * Ahora se pide la contrapartida, porque un deposito no dice de donde
   * salio, y con ella el asiento se arma solo:
   *
   *   CREDIT (entra plata)  →  D Banco  / C contrapartida
   *   DEBIT  (sale plata)   →  D contrapartida / C Banco
   */
  async create(companyId: string, userId: string, dto: CreateBankTransactionDto) {
    await this._verifyCompany(companyId, userId);

    if (!dto.counterAccountCode) {
      throw new BadRequestException(
        'Indicá contra qué cuenta se registra este movimiento. ' +
        'Un depósito o un retiro siempre tienen una contrapartida: ' +
        'de dónde entró la plata o en qué se gastó.',
      );
    }
    if (dto.counterAccountCode === ACCOUNT_CODES.BANK) {
      throw new BadRequestException(
        'La contrapartida no puede ser la misma cuenta bancaria: el asiento no diría nada.',
      );
    }
    if (!(Number(dto.amount) > 0)) {
      throw new BadRequestException('El monto debe ser mayor a cero.');
    }

    const entra = dto.type === 'CREDIT';
    const monto = Number(dto.amount);
    const fecha = new Date(dto.date);

    return this.prisma.$transaction(async (tx) => {
      const mov = await tx.bankTransaction.create({
        data: {
          companyId,
          date:        fecha,
          description: dto.description,
          amount:      monto,
          type:        dto.type,
          reference:   dto.reference,
          source:      'MANUAL',
        },
      });

      // El asiento va DENTRO de la misma transacción: o quedan los dos o no
      // queda ninguno. Un movimiento de banco sin asiento es justo el
      // problema que se está corrigiendo.
      await this.journal.createAutoEntry(
        companyId,
        `Banco — ${dto.description}`,
        fecha,
        [
          {
            accountCode: entra ? ACCOUNT_CODES.BANK : dto.counterAccountCode!,
            debit:  monto,
            credit: 0,
            description: dto.description,
          },
          {
            accountCode: entra ? dto.counterAccountCode! : ACCOUNT_CODES.BANK,
            debit:  0,
            credit: monto,
            description: dto.description,
          },
        ],
        userId,
        JournalSource.MANUAL,
        tx,
        undefined,
        undefined,
        'bank_transaction',
        mov.id,
        false,
      );

      return mov;
    });
  }

  async update(companyId: string, id: string, userId: string, dto: UpdateBankTransactionDto) {
    await this._verifyCompany(companyId, userId);
    const tx = await this.prisma.bankTransaction.findFirst({ where: { id, companyId } });
    if (!tx) throw new NotFoundException('Movimiento no encontrado');
    return this.prisma.bankTransaction.update({
      where: { id },
      data: { ...(dto.isReconciled !== undefined && { isReconciled: dto.isReconciled }), ...(dto.reference !== undefined && { reference: dto.reference }) },
    });
  }

  async remove(companyId: string, id: string, userId: string) {
    await this._verifyCompany(companyId, userId);
    const tx = await this.prisma.bankTransaction.findFirst({ where: { id, companyId } });
    if (!tx) throw new NotFoundException('Movimiento no encontrado');
    await this.prisma.bankTransaction.delete({ where: { id } });
    return { message: 'Eliminado' };
  }

  /**
   * Importa un extracto bancario.
   *
   * Estas lineas NO generan asiento, y es correcto: un extracto es lo que
   * dice el banco, no lo que la empresa registro. El ejercicio de
   * conciliacion consiste justamente en cruzar ambos lados y explicar las
   * diferencias; asentarlo automaticamente le quitaria todo el sentido.
   *
   * Por eso van marcadas como IMPORT y no como MANUAL: un movimiento manual
   * si queda asentado, y confundirlos haria imposible saber cual esta en los
   * libros y cual no.
   */
  async importBulk(companyId: string, userId: string, dto: BulkImportDto) {
    await this._verifyCompany(companyId, userId);
    const rows = await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.bankTransaction.create({
          data: {
            companyId,
            date:        new Date(item.date),
            description: item.description,
            amount:      item.amount,
            type:        item.type,
            reference:   item.reference ?? null,
            source:      'IMPORT',
          },
        }),
      ),
    );
    return { count: rows.length, message: `${rows.length} movimientos importados del extracto` };
  }

  async summary(companyId: string, userId: string) {
    await this._verifyCompany(companyId, userId);
    const txs = await this.prisma.bankTransaction.findMany({ where: { companyId } });
    const credits = txs.filter((t: any) => t.type === 'CREDIT').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const debits  = txs.filter((t: any) => t.type === 'DEBIT').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const reconciled = txs.filter((t: any) => t.isReconciled).length;
    return { credits, debits, balance: credits - debits, total: txs.length, reconciled, pending: txs.length - reconciled };
  }
}
