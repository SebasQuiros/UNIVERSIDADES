import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyMode, CompanyRole } from '@prisma/client';
import {
  CreateGroupCompanyDto,
  AddCompanyMemberDto,
  SetCompanyEnabledDto,
} from './dto/company-memberships.dto';

/**
 * Service para companies en modo GROUP y manejo de miembros (Fase 1).
 *
 * Convención adoptada (sin romper lo existente):
 *   - Companies modo INDIVIDUAL → manejadas por CompaniesService legacy.
 *     Tienen attemptId/studentId set y NO usan CompanyMembership.
 *   - Companies modo GROUP → creadas y manejadas acá. Tienen exerciseId set,
 *     attemptId/studentId NULL, y los integrantes viven en CompanyMembership.
 *
 * Reglas de acceso:
 *   - SUPERADMIN: todo
 *   - ADMIN: companies de su universidad (vía teacher.university del exercise)
 *   - TEACHER: solo si es teacherId del exercise asociado
 *   - STUDENT (OWNER de la company): puede invitar/sacar MEMBERs (no OWNERs ni admin ops)
 *   - STUDENT (MEMBER): solo lectura
 */
@Injectable()
export class CompanyMembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────
  //  GROUP COMPANIES
  // ────────────────────────────────────────────────────────────

  /** POST /exercises/:exerciseId/group-companies — TEACHER/ADMIN. */
  async createGroupCompany(
    exerciseId: string,
    user: { id: string; role: string },
    dto: CreateGroupCompanyDto,
  ) {
    const exercise = await this._assertCanAdminExercise(exerciseId, user);

    // Validamos que el ejercicio tenga companyMode=GROUP en su config —
    // si está en INDIVIDUAL, no tiene sentido crear group companies.
    const config = await this.prisma.exerciseConfig.findUnique({
      where: { exerciseId },
      select: { companyMode: true },
    });
    if (config && config.companyMode !== CompanyMode.GROUP) {
      throw new BadRequestException(
        'El ejercicio está configurado en modo INDIVIDUAL. ' +
        'Cambiá ExerciseConfig.companyMode a GROUP antes de crear group companies.',
      );
    }

    // Si el profe no especifica legalId, generamos uno único basado en
    // el conteo de companies del exercise. Evita que dos GROUP companies
    // compartan el mismo legalId (lo que rompería el matching de
    // inter-company por legalId == client.identification).
    let legalId = dto.legalId?.trim();
    if (!legalId) {
      const count = await this.prisma.company.count({
        where: { exerciseId, mode: CompanyMode.GROUP },
      });
      legalId = `3-101-9${String(Date.now()).slice(-5)}${count}`.slice(0, 18);
    }

    return this.prisma.company.create({
      data: {
        exerciseId,
        mode:               CompanyMode.GROUP,
        attemptId:          null,
        studentId:          null,
        isCompanyEnabled:   true,
        name:               dto.name,
        legalId,
      },
    });
  }

  /**
   * GET /exercises/:exerciseId/companies/dashboard — Fase 4.
   * Vista live para el profesor: por cada company del ejercicio (INDIVIDUAL
   * y GROUP), trae stats en tiempo real (facturas, ventas, compras, AR, AP)
   * en un solo endpoint para no hacer N requests desde el frontend.
   *
   * Performance: 5 aggregate queries por separado, cada una groupBy companyId
   * — en total 5 queries para todas las companies juntas (no N+1).
   */
  async exerciseDashboard(
    exerciseId: string,
    user: { id: string; role: string },
  ) {
    const exercise = await this._assertCanAdminExercise(exerciseId, user);

    const companies = await this.prisma.company.findMany({
      where:  { exerciseId: exercise.id },
      select: {
        id: true, name: true, mode: true, legalId: true, isCompanyEnabled: true,
        studentId: true,
        student: { select: { id: true, name: true, email: true } },
        memberships: {
          select: { user: { select: { id: true, name: true, email: true } }, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (companies.length === 0) {
      return { exercise: { id: exercise.id }, companies: [] };
    }
    const companyIds = companies.map(c => c.id);

    // Queries agregadas en paralelo — 5 round-trips totales sin importar N.
    const [salesAgg, openARAgg, purchAgg, openAPAgg, journalAgg] = await Promise.all([
      this.prisma.invoice.groupBy({
        by:    ['companyId'],
        where: { companyId: { in: companyIds }, status: { not: 'CANCELLED' as any } },
        _sum:  { total: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.groupBy({
        by:    ['companyId'],
        where: {
          companyId: { in: companyIds },
          status: { in: ['ISSUED', 'ACCEPTED'] as any[] },
          balanceDue: { gt: 0 },
        },
        _sum: { balanceDue: true },
      }),
      this.prisma.purchaseInvoice.groupBy({
        by:    ['companyId'],
        where: { companyId: { in: companyIds }, isAccepted: true },
        _sum:  { total: true },
        _count: { _all: true },
      }),
      this.prisma.purchaseInvoice.groupBy({
        by:    ['companyId'],
        where: { companyId: { in: companyIds }, isAccepted: true, isPaid: false },
        _sum:  { total: true, paidAmount: true },
      }),
      this.prisma.journalEntry.groupBy({
        by:    ['companyId'],
        where: { companyId: { in: companyIds }, isReversed: false },
        _count: { _all: true },
      }),
    ]);

    const byId = (arr: any[], key: string = 'companyId') => {
      const m = new Map<string, any>();
      for (const r of arr) m.set(r[key], r);
      return m;
    };
    const sales   = byId(salesAgg);
    const openAR  = byId(openARAgg);
    const purch   = byId(purchAgg);
    const openAP  = byId(openAPAgg);
    const journal = byId(journalAgg);

    const result = companies.map(c => {
      const apOpen = openAP.get(c.id);
      const apOutstanding = apOpen
        ? Number(apOpen._sum.total ?? 0) - Number(apOpen._sum.paidAmount ?? 0)
        : 0;
      return {
        id:                c.id,
        name:              c.name,
        mode:              c.mode,
        legalId:           c.legalId,
        isCompanyEnabled:  c.isCompanyEnabled,
        owner:             c.student
          ? { id: c.student.id, name: c.student.name, email: c.student.email }
          : null,
        members:           c.memberships.map(m => ({
          ...m.user, role: m.role,
        })),
        stats: {
          invoicesCount:   sales.get(c.id)?._count?._all ?? 0,
          totalSales:      Number(sales.get(c.id)?._sum?.total ?? 0),
          arOutstanding:   Number(openAR.get(c.id)?._sum?.balanceDue ?? 0),
          purchasesCount:  purch.get(c.id)?._count?._all ?? 0,
          totalPurchases:  Number(purch.get(c.id)?._sum?.total ?? 0),
          apOutstanding:   Math.max(0, apOutstanding),
          journalEntries:  journal.get(c.id)?._count?._all ?? 0,
        },
      };
    });

    return {
      exercise: { id: exercise.id, isPublished: exercise.isPublished },
      companies: result,
    };
  }

  /** GET /exercises/:exerciseId/group-companies — TEACHER/ADMIN o miembro. */
  async listGroupCompanies(
    exerciseId: string,
    user: { id: string; role: string },
  ) {
    const exercise = await this.prisma.exercise.findUnique({
      where:  { id: exerciseId },
      select: { id: true, teacherId: true },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');

    return this.prisma.company.findMany({
      where: {
        exerciseId,
        mode: CompanyMode.GROUP,
        // Estudiantes solo ven companies donde son miembros.
        ...(user.role === 'STUDENT' && {
          memberships: { some: { userId: user.id } },
        }),
      },
      include: {
        memberships: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  //  MEMBERSHIPS
  // ────────────────────────────────────────────────────────────

  /** GET /companies/:companyId/members — accesible para integrantes y admin. */
  async listMembers(companyId: string, user: { id: string; role: string }) {
    const company = await this._assertCanReadCompany(companyId, user);
    return this.prisma.companyMembership.findMany({
      where: { companyId: company.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  /** POST /companies/:companyId/members — TEACHER/ADMIN/OWNER. */
  async addMember(
    companyId: string,
    user: { id: string; role: string },
    dto: AddCompanyMemberDto,
  ) {
    const company = await this._assertCanManageMembers(companyId, user);

    // No promover a OWNER si quien invita no es admin/teacher.
    if (dto.role === CompanyRole.OWNER && user.role === 'STUDENT') {
      throw new ForbiddenException(
        'Solo el profesor o admin puede asignar el rol OWNER.',
      );
    }

    // Verificar que el user a agregar exista.
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId }, select: { id: true, isActive: true },
    });
    if (!target) throw new NotFoundException('Usuario destino no existe');
    if (!target.isActive) throw new BadRequestException('El usuario está inactivo');

    try {
      return await this.prisma.companyMembership.create({
        data: {
          companyId: company.id,
          userId:    dto.userId,
          role:      dto.role ?? CompanyRole.MEMBER,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    } catch (err: any) {
      // Postgres P2002 (unique violation)
      if (err?.code === 'P2002') {
        throw new ConflictException('Este usuario ya es miembro de la empresa');
      }
      throw err;
    }
  }

  /** DELETE /companies/:companyId/members/:userId — TEACHER/ADMIN/OWNER. */
  async removeMember(
    companyId: string,
    targetUserId: string,
    user: { id: string; role: string },
  ) {
    const company = await this._assertCanManageMembers(companyId, user);

    const membership = await this.prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId: company.id, userId: targetUserId } },
    });
    if (!membership) throw new NotFoundException('El usuario no es miembro');

    // Salvaguarda: no dejar la company sin OWNER si solo queda uno.
    if (membership.role === CompanyRole.OWNER) {
      const owners = await this.prisma.companyMembership.count({
        where: { companyId: company.id, role: CompanyRole.OWNER },
      });
      if (owners <= 1) {
        throw new BadRequestException(
          'No se puede remover al último OWNER. Asigná otro OWNER antes.',
        );
      }
    }

    await this.prisma.companyMembership.delete({
      where: { companyId_userId: { companyId: company.id, userId: targetUserId } },
    });
    return { ok: true };
  }

  // ────────────────────────────────────────────────────────────
  //  isCompanyEnabled toggle
  // ────────────────────────────────────────────────────────────

  /** PATCH /companies/:companyId/enabled — solo TEACHER/ADMIN/SUPERADMIN. */
  async setEnabled(
    companyId: string,
    user: { id: string; role: string },
    dto: SetCompanyEnabledDto,
  ) {
    if (!['TEACHER', 'ADMIN', 'SUPERADMIN'].includes(user.role)) {
      throw new ForbiddenException(
        'Solo el profesor o admin puede habilitar/deshabilitar la empresa',
      );
    }
    const company = await this._loadCompanyOrThrow(companyId);
    if (user.role === 'TEACHER') {
      await this._assertExerciseTeacher(company.exerciseId ?? null, user.id);
    }
    return this.prisma.company.update({
      where: { id: company.id },
      data:  { isCompanyEnabled: dto.enabled },
      select: { id: true, name: true, isCompanyEnabled: true },
    });
  }

  // ────────────────────────────────────────────────────────────
  //  Helpers de autorización
  // ────────────────────────────────────────────────────────────

  private async _loadCompanyOrThrow(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, mode: true, exerciseId: true, studentId: true,
        attemptId: true,
      },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }

  /** Solo TEACHER del exercise / ADMIN / SUPERADMIN pueden mutar la config. */
  private async _assertCanAdminExercise(
    exerciseId: string,
    user: { id: string; role: string },
  ) {
    const exercise = await this.prisma.exercise.findUnique({
      where:  { id: exerciseId },
      select: { id: true, teacherId: true, isPublished: true },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');
    if (user.role === 'TEACHER' && exercise.teacherId !== user.id) {
      throw new ForbiddenException('No sos el profesor de este ejercicio');
    }
    if (!['TEACHER', 'ADMIN', 'SUPERADMIN'].includes(user.role)) {
      throw new ForbiddenException('Sin permisos');
    }
    return exercise;
  }

  /** Lectura: integrante de la company o admin/teacher del exercise. */
  private async _assertCanReadCompany(
    companyId: string,
    user: { id: string; role: string },
  ) {
    const company = await this._loadCompanyOrThrow(companyId);
    if (['ADMIN', 'SUPERADMIN'].includes(user.role)) return company;
    if (user.role === 'TEACHER') {
      await this._assertExerciseTeacher(company.exerciseId ?? null, user.id);
      return company;
    }
    // STUDENT: dueño individual o miembro de la group company.
    if (company.mode === CompanyMode.INDIVIDUAL && company.studentId === user.id) {
      return company;
    }
    const isMember = await this.prisma.companyMembership.count({
      where: { companyId: company.id, userId: user.id },
    });
    if (!isMember) throw new ForbiddenException('Sin acceso a esta empresa');
    return company;
  }

  /** Mutar miembros: TEACHER/ADMIN del exercise, o un OWNER de la company. */
  private async _assertCanManageMembers(
    companyId: string,
    user: { id: string; role: string },
  ) {
    const company = await this._loadCompanyOrThrow(companyId);
    if (company.mode !== CompanyMode.GROUP) {
      throw new BadRequestException(
        'Solo las empresas en modo GROUP tienen miembros',
      );
    }
    if (['ADMIN', 'SUPERADMIN'].includes(user.role)) return company;
    if (user.role === 'TEACHER') {
      await this._assertExerciseTeacher(company.exerciseId ?? null, user.id);
      return company;
    }
    // STUDENT: solo si es OWNER.
    const owner = await this.prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId: company.id, userId: user.id } },
    });
    if (!owner || owner.role !== CompanyRole.OWNER) {
      throw new ForbiddenException(
        'Solo un OWNER de la empresa puede manejar miembros',
      );
    }
    return company;
  }

  private async _assertExerciseTeacher(
    exerciseId: string | null,
    teacherId: string,
  ) {
    if (!exerciseId) {
      throw new ForbiddenException('Empresa sin ejercicio asociado');
    }
    const exercise = await this.prisma.exercise.findUnique({
      where:  { id: exerciseId },
      select: { teacherId: true },
    });
    if (!exercise || exercise.teacherId !== teacherId) {
      throw new ForbiddenException('No sos el profesor del ejercicio');
    }
  }
}
