import {
  Injectable, NotFoundException,
  ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/companies.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma:   PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  // ── Get company by student ────────────────────────────────────
  // Fase 1: incluye companies INDIVIDUAL (dueño directo) + GROUP donde
  // el estudiante figura en CompanyMembership.
  async findByStudent(studentId: string) {
    return this.prisma.company.findMany({
      where: {
        OR: [
          { studentId },
          { memberships: { some: { userId: studentId } } },
        ],
      },
      include: {
        // attempt es null para GROUP — el frontend debe tolerarlo.
        attempt: {
          select: { id: true, status: true, exercise: { select: { id: true, title: true } } },
        },
        // Para GROUP companies devolvemos el exercise directo y un flag de membership.
        exercise: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Get company by attempt ────────────────────────────────────
  // Acceso permitido a:
  //   · El estudiante dueño de la empresa
  //   · TEACHER / ADMIN / SUPERADMIN (con aislamiento por universidad)
  // Esto es consistente con CompanyOwnerGuard usado en los endpoints
  // /companies/:companyId/* — el profesor puede VER las empresas de sus
  // estudiantes para calificar.
  async findByAttempt(attemptId: string, userId: string, userRole = 'STUDENT', universityId?: string | null) {
    const company = await this.prisma.company.findUnique({
      where: { attemptId },
      include: {
        student: { select: { universityId: true } },
      },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada para este intento');

    // SUPERADMIN: acceso global
    if (userRole === 'SUPERADMIN') return company;

    // STUDENT: dueño INDIVIDUAL o miembro GROUP.
    if (userRole === 'STUDENT') {
      if (company.studentId === userId) return company;
      const member = await this.prisma.companyMembership.findUnique({
        where: { companyId_userId: { companyId: company.id, userId } },
        select: { id: true },
      });
      if (!member) {
        throw new ForbiddenException('No tienes acceso a esta empresa');
      }
      return company;
    }

    // TEACHER / ADMIN: solo si pertenece a su misma universidad
    if (userRole === 'TEACHER' || userRole === 'ADMIN') {
      if (universityId && company.student?.universityId !== universityId) {
        throw new ForbiddenException('No tienes acceso a empresas de otras universidades');
      }
      return company;
    }

    throw new ForbiddenException('No tienes acceso a esta empresa');
  }

  // ── Get one company ───────────────────────────────────────────
  // Fase 1: estudiantes pueden acceder si son dueños INDIVIDUAL o miembros GROUP.
  // El check global lo hace CompanyOwnerGuard; este método es defensivo para
  // callers que llaman al service directamente.
  async findOne(companyId: string, studentId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: {
          where:  { userId: studentId },
          select: { id: true },
          take:   1,
        },
      },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const isOwnerIndividual =
      company.mode === 'INDIVIDUAL' && company.studentId === studentId;
    const isMemberGroup =
      company.mode === 'GROUP' && company.memberships.length > 0;
    if (!isOwnerIndividual && !isMemberGroup) {
      throw new ForbiddenException('No tienes acceso a esta empresa');
    }
    // No exponemos `memberships` al caller — fue solo para auth.
    const { memberships: _m, ...rest } = company;
    return rest;
  }

  // ── Create company + seed chart of accounts ───────────────────
  async create(attemptId: string, studentId: string, dto: CreateCompanyDto) {
    // Verify attempt belongs to student
    const attempt = await this.prisma.exerciseAttempt.findFirst({
      where: { id: attemptId, studentId },
    });
    if (!attempt) {
      throw new NotFoundException('Intento de ejercicio no encontrado');
    }

    // One company per attempt
    const existing = await this.prisma.company.findUnique({
      where: { attemptId },
    });
    if (existing) {
      throw new ConflictException(
        'Ya existe una empresa para este ejercicio. Solo se permite una empresa por intento.',
      );
    }

    // Create company
    const company = await this.prisma.company.create({
      data: {
        attemptId,
        studentId,
        name:             dto.name,
        legalId:          dto.legalId,
        legalIdType:      dto.legalIdType,
        economicActivity: dto.economicActivity,
        address:          dto.address ?? null,
        phone:            dto.phone   ?? null,
        email:            dto.email   ?? null,
        currency:         'CRC',
      },
    });

    // Seed chart of accounts automatically (50 accounts)
    await this.accounts.seedChartOfAccounts(company.id);

    return company;
  }

  // ── Update company info ───────────────────────────────────────
  async update(companyId: string, dto: UpdateCompanyDto) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name    && { name:    dto.name    }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone   !== undefined && { phone:   dto.phone   }),
        ...(dto.email   !== undefined && { email:   dto.email   }),
        updatedAt: new Date(),
      },
    });
  }

  // ── Dashboard summary ─────────────────────────────────────────
  async getDashboard(companyId: string) {
    const [invoices, clients, products, entries] = await Promise.all([
      this.prisma.invoice.count({
        where: { companyId, status: { not: 'DRAFT' as any } },
      }),
      this.prisma.client.count({ where: { companyId, isActive: true } }),
      this.prisma.product.count({ where: { companyId, isActive: true } }),
      this.prisma.journalEntry.count({ where: { companyId, isReversed: false } }),
    ]);

    const totalSales = await this.prisma.invoice.aggregate({
      where: { companyId, status: { not: 'DRAFT' as any } },
      _sum:  { total: true },
    });

    const recentInvoices = await this.prisma.invoice.findMany({
      where:   { companyId },
      orderBy: { createdAt: 'desc' },
      take:    5,
      select: {
        id: true, consecutiveNumber: true, clientName: true,
        total: true, status: true, haciendaStatus: true, createdAt: true,
      },
    });

    return {
      totals: {
        invoices,
        clients,
        products,
        journalEntries: entries,
        totalSales: totalSales._sum.total ?? 0,
      },
      recentInvoices,
    };
  }
}
