import {
  Controller, Get, Post, Patch, Body,
  Param, Query, Request, UseGuards, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { JournalService } from './journal.service';
import { JournalApprovalService } from './journal-approval.service';
import { AccountingModeResolver } from '../accounting/accounting-mode.resolver';
import {
  CreateJournalEntryDto,
  ReverseJournalEntryDto,
  JournalFilterDto,
} from './dto/journal.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/journal')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class JournalController {
  constructor(
    private readonly svc:          JournalService,
    private readonly approval:     JournalApprovalService,
    private readonly modeResolver: AccountingModeResolver,
  ) {}

  // GET — list journal entries (with optional filters)
  @Get()
  findAll(
    @Param('companyId') companyId: string,
    @Query() filter: JournalFilterDto,
  ) {
    return this.svc.findAll(companyId, filter);
  }

  // GET — pending entries (HYBRID mode review queue)
  @Get('pending')
  findPending(@Param('companyId') companyId: string) {
    return this.approval.findPending(companyId);
  }

  // GET — one entry with all lines
  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.findOne(companyId, id);
  }

  // POST — create manual entry
  //
  //   AUTOMATIC mode: BLOQUEADO para asientos genéricos. PERMITIDO si la
  //                   referencia es un ajuste (ADJ-) o asiento de cierre
  //                   (CIER-) — el sistema no los genera automáticamente
  //                   y son parte legítima del ciclo contable académico.
  //   MANUAL    mode: permitido (estudiante hace todo a mano).
  //   HYBRID    mode: permitido (puede agregar ajustes manuales además
  //                   de los pre-generados).
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateJournalEntryDto,
    @Request() req: any,
  ) {
    const mode = await this.modeResolver.forCompany(companyId);
    if (mode === 'AUTOMATIC') {
      const ref = (dto.reference || '').trim().toUpperCase();
      // ADJ- (ajustes), CIER- (cierre) y MAN- (asiento manual del estudiante) son
      // asientos legítimos del ciclo académico que el sistema NO genera solo. El
      // estudiante debe poder registrar asientos propios en el Diario aunque la
      // empresa esté en modo automático (spec UTN: "dejar crear asientos, no solo
      // dependientes de otros módulos").
      const isAcademic = ref.startsWith('ADJ-') || ref.startsWith('CIER-') || ref.startsWith('MAN-');
      if (!isAcademic) {
        throw new ForbiddenException(
          'Esta empresa está en modo AUTOMÁTICO. Los asientos genéricos se generan ' +
          'automáticamente desde facturas, cobros y pagos. ' +
          'Para registrar un asiento manual usa el botón "Nuevo asiento manual" del Diario ' +
          '(se etiqueta MAN-), o una referencia ADJ- (ajustes) o CIER- (cierre).',
        );
      }
    }
    return this.svc.createEntry(companyId, dto, req.user.id);
  }

  // POST — reverse entry (creates inverse entry, marks original)
  // Solo se pueden revertir asientos CONFIRMED. Los PENDING se rechazan
  // vía POST :id/reject; los REJECTED no necesitan reversal.
  @Post(':id/reverse')
  @HttpCode(HttpStatus.CREATED)
  reverse(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: ReverseJournalEntryDto,
    @Request() req: any,
  ) {
    return this.svc.reverseEntry(companyId, id, dto, req.user.id);
  }

  // ── HYBRID workflow ────────────────────────────────────────────

  // PATCH — confirmar un asiento PENDING → CONFIRMED
  @Patch(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.approval.confirmEntry(companyId, id, req.user.id);
  }

  // PATCH — rechazar un asiento PENDING → REJECTED
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.approval.rejectEntry(companyId, id, req.user.id, body?.reason);
  }
}
