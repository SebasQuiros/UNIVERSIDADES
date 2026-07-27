import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNegotiationDto, PostEntryDto } from './dto/negotiations.dto';

/**
 * Motor de negociación empresarial (spec Multiempresa cap. 6).
 * RFQ → oferta → contraoferta → chat → aceptar/rechazar entre dos empresas.
 * Aceptar registra los términos acordados; NO postea contabilidad (se engancha
 * aparte con el flujo de compras).
 */
@Injectable()
export class NegotiationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async isStaff(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return u?.role === 'TEACHER' || u?.role === 'ADMIN' || u?.role === 'SUPERADMIN';
  }

  private async isMember(companyId: string, userId: string): Promise<boolean> {
    const m = await this.prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { id: true },
    });
    if (m) return true;
    // Empresa individual (por si se usa fuera de sesión): dueño del intento.
    const c = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { attempt: { select: { studentId: true } } },
    });
    return c?.attempt?.studentId === userId;
  }

  /** Devuelve el lado del usuario en la negociación ('buyer'/'seller') o null. */
  private async sideOf(neg: { buyerCompanyId: string; sellerCompanyId: string }, userId: string) {
    if (await this.isMember(neg.buyerCompanyId, userId)) return 'buyer' as const;
    if (await this.isMember(neg.sellerCompanyId, userId)) return 'seller' as const;
    return null;
  }

  private async companyNames(ids: string[]) {
    const cs = await this.prisma.company.findMany({
      where: { id: { in: ids } }, select: { id: true, name: true },
    });
    return new Map(cs.map((c) => [c.id, c.name]));
  }

  async create(userId: string, dto: CreateNegotiationDto) {
    if (dto.buyerCompanyId === dto.sellerCompanyId) {
      throw new BadRequestException('No puedes negociar con tu propia empresa.');
    }
    if (!(await this.isMember(dto.buyerCompanyId, userId))) {
      throw new ForbiddenException('Solo un integrante de la empresa compradora puede iniciar la negociación.');
    }
    const seller = await this.prisma.company.findUnique({ where: { id: dto.sellerCompanyId }, select: { id: true } });
    if (!seller) throw new NotFoundException('La empresa vendedora no existe.');

    const hasOffer = dto.qty != null && dto.unitPrice != null;
    return this.prisma.negotiation.create({
      data: {
        classSessionId:  dto.classSessionId ?? null,
        buyerCompanyId:  dto.buyerCompanyId,
        sellerCompanyId: dto.sellerCompanyId,
        subject:         dto.subject.trim().slice(0, 200),
        status:          hasOffer ? 'CONTRAOFERTA' : 'ABIERTA',
        createdById:     userId,
        entries: {
          create: {
            authorId:        userId,
            authorCompanyId: dto.buyerCompanyId,
            kind:            hasOffer ? 'OFERTA' : 'MENSAJE',
            message:         dto.message?.slice(0, 2000) || null,
            qty:             dto.qty ?? null,
            unitPrice:       dto.unitPrice ?? null,
          },
        },
      },
    });
  }

  async listForUser(userId: string, classSessionId?: string) {
    // Empresas del usuario (miembro).
    const memberships = await this.prisma.companyMembership.findMany({
      where: { userId }, select: { companyId: true },
    });
    const myCompanyIds = memberships.map((m) => m.companyId);
    const staff = await this.isStaff(userId);

    const negs = await this.prisma.negotiation.findMany({
      where: {
        ...(classSessionId ? { classSessionId } : {}),
        ...(staff ? {} : {
          OR: [
            { buyerCompanyId:  { in: myCompanyIds } },
            { sellerCompanyId: { in: myCompanyIds } },
          ],
        }),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    const names = await this.companyNames(
      Array.from(new Set(negs.flatMap((n) => [n.buyerCompanyId, n.sellerCompanyId]))),
    );
    return negs.map((n) => ({
      ...n,
      buyerName:  names.get(n.buyerCompanyId) ?? '—',
      sellerName: names.get(n.sellerCompanyId) ?? '—',
      mySide: myCompanyIds.includes(n.buyerCompanyId) ? 'buyer'
            : myCompanyIds.includes(n.sellerCompanyId) ? 'seller' : null,
    }));
  }

  async getOne(id: string, userId: string) {
    const neg = await this.prisma.negotiation.findUnique({
      where: { id },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    if (!neg) throw new NotFoundException('Negociación no encontrada.');
    const side = await this.sideOf(neg, userId);
    if (!side && !(await this.isStaff(userId))) {
      throw new ForbiddenException('No participas en esta negociación.');
    }
    const names = await this.companyNames([neg.buyerCompanyId, neg.sellerCompanyId]);
    return {
      ...neg,
      buyerName:  names.get(neg.buyerCompanyId) ?? '—',
      sellerName: names.get(neg.sellerCompanyId) ?? '—',
      mySide: side,
    };
  }

  async postEntry(id: string, userId: string, dto: PostEntryDto) {
    const neg = await this.prisma.negotiation.findUnique({ where: { id } });
    if (!neg) throw new NotFoundException('Negociación no encontrada.');
    if (['ACEPTADA', 'RECHAZADA', 'CANCELADA'].includes(neg.status)) {
      throw new BadRequestException('La negociación ya está cerrada.');
    }
    const side = await this.sideOf(neg, userId);
    if (!side) throw new ForbiddenException('No participas en esta negociación.');

    if (dto.kind === 'OFERTA' && (dto.qty == null || dto.unitPrice == null)) {
      throw new BadRequestException('Una oferta necesita cantidad y precio unitario.');
    }
    const authorCompanyId = side === 'buyer' ? neg.buyerCompanyId : neg.sellerCompanyId;

    await this.prisma.negotiationEntry.create({
      data: {
        negotiationId:   id,
        authorId:        userId,
        authorCompanyId,
        kind:            dto.kind,
        message:         dto.message?.slice(0, 2000) || null,
        qty:             dto.kind === 'OFERTA' ? dto.qty ?? null : null,
        unitPrice:       dto.kind === 'OFERTA' ? dto.unitPrice ?? null : null,
      },
    });
    await this.prisma.negotiation.update({
      where: { id },
      data:  { status: dto.kind === 'OFERTA' ? 'CONTRAOFERTA' : neg.status, updatedAt: new Date() },
    });
    return this.getOne(id, userId);
  }

  async accept(id: string, userId: string) {
    const neg = await this.prisma.negotiation.findUnique({
      where: { id },
      include: { entries: { where: { kind: 'OFERTA' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!neg) throw new NotFoundException('Negociación no encontrada.');
    if (neg.status !== 'CONTRAOFERTA') {
      throw new BadRequestException('No hay una oferta vigente para aceptar.');
    }
    const side = await this.sideOf(neg, userId);
    if (!side) throw new ForbiddenException('No participas en esta negociación.');

    const lastOffer = neg.entries[0];
    if (!lastOffer) throw new BadRequestException('No hay oferta que aceptar.');
    // Solo puede aceptar la contraparte de quien hizo la última oferta.
    const offerSide = lastOffer.authorCompanyId === neg.buyerCompanyId ? 'buyer' : 'seller';
    if (offerSide === side) {
      throw new BadRequestException('La oferta la debe aceptar la otra parte, no quien la propuso.');
    }

    await this.prisma.negotiationEntry.create({
      data: {
        negotiationId: id, authorId: userId,
        authorCompanyId: side === 'buyer' ? neg.buyerCompanyId : neg.sellerCompanyId,
        kind: 'SISTEMA',
        message: `Trato aceptado: ${lastOffer.qty} unidades a ₡${Number(lastOffer.unitPrice).toLocaleString('es-CR')} c/u.`,
      },
    });
    await this.prisma.negotiation.update({
      where: { id },
      data: { status: 'ACEPTADA', agreedQty: lastOffer.qty, agreedUnitPrice: lastOffer.unitPrice, updatedAt: new Date() },
    });
    return this.getOne(id, userId);
  }

  async close(id: string, userId: string, status: 'RECHAZADA' | 'CANCELADA') {
    const neg = await this.prisma.negotiation.findUnique({ where: { id } });
    if (!neg) throw new NotFoundException('Negociación no encontrada.');
    if (['ACEPTADA', 'RECHAZADA', 'CANCELADA'].includes(neg.status)) {
      throw new BadRequestException('La negociación ya está cerrada.');
    }
    const side = await this.sideOf(neg, userId);
    if (!side) throw new ForbiddenException('No participas en esta negociación.');
    await this.prisma.negotiationEntry.create({
      data: {
        negotiationId: id, authorId: userId,
        authorCompanyId: side === 'buyer' ? neg.buyerCompanyId : neg.sellerCompanyId,
        kind: 'SISTEMA',
        message: status === 'RECHAZADA' ? 'Negociación rechazada.' : 'Negociación cancelada.',
      },
    });
    await this.prisma.negotiation.update({ where: { id }, data: { status, updatedAt: new Date() } });
    return this.getOne(id, userId);
  }
}
