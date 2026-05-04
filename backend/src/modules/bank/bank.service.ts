import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBankTransactionDto, UpdateBankTransactionDto, BulkImportDto } from './dto/bank.dto';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';

@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaService) {}

  // Fase 1: delegamos al helper que soporta INDIVIDUAL + GROUP.
  private async _verifyCompany(companyId: string, userId: string) {
    return assertCompanyAccess(this.prisma, companyId, userId);
  }

  async findAll(companyId: string, userId: string) {
    await this._verifyCompany(companyId, userId);
    return this.prisma.bankTransaction.findMany({
      where: { companyId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(companyId: string, userId: string, dto: CreateBankTransactionDto) {
    await this._verifyCompany(companyId, userId);
    return this.prisma.bankTransaction.create({
      data: {
        companyId,
        date:        new Date(dto.date),
        description: dto.description,
        amount:      dto.amount,
        type:        dto.type,
        reference:   dto.reference,
      },
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
          },
        }),
      ),
    );
    return { count: rows.length, message: `${rows.length} movimientos importados` };
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
