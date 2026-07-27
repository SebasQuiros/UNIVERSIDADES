import {
  Injectable, Logger, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { ClassSessionStatus, TaxDeclarationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyMembershipsService } from '../company-memberships/company-memberships.service';
import { ReportsService } from '../reports/reports.service';
import { CompaniesService } from '../companies/companies.service';
import { ClassSessionsOracleService } from './class-sessions-oracle.service';
import { ringAssignments } from './class-sessions.logic';
import {
  CreateClassSessionDto, CreateSessionGroupDto, UpdateArchetypeDto,
  StartSessionDto, CancelSessionDto, JoinClassSessionDto,
  SubmitFindingDto, UpdateFindingDto, FINDING_SECTIONS,
} from './dto/class-sessions.dto';

type AuthUser = { id: string; role: string; universityId?: string | null };

// Alfabeto sin caracteres ambiguos (0/O, 1/I) para el código proyectable.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACTIVE_MS = 2 * 60 * 1000;
const IDLE_MS   = 10 * 60 * 1000;

const DEFAULT_SETTINGS = { accountingWeight: 0.6, auditWeight: 0.4 };

@Injectable()
export class ClassSessionsService {
  private readonly logger = new Logger(ClassSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: CompanyMembershipsService,
    private readonly reports: ReportsService,
    private readonly oracle: ClassSessionsOracleService,
    private readonly companies: CompaniesService,
  ) {}

  // ════════════════════════════════════════════════════════════
  //  Helpers
  // ════════════════════════════════════════════════════════════

  /** Transición atómica anti doble-click / carrera (patrón de procurement). */
  private async transition(
    id: string,
    from: ClassSessionStatus | ClassSessionStatus[],
    to: ClassSessionStatus,
    extra: Record<string, any> = {},
  ) {
    const fromList = Array.isArray(from) ? from : [from];
    const moved = await this.prisma.classSession.updateMany({
      where: { id, status: { in: fromList } },
      data:  { status: to, ...extra },
    });
    if (moved.count === 0) {
      throw new ConflictException(
        `Transición inválida: la sesión no está en el estado esperado (${fromList.join('/')}).`,
      );
    }
  }

  private genCode(): string {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  private onlineStatus(lastPingAt: Date, now: number): 'ACTIVE' | 'IDLE' | 'OFFLINE' {
    const diff = now - lastPingAt.getTime();
    if (diff < ACTIVE_MS) return 'ACTIVE';
    if (diff < IDLE_MS)   return 'IDLE';
    return 'OFFLINE';
  }

  private async assertCanAdminExercise(exerciseId: string, user: AuthUser) {
    const exercise = await this.prisma.exercise.findUnique({
      where:  { id: exerciseId },
      select: { id: true, teacherId: true, course: { select: { universityId: true } } },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');
    if (user.role === 'SUPERADMIN') return exercise;
    if (user.role === 'ADMIN') {
      if (user.universityId && exercise.course.universityId !== user.universityId) {
        throw new ForbiddenException('El ejercicio pertenece a otra universidad.');
      }
      return exercise;
    }
    if (user.role === 'TEACHER' && exercise.teacherId === user.id) return exercise;
    throw new ForbiddenException('No sos el profesor de este ejercicio.');
  }

  private async loadOrThrow(id: string) {
    const session = await this.prisma.classSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Sesión de aula no encontrada');
    return session;
  }

  // ════════════════════════════════════════════════════════════
  //  Creación / lectura
  // ════════════════════════════════════════════════════════════

  async createForExercise(exerciseId: string, user: AuthUser, dto: CreateClassSessionDto) {
    await this.assertCanAdminExercise(exerciseId, user);

    const existing = await this.prisma.classSession.findUnique({ where: { exerciseId } });
    if (existing) {
      throw new ConflictException('Ya existe una sesión de aula para este ejercicio.');
    }

    const minGroupSize = dto.minGroupSize ?? 3;
    const maxGroupSize = dto.maxGroupSize ?? 6;
    if (minGroupSize > maxGroupSize) {
      throw new BadRequestException('minGroupSize no puede ser mayor que maxGroupSize.');
    }

    // Reintenta ante colisión de código (unique).
    let session: Awaited<ReturnType<typeof this.prisma.classSession.create>> | null = null;
    for (let attempt = 0; attempt < 6 && !session; attempt++) {
      try {
        session = await this.prisma.classSession.create({
          data: {
            exerciseId,
            teacherId: user.id,
            code:      this.genCode(),
            status:    ClassSessionStatus.DRAFT,
            minGroupSize,
            maxGroupSize,
            settings:  DEFAULT_SETTINGS,
          },
        });
      } catch (err: any) {
        // P2002 en `code` → reintenta; en `exerciseId` → ya existe (carrera).
        if (err?.code === 'P2002') {
          if (err?.meta?.target?.includes?.('exercise_id')) {
            throw new ConflictException('Ya existe una sesión de aula para este ejercicio.');
          }
          continue;
        }
        throw err;
      }
    }
    if (!session) {
      throw new ConflictException('No se pudo generar un código único. Intentá de nuevo.');
    }

    // La sesión REQUIERE modo GROUP + comercio B2B automático. Lo forzamos en la
    // config del ejercicio ahora (estamos en DRAFT, antes del lobby, así que el
    // hook de bloqueo aún no aplica). Así el profesor no tiene que recordarlo y
    // `start` no falla luego por config faltante o incoherente — y queda alineado
    // con `createGroupCompany`, que tolera config nula.
    await this.prisma.exerciseConfig.upsert({
      where:  { exerciseId },
      create: { exerciseId, companyMode: 'GROUP', autoTransactionsBetweenCompanies: true },
      update: { companyMode: 'GROUP', autoTransactionsBetweenCompanies: true },
    });

    return session;
  }

  async getForExercise(exerciseId: string, user: AuthUser) {
    // Validamos dueño ANTES de revelar si la sesión existe (no filtrar existencia
    // por 404-vs-403). El ClassSessionGuard no corre acá (ruta por exerciseId).
    await this.assertCanAdminExercise(exerciseId, user);
    const session = await this.prisma.classSession.findUnique({
      where:   { exerciseId },
      include: { companies: true, _count: { select: { participants: true } } },
    });
    if (!session) throw new NotFoundException('No hay sesión de aula para este ejercicio.');
    return session;
  }

  // ════════════════════════════════════════════════════════════
  //  Transiciones del profesor
  // ════════════════════════════════════════════════════════════

  async openLobby(id: string) {
    await this.transition(id, ClassSessionStatus.DRAFT, ClassSessionStatus.LOBBY);
    return this.loadOrThrow(id);
  }

  async createGroup(id: string, user: AuthUser, dto: CreateSessionGroupDto) {
    const session = await this.loadOrThrow(id);
    if (session.status !== ClassSessionStatus.LOBBY) {
      throw new ConflictException('Solo se pueden crear grupos durante el lobby.');
    }
    // Reusa el service existente para crear la Company GROUP (valida companyMode).
    const company = await this.memberships.createGroupCompany(session.exerciseId, user, {
      name:    dto.name,
      legalId: dto.legalId,
    } as any);

    const link = await this.prisma.classSessionCompany.create({
      data: { classSessionId: id, companyId: company.id, archetype: dto.archetype },
    });
    return { company, classSessionCompany: link };
  }

  async setArchetype(id: string, companyId: string, dto: UpdateArchetypeDto) {
    const session = await this.loadOrThrow(id);
    if (session.status !== ClassSessionStatus.LOBBY) {
      throw new ConflictException('Solo se puede cambiar el arquetipo durante el lobby.');
    }
    const updated = await this.prisma.classSessionCompany.updateMany({
      where: { classSessionId: id, companyId },
      data:  { archetype: dto.archetype },
    });
    if (updated.count === 0) {
      throw new NotFoundException('La empresa no pertenece a esta sesión.');
    }
    return { ok: true, archetype: dto.archetype };
  }

  /** Reparte los participantes sin grupo entre las empresas existentes (round-robin). */
  async autoAssign(id: string) {
    const session = await this.loadOrThrow(id);
    if (session.status !== ClassSessionStatus.LOBBY) {
      throw new ConflictException('El auto-reparto solo está disponible en el lobby.');
    }
    const [groups, unassigned] = await Promise.all([
      this.prisma.classSessionCompany.findMany({
        where:  { classSessionId: id },
        select: { companyId: true },
      }),
      this.prisma.classSessionParticipant.findMany({
        where:  { classSessionId: id, companyId: null },
        orderBy: { joinedAt: 'asc' },
      }),
    ]);
    if (groups.length === 0) {
      throw new BadRequestException('Creá al menos un grupo antes de repartir.');
    }

    let assigned = 0;
    for (let i = 0; i < unassigned.length; i++) {
      const target = groups[i % groups.length].companyId;
      await this.prisma.$transaction([
        this.prisma.classSessionParticipant.update({
          where: { id: unassigned[i].id },
          data:  { companyId: target },
        }),
        // Alta como miembro de la Company (idempotente: ignora duplicado).
        this.prisma.companyMembership.upsert({
          where:  { companyId_userId: { companyId: target, userId: unassigned[i].studentId } },
          create: { companyId: target, userId: unassigned[i].studentId, role: 'MEMBER' },
          update: {},
        }),
      ]);
      assigned++;
    }
    return { assigned, groups: groups.length };
  }

  async removeParticipant(id: string, participantId: string) {
    const session = await this.loadOrThrow(id);
    if (session.status !== ClassSessionStatus.LOBBY) {
      throw new ConflictException('Solo se puede expulsar durante el lobby.');
    }
    const participant = await this.prisma.classSessionParticipant.findFirst({
      where:  { id: participantId, classSessionId: id },
      select: { id: true, studentId: true, companyId: true },
    });
    if (!participant) throw new NotFoundException('Participante no encontrado.');

    // Borrado atómico: sacar al estudiante del participante Y de la membresía de
    // la empresa del grupo. Si solo se borra el participante, la CompanyMembership
    // queda huérfana → el expulsado conserva acceso a los libros del grupo (el
    // guard concede acceso GROUP vía membership) y seguiría siendo calificado.
    await this.prisma.$transaction(async (tx) => {
      await tx.classSessionParticipant.delete({ where: { id: participant.id } });
      if (participant.companyId) {
        await tx.companyMembership.deleteMany({
          where: { companyId: participant.companyId, userId: participant.studentId },
        });
      }
    });
    return { ok: true };
  }

  async start(id: string, dto: StartSessionDto) {
    const session = await this.loadOrThrow(id);
    if (session.status !== ClassSessionStatus.LOBBY) {
      throw new ConflictException('La sesión no está en lobby.');
    }

    const config = await this.prisma.exerciseConfig.findUnique({
      where:  { exerciseId: session.exerciseId },
      select: { companyMode: true, autoTransactionsBetweenCompanies: true },
    });
    if (!config || config.companyMode !== 'GROUP') {
      throw new BadRequestException(
        'El ejercicio debe estar en modo GROUP para la sesión de aula. Ajustá la configuración.',
      );
    }
    if (!config.autoTransactionsBetweenCompanies) {
      throw new BadRequestException(
        'Activá "transacciones automáticas entre empresas" en la config del ejercicio antes de arrancar.',
      );
    }

    // Grupos incompletos → bloquea salvo force.
    const groupsCount = await this.prisma.classSessionCompany.count({
      where: { classSessionId: id },
    });
    if (groupsCount === 0) {
      throw new BadRequestException('No hay grupos creados.');
    }
    if (!dto.force) {
      // Comparamos contra TODOS los grupos, no solo los que ya tienen algún
      // participante: el groupBy omite las empresas con 0 participantes, así que
      // un grupo vacío nunca se marcaba como pequeño y la sesión arrancaba con
      // grupos-cáscara (que luego rompen el anillo de auditoría).
      const [groups, counts] = await Promise.all([
        this.prisma.classSessionCompany.findMany({
          where:  { classSessionId: id },
          select: { companyId: true },
        }),
        this.prisma.classSessionParticipant.groupBy({
          by: ['companyId'],
          where: { classSessionId: id, companyId: { not: null } },
          _count: true,
        }),
      ]);
      const countByCompany = new Map<string, number>(
        counts.map(c => [c.companyId as string, c._count as number]),
      );
      const small = groups.filter(
        g => (countByCompany.get(g.companyId) ?? 0) < session.minGroupSize,
      );
      if (small.length > 0) {
        throw new BadRequestException(
          `Hay ${small.length} grupo(s) por debajo del mínimo de ${session.minGroupSize} ` +
          '(incluye grupos vacíos). Reasigná o arrancá con force=true.',
        );
      }
    }

    // Crea 1 ExerciseAttempt por participante con grupo (idempotente).
    const participants = await this.prisma.classSessionParticipant.findMany({
      where:  { classSessionId: id, companyId: { not: null } },
      select: { studentId: true },
    });
    if (participants.length > 0) {
      await this.prisma.exerciseAttempt.createMany({
        data: participants.map(p => ({
          exerciseId: session.exerciseId,
          studentId:  p.studentId,
          status:     'NOT_STARTED' as const,
        })),
        skipDuplicates: true,
      });
    }

    await this.transition(id, ClassSessionStatus.LOBBY, ClassSessionStatus.EN_CURSO, {
      startedAt: new Date(),
    });
    return { status: ClassSessionStatus.EN_CURSO, attemptsCreated: participants.length };
  }

  async closeOperations(id: string) {
    const session = await this.loadOrThrow(id);
    if (session.status !== ClassSessionStatus.EN_CURSO) {
      throw new ConflictException('La sesión no está en operación.');
    }
    const companies = await this.prisma.classSessionCompany.findMany({
      where:  { classSessionId: id },
      select: { companyId: true },
    });
    const companyIds = companies.map(c => c.companyId);

    // Verifica que no queden períodos OPEN — el cierre lo hace el equipo estudiante.
    const openPeriods = await this.prisma.accountingPeriod.findMany({
      where:  { companyId: { in: companyIds }, status: 'OPEN' },
      select: { companyId: true },
    });
    if (openPeriods.length > 0) {
      throw new ConflictException({
        message:      'Hay empresas con períodos contables abiertos. Deben cerrarlos antes de tributar.',
        openPeriods:  [...new Set(openPeriods.map(p => p.companyId))],
      });
    }

    // Congela la operación: deshabilita escritura contable en cada empresa.
    await this.prisma.company.updateMany({
      where: { id: { in: companyIds } },
      data:  { isCompanyEnabled: false },
    });
    await this.transition(id, ClassSessionStatus.EN_CURSO, ClassSessionStatus.TRIBUTACION, {
      closedOpsAt: new Date(),
    });
    return { status: ClassSessionStatus.TRIBUTACION, disabledCompanies: companyIds.length };
  }

  /** TRIBUTACION → AUDITORIA. Congela snapshots + crea asignaciones. IRREVERSIBLE. Re-invocable. */
  async publishSnapshot(id: string) {
    const session = await this.loadOrThrow(id);
    if (session.status !== ClassSessionStatus.TRIBUTACION &&
        session.status !== ClassSessionStatus.AUDITORIA) {
      throw new ConflictException('La sesión no está lista para publicar el snapshot.');
    }

    const companies = await this.prisma.classSessionCompany.findMany({
      where: { classSessionId: id },
    });

    // 1) Congela EEFF por empresa (idempotente: solo las que no tienen snapshot).
    let published = 0;
    for (const c of companies) {
      if (c.snapshotPublishedAt) continue;
      const filter: any = {};
      const [trialBalance, balanceSheet, incomeStatement] = await Promise.all([
        this.reports.getTrialBalance(c.companyId, filter),
        this.reports.getBalanceSheet(c.companyId, filter),
        this.reports.getIncomeStatement(c.companyId, filter),
      ]);
      const taxDeclarations = await this.collectTaxDeclarations(c.companyId);

      const frozen = await this.prisma.classSessionCompany.updateMany({
        where: { id: c.id, snapshotPublishedAt: null },
        data: {
          snapshotTrialBalance:    trialBalance as any,
          snapshotBalanceSheet:    balanceSheet as any,
          snapshotIncomeStatement: incomeStatement as any,
          snapshotTaxDeclarations: taxDeclarations as any,
          snapshotPublishedAt:     new Date(),
        },
      });
      published += frozen.count;
    }

    // 2) Crea las asignaciones de auditoría (derangement cíclico) si no existen.
    //    Solo entran al anillo las empresas CON miembros: una empresa vacía (grupo
    //    sin participantes, p.ej. si el profe arrancó con force) no puede auditar
    //    ni ser auditada de forma significativa y desbalancearía el derangement
    //    (una empresa real quedaría sin auditor y otra auditaría una cáscara).
    const memberCounts = await this.prisma.companyMembership.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companies.map(c => c.companyId) } },
      _count: true,
    });
    const populated = new Set(
      memberCounts.filter(m => m._count > 0).map(m => m.companyId),
    );
    const ringCompanyIds = companies
      .map(c => c.companyId)
      .filter(cid => populated.has(cid));

    const existingAssignments = await this.prisma.classSessionAuditAssignment.count({
      where: { classSessionId: id },
    });
    let assignments = existingAssignments;
    if (existingAssignments === 0 && ringCompanyIds.length >= 2) {
      const ring = this.buildDerangement(ringCompanyIds);
      await this.prisma.classSessionAuditAssignment.createMany({
        data: ring.map(pair => ({
          classSessionId:   id,
          auditorCompanyId: pair.auditor,
          auditeeCompanyId: pair.auditee,
        })),
      });
      assignments = ring.length;
    }

    // 3) Marca AUDITORIA (solo si aún está en TRIBUTACION).
    if (session.status === ClassSessionStatus.TRIBUTACION) {
      await this.transition(id, ClassSessionStatus.TRIBUTACION, ClassSessionStatus.AUDITORIA, {
        snapshotAt: new Date(),
      });
    }
    return {
      status: ClassSessionStatus.AUDITORIA,
      companiesPublished: published,
      totalCompanies: companies.length,
      assignments,
    };
  }

  /** Anillo barajado: cada empresa audita a la siguiente. n≥3 sin recíprocas. */
  private buildDerangement(companyIds: string[]): { auditor: string; auditee: string }[] {
    const arr = [...companyIds];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return ringAssignments(arr);
  }

  /**
   * Últimas declaraciones SUBMITTED de la empresa, ancladas por companyId.
   *
   * El frontend de la Sesión de Aula (fase TRIBUTACION) enlaza a las páginas D-10x
   * pasando el companyId del grupo, y `TaxDeclarationsService.create` lo ancla
   * (fase 18). Escopamos por companyId — NO por los userId de los miembros — para
   * que el snapshot no mezcle declaraciones de OTRAS empresas del mismo estudiante
   * (práctica, ejercicios individuales). Esta fuente alimenta el oráculo
   * (readReportedDebito D-104 / D-101), por lo que debe ser exactamente esta empresa.
   */
  private async collectTaxDeclarations(companyId: string) {
    const decls = await this.prisma.taxDeclaration.findMany({
      where:   { companyId, status: 'SUBMITTED' },
      orderBy: { submittedAt: 'desc' },
      select:  { type: true, period: true, result: true, referenceNo: true, submittedAt: true },
    });
    // Última por tipo.
    const latestByType: Record<string, any> = {};
    for (const d of decls) {
      if (!latestByType[d.type]) latestByType[d.type] = d;
    }
    const types: TaxDeclarationType[] = ['D104_IVA', 'D101_RENTA', 'D103_RETENCION', 'D115_DIVIDENDOS'];
    return {
      declaraciones: types.map(t => ({
        type: t,
        presentada: !!latestByType[t],
        ...(latestByType[t] ?? {}),
      })),
    };
  }

  async closeAudit(id: string) {
    await this.transition(id, ClassSessionStatus.AUDITORIA, ClassSessionStatus.CALIFICACION, {
      auditClosedAt: new Date(),
    });
    const findings = await this.prisma.classSessionAuditFinding.count({
      where: { assignment: { classSessionId: id } },
    });
    return { status: ClassSessionStatus.CALIFICACION, findingsReceived: findings };
  }

  /** Corre el oráculo (esqueleto por ahora). Repetible en CALIFICACION. */
  async grade(id: string) {
    const session = await this.loadOrThrow(id);
    if (session.status !== ClassSessionStatus.CALIFICACION) {
      throw new ConflictException('La sesión no está en calificación.');
    }
    await this.oracle.gradeSession(id);
    const companies = await this.prisma.classSessionCompany.findMany({
      where:  { classSessionId: id },
      select: { companyId: true, accountingScore: true, auditScore: true },
    });
    return { status: ClassSessionStatus.CALIFICACION, companies };
  }

  async finish(id: string) {
    await this.transition(id, ClassSessionStatus.CALIFICACION, ClassSessionStatus.FINALIZADA, {
      finalizedAt: new Date(),
    });
    return { status: ClassSessionStatus.FINALIZADA };
  }

  async cancel(id: string, _dto: CancelSessionDto) {
    const moved = await this.prisma.classSession.updateMany({
      where: { id, status: { notIn: [ClassSessionStatus.FINALIZADA, ClassSessionStatus.CANCELADA] } },
      data:  { status: ClassSessionStatus.CANCELADA, cancelledAt: new Date() },
    });
    if (moved.count === 0) {
      throw new ConflictException('La sesión ya está finalizada o cancelada.');
    }
    return { status: ClassSessionStatus.CANCELADA };
  }

  // ════════════════════════════════════════════════════════════
  //  Dashboard del profesor
  // ════════════════════════════════════════════════════════════

  async dashboard(id: string) {
    const session = await this.loadOrThrow(id);
    const now = Date.now();

    const [participants, groups, findings] = await Promise.all([
      this.prisma.classSessionParticipant.findMany({
        where:   { classSessionId: id },
        include: { student: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.classSessionCompany.findMany({
        where:   { classSessionId: id },
        include: { company: { select: { id: true, name: true, legalId: true } } },
      }),
      this.prisma.classSessionAuditFinding.groupBy({
        by: ['assignmentId'],
        where: { assignment: { classSessionId: id } },
        _count: true,
      }),
    ]);

    const memberCounts = participants.reduce<Record<string, number>>((acc, p) => {
      if (p.companyId) acc[p.companyId] = (acc[p.companyId] ?? 0) + 1;
      return acc;
    }, {});

    return {
      id: session.id,
      status: session.status,
      code: session.code,
      participants: participants.map(p => ({
        participantId: p.id,
        studentId: p.studentId,
        name: p.student.name,
        email: p.student.email,
        companyId: p.companyId,
        onlineStatus: this.onlineStatus(p.lastPingAt, now),
      })),
      groups: groups.map(g => ({
        companyId: g.companyId,
        name: g.company.name,
        legalId: g.company.legalId,
        archetype: g.archetype,
        memberCount: memberCounts[g.companyId] ?? 0,
        snapshotPublished: !!g.snapshotPublishedAt,
        accountingScore: g.accountingScore,
        auditScore: g.auditScore,
      })),
      participantsCount: participants.length,
      findingsTotal: findings.reduce((s, f) => s + (f._count as number), 0),
    };
  }

  // ════════════════════════════════════════════════════════════
  //  Estudiante
  // ════════════════════════════════════════════════════════════

  async join(user: AuthUser, dto: JoinClassSessionDto) {
    const session = await this.prisma.classSession.findUnique({
      where:   { code: dto.code.toUpperCase() },
      include: { exercise: { select: { course: { select: { universityId: true } } } } },
    });
    if (!session) throw new NotFoundException('Código inválido.');
    if (session.status !== ClassSessionStatus.LOBBY) {
      throw new ConflictException('La sesión ya no admite nuevos participantes.');
    }
    // Aislamiento multi-tenant: el código de unión no es un secreto perfecto
    // (6 chars), así que validamos que el estudiante pertenezca a la universidad
    // de la sesión. Sin esto, un alumno de otra universidad podría colarse por
    // código y terminar comerciando/auditando en un aula ajena.
    const sessionUniversityId = session.exercise?.course?.universityId ?? null;
    if (user.universityId && sessionUniversityId && user.universityId !== sessionUniversityId) {
      throw new ForbiddenException('Esta sesión de aula pertenece a otra universidad.');
    }
    // Idempotente: si ya se unió, devuelve el existente.
    const participant = await this.prisma.classSessionParticipant.upsert({
      where:  { classSessionId_studentId: { classSessionId: session.id, studentId: user.id } },
      create: { classSessionId: session.id, studentId: user.id },
      update: { lastPingAt: new Date() },
    });
    return { classSessionId: session.id, participantId: participant.id, status: session.status };
  }

  async me(id: string, user: AuthUser) {
    const participant = await this.prisma.classSessionParticipant.findUnique({
      where: { classSessionId_studentId: { classSessionId: id, studentId: user.id } },
    });
    if (!participant) throw new ForbiddenException('No participás en esta sesión.');
    const session = await this.loadOrThrow(id);

    let company: any = null;
    let groupMembers: any[] = [];
    let attemptId: string | null = null;
    if (participant.companyId) {
      const link = await this.prisma.classSessionCompany.findUnique({
        where:   { companyId: participant.companyId },
        include: { company: { select: { id: true, name: true, legalId: true } } },
      });
      company = link
        ? { id: link.companyId, name: link.company.name, legalId: link.company.legalId, archetype: link.archetype }
        : null;
      const members = await this.prisma.companyMembership.findMany({
        where:   { companyId: participant.companyId },
        include: { user: { select: { id: true, name: true } } },
      });
      groupMembers = members.map(m => ({ id: m.userId, name: m.user.name, role: m.role }));
      const attempt = await this.prisma.exerciseAttempt.findUnique({
        where:  { exerciseId_studentId: { exerciseId: session.exerciseId, studentId: user.id } },
        select: { id: true },
      });
      attemptId = attempt?.id ?? null;
    }

    return {
      status: session.status,
      companyId: participant.companyId,
      company,
      groupMembers,
      attemptId,
    };
  }

  async ping(id: string, user: AuthUser) {
    const updated = await this.prisma.classSessionParticipant.updateMany({
      where: { classSessionId: id, studentId: user.id },
      data:  { lastPingAt: new Date() },
    });
    if (updated.count === 0) throw new ForbiddenException('No participás en esta sesión.');
    return { ok: true };
  }

  /** Payload liviano para polling del lobby / tablero. */
  async live(id: string) {
    const session = await this.loadOrThrow(id);
    const [groups, participantsCount] = await Promise.all([
      this.prisma.classSessionCompany.findMany({
        where:   { classSessionId: id },
        include: { company: { select: { name: true } } },
      }),
      this.prisma.classSessionParticipant.count({ where: { classSessionId: id } }),
    ]);
    const memberCounts = await this.prisma.classSessionParticipant.groupBy({
      by: ['companyId'],
      where: { classSessionId: id, companyId: { not: null } },
      _count: true,
    });
    const countMap = memberCounts.reduce<Record<string, number>>((acc, c) => {
      if (c.companyId) acc[c.companyId] = c._count as number;
      return acc;
    }, {});
    return {
      status: session.status,
      code: session.code,
      participantsCount,
      groups: groups.map(g => ({
        companyId: g.companyId,
        name: g.company.name,
        archetype: g.archetype,
        memberCount: countMap[g.companyId] ?? 0,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════
  //  Ranking empresarial (Enterprise Score 0–1000) — spec cap. 9
  // ════════════════════════════════════════════════════════════
  // Score continuo derivado de la contabilidad real de cada empresa de la
  // sesión (reutiliza getValuation). Read-only, sin mutar nada.
  async ranking(id: string) {
    const session = await this.loadOrThrow(id);
    const groups = await this.prisma.classSessionCompany.findMany({
      where:   { classSessionId: id },
      include: { company: { select: { name: true } } },
    });
    const memberCounts = await this.prisma.classSessionParticipant.groupBy({
      by: ['companyId'],
      where: { classSessionId: id, companyId: { not: null } },
      _count: true,
    });
    const countMap = memberCounts.reduce<Record<string, number>>((acc, c) => {
      if (c.companyId) acc[c.companyId] = c._count as number;
      return acc;
    }, {});

    const rows = await Promise.all(groups.map(async (g) => {
      let val: any = null;
      try { val = await this.companies.getValuation(g.companyId); } catch { /* sin datos aún */ }
      const f = val?.financials ?? {};
      const r = val?.ratios ?? {};
      const health = Number(val?.healthScore ?? 0);          // 0–100 aprox.
      const netIncome = Number(f.netIncome ?? 0);
      const equity    = Number(f.equity ?? 0);
      const netMargin = Number(r.netMargin ?? 0);            // %
      const currentR  = Number(r.currentRatio ?? 0);

      // Enterprise Score 0–1000: salud (0–500) + rentabilidad (0–250) +
      // solvencia/liquidez (0–250). Ponderaciones fijas, explicables.
      const sSalud    = Math.max(0, Math.min(500, health * 5));
      const sRent     = Math.max(0, Math.min(250, (netMargin / 25) * 250)) + (netIncome > 0 ? 0 : -60);
      const sSolvencia = Math.max(0, Math.min(150, (Math.min(currentR, 3) / 3) * 150))
                       + (equity > 0 ? 100 : 0);
      const score = Math.round(Math.max(0, Math.min(1000, sSalud + Math.max(0, sRent) + sSolvencia)));

      return {
        companyId: g.companyId,
        name: g.company.name,
        archetype: g.archetype,
        memberCount: countMap[g.companyId] ?? 0,
        score,
        sharePrice: val?.sharePrice ?? null,
        marketCap:  val?.marketCap ?? null,
        rating:     val?.rating ?? null,
        metrics: {
          equity, netIncome, netMargin, currentRatio: currentR,
          healthScore: health,
        },
        breakdown: {
          salud: Math.round(sSalud),
          rentabilidad: Math.round(Math.max(0, sRent)),
          solvencia: Math.round(sSolvencia),
        },
      };
    }));

    rows.sort((a, b) => b.score - a.score);
    return {
      status: session.status,
      generatedAt: new Date().toISOString(),
      ranking: rows.map((r, i) => ({ position: i + 1, ...r })),
    };
  }

  // ════════════════════════════════════════════════════════════
  //  Auditoría (req ya validado por AuditAssignmentGuard)
  // ════════════════════════════════════════════════════════════

  async getAssignment(req: any) {
    if (req.auditObserver) {
      // Staff: lista todas las asignaciones de la sesión (solo identidad).
      const assignments = await this.prisma.classSessionAuditAssignment.findMany({
        where:   { classSessionId: req.classSession.id },
        include: {
          auditor: { include: { company: { select: { name: true } } } },
          auditee: { include: { company: { select: { name: true } } } },
        },
      });
      return assignments.map(a => ({
        auditorCompanyId: a.auditorCompanyId,
        auditorName: a.auditor.company.name,
        auditeeCompanyId: a.auditeeCompanyId,
        auditeeName: a.auditee.company.name,
        archetype: a.auditee.archetype,
      }));
    }
    const a = req.auditAssignment;
    const auditee = await this.prisma.classSessionCompany.findUnique({
      where:   { companyId: a.auditeeCompanyId },
      include: { company: { select: { name: true } } },
    });
    return {
      auditeeCompanyId: a.auditeeCompanyId,
      auditeeName: auditee?.company.name ?? null,
      archetype: auditee?.archetype ?? null,
    };
  }

  /** Devuelve SOLO las columnas snapshot* de la empresa auditada. */
  async getSnapshot(req: any) {
    const auditeeCompanyId: string | undefined = req.auditAssignment?.auditeeCompanyId;
    if (!auditeeCompanyId) {
      // Staff observador debe indicar a quién mira: no aplica sin asignación.
      throw new ForbiddenException('Sin empresa auditada asignada.');
    }
    const snap = await this.prisma.classSessionCompany.findUnique({
      where:  { companyId: auditeeCompanyId },
      select: {
        snapshotTrialBalance: true, snapshotBalanceSheet: true,
        snapshotIncomeStatement: true, snapshotTaxDeclarations: true,
        snapshotPublishedAt: true,
      },
    });
    if (!snap?.snapshotPublishedAt) {
      throw new NotFoundException('El snapshot aún no fue publicado.');
    }
    return {
      trialBalance:    snap.snapshotTrialBalance,
      balanceSheet:    snap.snapshotBalanceSheet,
      incomeStatement: snap.snapshotIncomeStatement,
      taxDeclarations: snap.snapshotTaxDeclarations,
      publishedAt:     snap.snapshotPublishedAt,
    };
  }

  async createFinding(req: any, user: AuthUser, dto: SubmitFindingDto) {
    if (!FINDING_SECTIONS.includes(dto.section)) {
      throw new BadRequestException(`Sección inválida. Use una de: ${FINDING_SECTIONS.join(', ')}.`);
    }
    const finding = await this.prisma.classSessionAuditFinding.create({
      data: {
        assignmentId:  req.auditAssignment.id,
        createdById:   user.id,
        section:       dto.section,
        accountCode:   dto.accountCode ?? null,
        description:   dto.description,
        claimedAmount: dto.claimedAmount ?? null,
      },
    });
    return finding;
  }

  async listFindings(req: any) {
    // Staff observador: todos los hallazgos de la sesión, con scope EXPLÍCITO por
    // classSessionId. Nunca dejar el filtro caer a `undefined` (Prisma lo
    // ignoraría y devolvería hallazgos de todas las sesiones).
    if (req.auditObserver) {
      return this.prisma.classSessionAuditFinding.findMany({
        where:   { assignment: { classSessionId: req.classSession.id } },
        orderBy: { createdAt: 'asc' },
      });
    }
    return this.prisma.classSessionAuditFinding.findMany({
      where:   { assignmentId: req.auditAssignment.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateFinding(req: any, findingId: string, user: AuthUser, dto: UpdateFindingDto) {
    if (dto.section && !FINDING_SECTIONS.includes(dto.section)) {
      throw new BadRequestException(`Sección inválida. Use una de: ${FINDING_SECTIONS.join(', ')}.`);
    }
    const finding = await this.prisma.classSessionAuditFinding.findFirst({
      where: { id: findingId, assignmentId: req.auditAssignment.id },
    });
    if (!finding) throw new NotFoundException('Hallazgo no encontrado.');
    if (finding.createdById !== user.id) {
      throw new ForbiddenException('Solo quien creó el hallazgo puede editarlo.');
    }
    return this.prisma.classSessionAuditFinding.update({
      where: { id: findingId },
      data: {
        section:       dto.section ?? finding.section,
        accountCode:   dto.accountCode ?? finding.accountCode,
        description:   dto.description ?? finding.description,
        claimedAmount: dto.claimedAmount ?? finding.claimedAmount,
      },
    });
  }

  async deleteFinding(req: any, findingId: string, user: AuthUser) {
    const finding = await this.prisma.classSessionAuditFinding.findFirst({
      where: { id: findingId, assignmentId: req.auditAssignment.id },
    });
    if (!finding) throw new NotFoundException('Hallazgo no encontrado.');
    if (finding.createdById !== user.id) {
      throw new ForbiddenException('Solo quien creó el hallazgo puede eliminarlo.');
    }
    await this.prisma.classSessionAuditFinding.delete({ where: { id: findingId } });
    return { ok: true };
  }
}
