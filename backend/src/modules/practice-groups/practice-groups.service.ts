import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto, JoinGroupDto } from './dto/practice-groups.dto';

/**
 * PracticeGroupsService — "Multiempresa en modo práctica" (Espacio Contador).
 *
 * Los estudiantes forman un grupo; sus empresas de PRÁCTICA (Company.isPractice)
 * se unen y pueden comerciar entre sí reutilizando la máquina de estados de
 * ProcurementOrder (con practiceGroupId en vez de exerciseId).
 *
 * Es práctica libre (sin ejercicio, sin nota).
 */
@Injectable()
export class PracticeGroupsService {
  private readonly logger = new Logger(PracticeGroupsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Verifica que el usuario sea dueño de una empresa de PRÁCTICA (companyId). */
  private async assertOwnsPracticeCompany(userId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where:  { id: companyId, studentId: userId, isPractice: true },
      select: { id: true },
    });
    if (!company) {
      throw new ForbiddenException('No eres dueño de esta empresa de práctica.');
    }
  }

  /** Genera un código corto único (6 alfanuméricos en mayúscula). */
  private async generateUniqueCode(): Promise<string> {
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      }
      const clash = await this.prisma.practiceGroup.findUnique({
        where:  { code },
        select: { id: true },
      });
      if (!clash) return code;
    }
    throw new Error('No se pudo generar un código único para el grupo de práctica.');
  }

  /** Enriquece una lista de members con name/legalId de su empresa. */
  private async withCompanyInfo(
    members: Array<{ companyId: string; [k: string]: any }>,
  ) {
    const companyIds = Array.from(new Set(members.map((m) => m.companyId)));
    const companies = companyIds.length
      ? await this.prisma.company.findMany({
          where:  { id: { in: companyIds } },
          select: { id: true, name: true, legalId: true },
        })
      : [];
    const byId = new Map(companies.map((c) => [c.id, c]));
    return members.map((m) => {
      const c = byId.get(m.companyId);
      return {
        ...m,
        companyName:    c?.name ?? null,
        companyLegalId: c?.legalId ?? null,
      };
    });
  }

  // ── createGroup ─────────────────────────────────────────────────────────────
  async createGroup(userId: string, dto: CreateGroupDto) {
    await this.assertOwnsPracticeCompany(userId, dto.companyId);

    const code = await this.generateUniqueCode();

    const group = await this.prisma.practiceGroup.create({
      data: {
        name:        dto.name,
        code,
        createdById: userId,
        members: {
          create: {
            companyId: dto.companyId,
            studentId: userId,
          },
        },
      },
      include: { members: true },
    });

    this.logger.log(`Grupo de práctica ${group.id} creado por ${userId} (code ${code}).`);

    return {
      ...group,
      members: await this.withCompanyInfo(group.members),
    };
  }

  // ── joinGroup ───────────────────────────────────────────────────────────────
  async joinGroup(userId: string, dto: JoinGroupDto) {
    await this.assertOwnsPracticeCompany(userId, dto.companyId);

    const group = await this.prisma.practiceGroup.findUnique({
      where: { code: dto.code },
    });
    if (!group) throw new NotFoundException('Grupo de práctica no encontrado.');

    // Alta idempotente: si ya es miembro (unique groupId+companyId), no falla.
    try {
      await this.prisma.practiceGroupMember.create({
        data: {
          groupId:   group.id,
          companyId: dto.companyId,
          studentId: userId,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Ya era miembro → idempotente, seguimos y devolvemos el grupo.
      } else {
        throw e;
      }
    }

    return this.getGroup(userId, group.id);
  }

  // ── listMine ────────────────────────────────────────────────────────────────
  async listMine(userId: string) {
    const groups = await this.prisma.practiceGroup.findMany({
      where:   { members: { some: { studentId: userId } } },
      include: { members: true },
      orderBy: { createdAt: 'desc' },
    });

    // Enriquecer todos los members de todos los grupos con una sola query.
    const allMembers = groups.flatMap((g) => g.members);
    const enrichedList = await this.withCompanyInfo(allMembers);
    const enrichedById = new Map(enrichedList.map((m) => [m.id, m]));

    return groups.map((g) => ({
      ...g,
      members: g.members.map((m) => enrichedById.get(m.id) ?? m),
    }));
  }

  // ── getGroup ────────────────────────────────────────────────────────────────
  async getGroup(userId: string, groupId: string) {
    const group = await this.prisma.practiceGroup.findUnique({
      where:   { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Grupo de práctica no encontrado.');

    // Autorización: el usuario debe tener una empresa miembro en el grupo.
    const isMember = group.members.some((m) => m.studentId === userId);
    if (!isMember) {
      throw new ForbiddenException('No perteneces a este grupo de práctica.');
    }

    return {
      ...group,
      members: await this.withCompanyInfo(group.members),
    };
  }

  // ── groupMemberCompanies ────────────────────────────────────────────────────
  // Empresas del grupo (id, name, legalId) — para que el comprador elija vendedor.
  async groupMemberCompanies(userId: string, groupId: string) {
    const group = await this.prisma.practiceGroup.findUnique({
      where:   { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Grupo de práctica no encontrado.');

    const isMember = group.members.some((m) => m.studentId === userId);
    if (!isMember) {
      throw new ForbiddenException('No perteneces a este grupo de práctica.');
    }

    const companyIds = Array.from(new Set(group.members.map((m) => m.companyId)));
    if (companyIds.length === 0) return [];

    return this.prisma.company.findMany({
      where:   { id: { in: companyIds } },
      select:  { id: true, name: true, legalId: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── leaveGroup ──────────────────────────────────────────────────────────────
  async leaveGroup(userId: string, groupId: string, companyId: string) {
    // Solo puede sacar una empresa que le pertenece.
    await this.assertOwnsPracticeCompany(userId, companyId);

    const member = await this.prisma.practiceGroupMember.findUnique({
      where: { groupId_companyId: { groupId, companyId } },
    });
    if (!member) {
      throw new NotFoundException('Esta empresa no pertenece al grupo.');
    }

    await this.prisma.practiceGroupMember.delete({ where: { id: member.id } });

    // Si el grupo quedó sin miembros, se elimina.
    const remaining = await this.prisma.practiceGroupMember.count({
      where: { groupId },
    });
    if (remaining === 0) {
      await this.prisma.practiceGroup.delete({ where: { id: groupId } });
      return { ok: true, groupDeleted: true };
    }

    return { ok: true, groupDeleted: false };
  }
}
