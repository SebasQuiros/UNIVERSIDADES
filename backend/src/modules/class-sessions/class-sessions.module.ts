import { Module } from '@nestjs/common';
import { ClassSessionsController } from './class-sessions.controller';
import { ClassSessionsParticipantsController } from './class-sessions-participants.controller';
import { ClassSessionsAuditController } from './class-sessions-audit.controller';
import { ClassSessionsService } from './class-sessions.service';
import { ClassSessionsOracleService } from './class-sessions-oracle.service';
import { ClassSessionGuard } from './guards/class-session-access.guard';
import { AuditAssignmentGuard } from './guards/audit-assignment.guard';
import { CompanyMembershipsModule } from '../company-memberships/company-memberships.module';
import { ReportsModule } from '../reports/reports.module';
import { CompaniesModule } from '../companies/companies.module';
import { JournalModule } from '../journal/journal.module';

/**
 * ClassSessionsModule — "Sesión de Aula" (Kahoot-like sobre Exercise + GROUP).
 * Orquesta grupos/B2B/tributación existentes (por inyección de service) y agrega
 * el lobby, el snapshot congelado y el esqueleto del oráculo de auditoría.
 */
@Module({
  imports: [CompanyMembershipsModule, ReportsModule, CompaniesModule, JournalModule],
  controllers: [
    ClassSessionsController,
    ClassSessionsParticipantsController,
    ClassSessionsAuditController,
  ],
  providers: [
    ClassSessionsService,
    ClassSessionsOracleService,
    ClassSessionGuard,
    AuditAssignmentGuard,
  ],
  exports: [ClassSessionsService, ClassSessionsOracleService],
})
export class ClassSessionsModule {}
