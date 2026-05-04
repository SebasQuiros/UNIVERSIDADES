import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFixedAssetDto } from './dto/fixed-assets.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';

@Injectable()
export class FixedAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  // Fase 1: helper centralizado, soporta INDIVIDUAL + GROUP.
  private async verifyOwner(companyId: string, userId: string) {
    await assertCompanyAccess(this.prisma, companyId, userId);
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

    const [record] = await this.prisma.$transaction([
      this.prisma.depreciationRecord.create({
        data: {
          assetId,
          companyId,
          period,
          amount: new Decimal(monthlyDeprec.toFixed(2)),
          bookValueAfter: new Decimal(newBookValue.toFixed(2)),
        },
      }),
      this.prisma.fixedAsset.update({
        where: { id: assetId },
        data: {
          accumulatedDeprec: new Decimal(newAccumulated.toFixed(2)),
          bookValue: new Decimal(newBookValue.toFixed(2)),
        },
      }),
    ]);

    return record;
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
