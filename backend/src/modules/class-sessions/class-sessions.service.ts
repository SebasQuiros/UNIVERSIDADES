import {
  Injectable, Inject, Logger, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { ClassSessionStatus, TaxDeclarationType, JournalSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyMembershipsService } from '../company-memberships/company-memberships.service';
import { ReportsService } from '../reports/reports.service';
import { CompaniesService } from '../companies/companies.service';
import { ClassSessionsOracleService } from './class-sessions-oracle.service';
import { JournalService } from '../journal/journal.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
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

/** Segundos que se comparte la vista en vivo entre todos los participantes. */
const LIVE_TTL_SECONDS = 3;

/** El ranking se mueve despacio; puede compartirse más tiempo que la vista. */
const RANKING_TTL_SECONDS = 10;

@Injectable()
export class ClassSessionsService {
  private readonly logger = new Logger(ClassSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: CompanyMembershipsService,
    private readonly reports: ReportsService,
    private readonly oracle: ClassSessionsOracleService,
    private readonly companies: CompaniesService,
    private readonly journal: JournalService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
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

    // Un cambio de fase es justo lo que los alumnos están esperando ver, así
    // que se tira la caché de la vista en vivo en vez de dejarlos unos
    // segundos con la fase anterior. Este método es el único punto por el que
    // pasan TODAS las transiciones, así que basta con hacerlo acá.
    try {
      await this.redis?.del?.(`sesion:live:${id}`);
      await this.redis?.del?.(`sesion:ranking:${id}`);
    } catch { /* sin Redis, nada que invalidar */ }
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
      // FALLA CERRADO: con `user.universityId && ...`, un ADMIN cuya institución
      // llegara nula podía administrar las sesiones de aula de CUALQUIER
      // cliente — incluidas las de escritura (crear, arrancar, calificar).
      const uniEjercicio = exercise.course?.universityId ?? null;
      if (!user.universityId || !uniEjercicio || uniEjercicio !== user.universityId) {
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

    // Capital inicial: si el profesor lo configuró, cada empresa arranca con
    // dinero en el banco contra Capital Social. Se hace ANTES de pasar a
    // EN_CURSO para que ninguna empresa opere sin su aporte.
    const capitalSeeded = await this.seedInitialCapital(id, session.initialCapital, session.teacherId);

    await this.transition(id, ClassSessionStatus.LOBBY, ClassSessionStatus.EN_CURSO, {
      startedAt: new Date(),
    });
    return {
      status: ClassSessionStatus.EN_CURSO,
      attemptsCreated: participants.length,
      capitalSeeded,
    };
  }

  /**
   * Asienta el aporte de capital inicial en cada empresa de la sesión:
   * Banco (debe) contra Capital Social (haber).
   *
   * Idempotente por empresa: se marca con sourceType SESSION_INITIAL_CAPITAL y
   * sourceId de la sesión, así que reintentar el arranque no duplica el aporte.
   *
   * No toca ingresos ni IVA, así que el oráculo de auditoría —que compara
   * ventas declaradas contra comprobantes— no se ve afectado.
   */
  private async seedInitialCapital(
    sessionId: string,
    initialCapital: Prisma.Decimal | null,
    teacherId: string,
  ): Promise<number> {
    const monto = Number(initialCapital ?? 0);
    if (!monto || monto <= 0) return 0;

    const grupos = await this.prisma.classSessionCompany.findMany({
      where:   { classSessionId: sessionId },
      select:  { companyId: true, company: { select: { name: true } } },
    });

    const BANCO   = '1.1.01.02';
    const CAPITAL = '3.1.01.01';
    let sembradas = 0;

    for (const g of grupos) {
      // El par (sourceType, sourceId) es UNIQUE a nivel de BD y la guarda
      // anti-duplicados de createAutoEntry busca sin filtrar por empresa. Por
      // eso el sourceId lleva también la empresa: si fuera solo la sesión, la
      // primera empresa bloquearía el asiento de todas las demás.
      const sourceId = `${sessionId}:${g.companyId}`;

      // ¿Ya tiene su aporte? Entonces esto es un reintento.
      const yaTiene = await this.prisma.journalEntry.findFirst({
        where:  { companyId: g.companyId, sourceType: 'SESSION_INITIAL_CAPITAL', sourceId },
        select: { id: true },
      });
      if (yaTiene) continue;

      await this.prisma.$transaction(async (tx) => {
        await this.journal.createAutoEntry(
          g.companyId,
          `Aporte de capital inicial — ${g.company.name}`,
          new Date(),
          [
            { accountCode: BANCO,   debit: monto, credit: 0, description: 'Capital aportado por los socios' },
            { accountCode: CAPITAL, debit: 0, credit: monto, description: 'Capital social suscrito y pagado' },
          ],
          teacherId,
          JournalSource.MANUAL,
          tx,
          undefined, undefined,
          'SESSION_INITIAL_CAPITAL', sourceId,
        );
      });
      sembradas++;
    }

    if (sembradas > 0) {
      this.logger.log(`Sesión ${sessionId}: capital inicial de ${monto} sembrado en ${sembradas} empresa(s).`);
    }
    return sembradas;
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
    // FALLA CERRADO: antes, con `&&`, un usuario SIN institución asignada (o una
    // sesión cuya universidad no se resolvía) pasaba el filtro y podía unirse al
    // aula de otro cliente por código.
    const sessionUniversityId = session.exercise?.course?.universityId ?? null;
    if (!user.universityId || !sessionUniversityId || user.universityId !== sessionUniversityId) {
      throw new ForbiddenException('Esta sesión de aula pertenece a otra institución.');
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
  /**
   * Vista en vivo de la sesión. La sondean TODOS los participantes cada pocos
   * segundos, y todos reciben exactamente lo mismo: es la misma sesión.
   *
   * Sin caché, el costo crece con la cantidad de alumnos —30 estudiantes en un
   * aula son 30 veces las mismas consultas— y con 1500 usuarios eso solo no se
   * sostiene. Con una caché de pocos segundos el costo pasa a depender del
   * número de SESIONES activas, no de cuánta gente las mira.
   *
   * El TTL es corto a propósito: la vista puede ir unos segundos atrasada sin
   * que nadie lo note, pero no debe quedar pegada. Si Redis no está, se lee de
   * la base como siempre (falla abierto, nunca rompe la pantalla).
   */
  async live(id: string) {
    const clave = `sesion:live:${id}`;
    try {
      const guardado = await this.redis?.get?.(clave);
      if (guardado) return JSON.parse(guardado);
    } catch { /* Redis caído: se sigue contra la base */ }

    const datos = await this._liveDesdeBD(id);

    try {
      await this.redis?.setEx?.(clave, LIVE_TTL_SECONDS, JSON.stringify(datos));
    } catch { /* no poder cachear no es motivo para fallar */ }

    return datos;
  }

  private async _liveDesdeBD(id: string) {
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
      commercialCloseAt: session.commercialCloseAt,
      currency: session.currency,
      initialCapital: session.initialCapital,
      groups: groups.map(g => ({
        companyId: g.companyId,
        name: g.company.name,
        archetype: g.archetype,
        memberCount: countMap[g.companyId] ?? 0,
      })),
    };
  }

  /** Config de economía de la sesión (cap. 3). Solo referencia/visualización;
   *  NO siembra contabilidad. */
  async updateConfig(id: string, dto: { commercialCloseAt?: string | null; initialCapital?: number | null; currency?: string }) {
    await this.loadOrThrow(id);
    return this.prisma.classSession.update({
      where: { id },
      data: {
        ...(dto.commercialCloseAt !== undefined && { commercialCloseAt: dto.commercialCloseAt ? new Date(dto.commercialCloseAt) : null }),
        ...(dto.initialCapital !== undefined && { initialCapital: dto.initialCapital }),
        ...(dto.currency && { currency: dto.currency.slice(0, 8) }),
      },
      select: { id: true, commercialCloseAt: true, initialCapital: true, currency: true },
    });
  }

  // ════════════════════════════════════════════════════════════
  //  Ranking empresarial (Enterprise Score 0–1000) — spec cap. 9
  // ════════════════════════════════════════════════════════════
  // Score continuo derivado de la contabilidad real de cada empresa de la
  // sesión (reutiliza getValuation). Read-only, sin mutar nada.
  /**
   * Perfil público de una empresa de la sesión: quién es y, sobre todo, cómo
   * se comporta comercialmente.
   *
   * La reputación NO es un número arbitrario: sale de conducta verificable
   * dentro de la sesión. Si la empresa todavía no hizo negocios se devuelve
   * `null` en vez de un puntaje inventado — no tener historial no es lo mismo
   * que tener mal historial.
   */
  async companyProfile(sessionId: string, companyId: string) {
    await this.loadOrThrow(sessionId);

    // La empresa debe pertenecer a ESTA sesión: si no, este endpoint serviría
    // para espiar empresas de otras aulas.
    const link = await this.prisma.classSessionCompany.findFirst({
      where:   { classSessionId: sessionId, companyId },
      include: { company: { select: { id: true, name: true, economicActivity: true, createdAt: true } } },
    });
    if (!link) throw new NotFoundException('Esa empresa no participa en esta sesión.');

    const [vendidas, compradas, negociaciones, productos] = await Promise.all([
      this.prisma.procurementOrder.groupBy({
        by: ['status'], where: { sellerCompanyId: companyId }, _count: true,
      }),
      this.prisma.procurementOrder.groupBy({
        by: ['status'], where: { buyerCompanyId: companyId }, _count: true,
      }),
      this.prisma.negotiation.groupBy({
        by: ['status'],
        where: { OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }] },
        _count: true,
      }),
      this.prisma.product.findMany({
        where:  { companyId, isActive: true },
        select: { id: true, name: true, price: true, unit: true },
        orderBy: { name: 'asc' },
        take: 12,
      }),
    ]);

    const cuenta = (rows: Array<{ status: string; _count: number }>, estados: string[]) =>
      rows.filter(r => estados.includes(r.status)).reduce((s, r) => s + Number(r._count), 0);

    // Como VENDEDOR: de lo que le pidieron (sin contar cancelaciones), ¿cuánto
    // llegó a despachar? Mide si entrega lo que promete.
    const pedidas    = cuenta(vendidas as any, ['PO_ISSUED', 'DISPATCHED', 'RECEIVED', 'INVOICED', 'PAID']);
    const despachadas = cuenta(vendidas as any, ['DISPATCHED', 'RECEIVED', 'INVOICED', 'PAID']);

    // Como COMPRADOR: de lo que ya le facturaron, ¿cuánto pagó?
    const facturadas = cuenta(compradas as any, ['INVOICED', 'PAID']);
    const pagadas    = cuenta(compradas as any, ['PAID']);

    // Negociando: ¿cierra tratos o abandona conversaciones?
    const aceptadas = cuenta(negociaciones as any, ['ACEPTADA']);
    const cerradas  = cuenta(negociaciones as any, ['ACEPTADA', 'RECHAZADA', 'CANCELADA']);

    const pct = (parte: number, total: number) => total > 0 ? Math.round((parte / total) * 100) : null;
    const entrega   = pct(despachadas, pedidas);
    const pago      = pct(pagadas, facturadas);
    const seriedad  = pct(aceptadas, cerradas);

    // La reputación promedia solo las dimensiones con historial real.
    const dims = [entrega, pago, seriedad].filter((v): v is number => v !== null);
    const reputacion = dims.length ? Math.round(dims.reduce((s, v) => s + v, 0) / dims.length) : null;

    return {
      companyId:        link.company.id,
      name:             link.company.name,
      economicActivity: link.company.economicActivity,
      archetype:        link.archetype,
      reputacion,                       // null = todavía sin historial
      dimensiones: {
        entrega:  { valor: entrega,  despachadas, pedidas,    etiqueta: 'Entrega lo que vende' },
        pago:     { valor: pago,     pagadas,     facturadas, etiqueta: 'Paga lo que compra'   },
        seriedad: { valor: seriedad, aceptadas,   cerradas,   etiqueta: 'Cierra los tratos'    },
      },
      catalogo: productos.map(p => ({
        id: p.id, name: p.name, price: p.price.toString(), unit: p.unit,
      })),
    };
  }

  /**
   * Tabla de posiciones. Igual que `live()`: todos los participantes piden lo
   * mismo, pero acá el costo es peor —3 consultas fijas MÁS 2 por cada empresa
   * (la valoración)—, así que con 6 equipos son 15 consultas por sondeo y por
   * alumno. Se comparte unos segundos: el ranking cambia despacio y nadie nota
   * la diferencia, pero el costo deja de multiplicarse por estudiante.
   */
  async ranking(id: string) {
    const clave = `sesion:ranking:${id}`;
    try {
      const guardado = await this.redis?.get?.(clave);
      if (guardado) return JSON.parse(guardado);
    } catch { /* sin Redis se calcula igual */ }

    const datos = await this._rankingDesdeBD(id);

    try {
      await this.redis?.setEx?.(clave, RANKING_TTL_SECONDS, JSON.stringify(datos));
    } catch { /* no poder cachear no es motivo para fallar */ }

    return datos;
  }

  private async _rankingDesdeBD(id: string) {
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

    // Presencia: integrantes con ping reciente (≤ 90s) = "en línea".
    const onlineSince = new Date(Date.now() - 90 * 1000);
    const onlineCounts = await this.prisma.classSessionParticipant.groupBy({
      by: ['companyId'],
      where: { classSessionId: id, companyId: { not: null }, lastPingAt: { gte: onlineSince } },
      _count: true,
    });
    const onlineMap = onlineCounts.reduce<Record<string, number>>((acc, c) => {
      if (c.companyId) acc[c.companyId] = c._count as number;
      return acc;
    }, {});

    // Actividad operativa por empresa (cap. 10: el profesor ve quién trabaja).
    const companyIds = groups.map((g) => g.companyId);
    const [entryCounts, invoiceCounts] = await Promise.all([
      this.prisma.journalEntry.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds } }, _count: true }),
      this.prisma.invoice.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds } }, _count: true }),
    ]);
    const entryMap = entryCounts.reduce<Record<string, number>>((a, c) => { a[c.companyId] = c._count as number; return a; }, {});
    const invoiceMap = invoiceCounts.reduce<Record<string, number>>((a, c) => { a[c.companyId] = c._count as number; return a; }, {});

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
        onlineCount: onlineMap[g.companyId] ?? 0,
        activity: { entries: entryMap[g.companyId] ?? 0, invoices: invoiceMap[g.companyId] ?? 0 },
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
  //  Anuncios del profesor (noticias de la sesión) — spec Multiempresa
  // ════════════════════════════════════════════════════════════
  async createAnnouncement(id: string, dto: { title: string; body?: string; kind?: string }) {
    await this.loadOrThrow(id);
    const title = (dto.title ?? '').trim();
    if (!title) throw new BadRequestException('El anuncio necesita un título.');
    const kind = ['INFO', 'EVENTO', 'ALERTA'].includes((dto.kind ?? '').toUpperCase())
      ? (dto.kind as string).toUpperCase() : 'INFO';
    return this.prisma.sessionAnnouncement.create({
      data: { classSessionId: id, title: title.slice(0, 200), body: dto.body?.slice(0, 2000) || null, kind },
    });
  }

  async listAnnouncements(id: string) {
    return this.prisma.sessionAnnouncement.findMany({
      where:   { classSessionId: id },
      orderBy: { createdAt: 'desc' },
      take:    30,
    });
  }

  async deleteAnnouncement(id: string, announcementId: string) {
    await this.loadOrThrow(id);
    await this.prisma.sessionAnnouncement.deleteMany({ where: { id: announcementId, classSessionId: id } });
    return { message: 'Anuncio eliminado' };
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
