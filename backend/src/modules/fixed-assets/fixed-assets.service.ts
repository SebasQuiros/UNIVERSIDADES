import { Injectable, Inject, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, JournalSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFixedAssetDto } from './dto/fixed-assets.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { JournalService } from '../journal/journal.service';
import { ACCOUNT_CODES } from '../accounting/constants/account-codes';

@Injectable()
export class FixedAssetsService {
  private readonly logger = new Logger(FixedAssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
    private readonly journal: JournalService,
  ) {}

  /** Idempotente: asegura que exista una cuenta postable (nivel 4) bajo su header. */
  private async ensureAccount(
    tx: Prisma.TransactionClient,
    companyId: string,
    code: string,
    name: string,
    type: 'ASSET' | 'EXPENSE',
    normal: 'DEBIT' | 'CREDIT',
    parentCode: string,
  ) {
    const existing = await tx.account.findFirst({ where: { companyId, code } });
    if (existing) return existing;
    const parent = await tx.account.findFirst({ where: { companyId, code: parentCode } });
    if (!parent) {
      // El header (5.2.01 / 1.2.02) es parte del catálogo base; si falta, el
      // chart está incompleto. Fail-fast en vez de crear una cuenta huérfana.
      throw new NotFoundException(
        `No se puede crear la cuenta ${code}: falta la cuenta padre ${parentCode} en el catálogo.`,
      );
    }
    return tx.account.create({
      data: {
        companyId, code, name, type, normalBalance: normal,
        parentId: parent?.id ?? null, level: 4, isHeader: false, isActive: true,
      },
    });
  }

  // Fase 1: helper centralizado, soporta INDIVIDUAL + GROUP.
  // Pasamos `redis` para reusar el core cacheado por el guard (fail-open a DB).
  private async verifyOwner(companyId: string, userId: string) {
    await assertCompanyAccess(this.prisma, companyId, userId, { redis: this.redis });
  }

  async findAll(companyId: string, userId: string) {
    await this.verifyOwner(companyId, userId);
    return this.prisma.fixedAsset.findMany({
      where: { companyId, isActive: true },
      include: { depreciationRecords: { orderBy: { period: 'desc' }, take: 12 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, dto: CreateFixedAssetDto, userId?: string) {
    if (userId) await this.verifyOwner(companyId, userId);
    const bookValue = new Decimal(dto.acquisitionCost);
    return this.prisma.fixedAsset.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description ?? null,
        acquisitionDate: new Date(dto.acquisitionDate),
        acquisitionCost: new Decimal(dto.acquisitionCost),
        salvageValue: new Decimal(dto.salvageValue ?? 0),
        usefulLifeYears: dto.usefulLifeYears,
        depreciationMethod: (dto.depreciationMethod as any) ?? 'STRAIGHT_LINE',
        accumulatedDeprec: new Decimal(0),
        bookValue,
      },
    });
  }

  async depreciate(companyId: string, assetId: string, period: string, userId?: string) {
    if (userId) await this.verifyOwner(companyId, userId);
    const asset = await this.prisma.fixedAsset.findFirst({ where: { id: assetId, companyId } });
    if (!asset) throw new NotFoundException('Activo no encontrado');

    const cost = Number(asset.acquisitionCost);
    const salvage = Number(asset.salvageValue);
    const life = asset.usefulLifeYears;
    const accumulated = Number(asset.accumulatedDeprec);

    let monthlyDeprec = 0;
    if (asset.depreciationMethod === 'STRAIGHT_LINE') {
      monthlyDeprec = (cost - salvage) / (life * 12);
    } else if (asset.depreciationMethod === 'DOUBLE_DECLINING') {
      const rate = (2 / life) / 12;
      monthlyDeprec = Number(asset.bookValue) * rate;
    } else {
      monthlyDeprec = (cost - salvage) / (life * 12);
    }

    const newAccumulated = Math.min(accumulated + monthlyDeprec, cost - salvage);
    const newBookValue = cost - newAccumulated;
    const amount = Number(monthlyDeprec.toFixed(2));

    // Fecha contable = primer día del período (YYYY-MM); fallback: hoy.
    const m = /^(\d{4})-(\d{2})/.exec(period);
    const entryDate = m ? new Date(`${m[1]}-${m[2]}-01T00:00:00`) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.depreciationRecord.create({
        data: {
          assetId,
          companyId,
          period,
          amount: new Decimal(amount.toFixed(2)),
          bookValueAfter: new Decimal(newBookValue.toFixed(2)),
        },
      });

      await tx.fixedAsset.update({
        where: { id: assetId },
        data: {
          accumulatedDeprec: new Decimal(newAccumulated.toFixed(2)),
          bookValue: new Decimal(newBookValue.toFixed(2)),
        },
      });

      // I-AT-4 (Accounting Manifest): la depreciación ahora SÍ genera su asiento
      //   D  Gasto por Depreciación
      //   C  Depreciación Acumulada (contra-activo)
      // vía el escritor único (createAutoEntry) → trazable e invariante-safe.
      // Graceful: si no hay cuota (>0), período abierto o usuario, se omite el
      // asiento (se registra la depreciación igual) — additivo, sin regresión.
      if (amount > 0) {
        const company = await tx.company.findUnique({ where: { id: companyId }, select: { studentId: true } });
        const createdById = userId ?? company?.studentId ?? null;
        const openPeriod = await tx.accountingPeriod.findFirst({
          where: { companyId, startDate: { lte: entryDate }, endDate: { gte: entryDate }, status: 'OPEN' },
        });

        if (createdById && openPeriod) {
          await this.ensureAccount(tx, companyId, ACCOUNT_CODES.DEPRECIATION_EXPENSE, 'Gasto por Depreciación', 'EXPENSE', 'DEBIT', '5.2.01');
          await this.ensureAccount(tx, companyId, ACCOUNT_CODES.ACCUMULATED_DEPRECIATION, 'Depreciación Acumulada — General', 'ASSET', 'CREDIT', '1.2.02');

          const entry = await this.journal.createAutoEntry(
            companyId,
            `Depreciación — ${asset.name} (${period})`,
            entryDate,
            [
              { accountCode: ACCOUNT_CODES.DEPRECIATION_EXPENSE, debit: amount, credit: 0, description: `Depreciación ${asset.name}` },
              { accountCode: ACCOUNT_CODES.ACCUMULATED_DEPRECIATION, debit: 0, credit: amount, description: `Dep. acumulada ${asset.name}` },
            ],
            createdById,
            JournalSource.ADJUSTMENT,
            tx,
            undefined,
            undefined,
            'depreciation',
            `${assetId}:${period}`,   // idempotente por activo+período (record ya es único)
            false,
          );
          await tx.depreciationRecord.update({ where: { id: record.id }, data: { journalEntryId: entry.id } });
        } else {
          this.logger.warn(
            `Depreciación de activo ${assetId} (${period}): sin período contable abierto o sin usuario; ` +
            `se registró la depreciación sin asiento contable.`,
          );
        }
      }

      return record;
    });
  }

  async getSummary(companyId: string, userId?: string) {
    if (userId) await this.verifyOwner(companyId, userId);
    const assets = await this.prisma.fixedAsset.findMany({
      where: { companyId, isActive: true },
      select: { acquisitionCost: true, accumulatedDeprec: true, bookValue: true },
    });
    return {
      totalCost: assets.reduce((s, a) => s + Number(a.acquisitionCost), 0),
      totalAccumulatedDeprec: assets.reduce((s, a) => s + Number(a.accumulatedDeprec), 0),
      totalBookValue: assets.reduce((s, a) => s + Number(a.bookValue), 0),
      count: assets.length,
    };
  }
}
