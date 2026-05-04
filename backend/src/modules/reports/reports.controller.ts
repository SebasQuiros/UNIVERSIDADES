import { Controller, Get, Param, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';
import { ReportFilterDto } from './dto/reports.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/reports')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class ReportsController {
  constructor(
    private readonly svc: ReportsService,
    private readonly exportSvc: ReportsExportService,
  ) {}

  // ── T-Accounts ────────────────────────────────────────────────────────────
  @Get('t-accounts')
  tAccounts(
    @Param('companyId') id: string,
    @Query('periodId')   periodId?: string,
    @Query('startDate')  startDate?: string,
    @Query('endDate')    endDate?: string,
    @Query('type')       type?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE',
    @Query('accountIds') accountIds?: string,
  ) {
    const ids = accountIds
      ? accountIds.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;
    return this.svc.getTAccounts(id, { periodId, startDate, endDate, type, accountIds: ids });
  }

  // ── JSON endpoints (existing) ─────────────────────────────────────────────
  @Get('trial-balance')
  trialBalance(@Param('companyId') id: string, @Query() f: ReportFilterDto) {
    return this.svc.getTrialBalance(id, f);
  }

  @Get('balance-sheet')
  balanceSheet(@Param('companyId') id: string, @Query() f: ReportFilterDto) {
    return this.svc.getBalanceSheet(id, f);
  }

  @Get('income-statement')
  incomeStatement(@Param('companyId') id: string, @Query() f: ReportFilterDto) {
    return this.svc.getIncomeStatement(id, f);
  }

  @Get('journal-book')
  journalBook(@Param('companyId') id: string, @Query() f: ReportFilterDto) {
    return this.svc.getJournalBook(id, f);
  }

  // ── Export endpoints ──────────────────────────────────────────────────────

  // Balance General — Excel
  @Get('balance-sheet/excel')
  async balanceSheetExcel(
    @Param('companyId') id: string,
    @Query() f: ReportFilterDto,
    @Res() res: Response,
  ) {
    const data    = await this.svc.getBalanceSheet(id, f);
    const buffer  = await this.exportSvc.generateBalanceSheetExcel(data, data.company.name);
    const date    = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="balance-general-${date}.xlsx"`);
    res.send(buffer);
  }

  // Balance General — PDF
  @Get('balance-sheet/pdf')
  async balanceSheetPdf(
    @Param('companyId') id: string,
    @Query() f: ReportFilterDto,
    @Res() res: Response,
  ) {
    const data   = await this.svc.getBalanceSheet(id, f);
    const buffer = await this.exportSvc.generateBalanceSheetPdf(data, data.company.name);
    const date   = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="balance-general-${date}.pdf"`);
    res.send(buffer);
  }

  // Estado de Resultados — Excel
  @Get('income-statement/excel')
  async incomeStatementExcel(
    @Param('companyId') id: string,
    @Query() f: ReportFilterDto,
    @Res() res: Response,
  ) {
    const data   = await this.svc.getIncomeStatement(id, f);
    const buffer = await this.exportSvc.generateIncomeStatementExcel(data, data.company.name);
    const date   = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="estado-resultados-${date}.xlsx"`);
    res.send(buffer);
  }

  // Estado de Resultados — PDF
  @Get('income-statement/pdf')
  async incomeStatementPdf(
    @Param('companyId') id: string,
    @Query() f: ReportFilterDto,
    @Res() res: Response,
  ) {
    const data   = await this.svc.getIncomeStatement(id, f);
    const buffer = await this.exportSvc.generateIncomeStatementPdf(data, data.company.name);
    const date   = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="estado-resultados-${date}.pdf"`);
    res.send(buffer);
  }

  // Balance de Comprobación — Excel
  @Get('trial-balance/excel')
  async trialBalanceExcel(
    @Param('companyId') id: string,
    @Query() f: ReportFilterDto,
    @Res() res: Response,
  ) {
    const data   = await this.svc.getTrialBalance(id, f);
    const buffer = await this.exportSvc.generateTrialBalanceExcel(data, data.company.name);
    const date   = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="balance-comprobacion-${date}.xlsx"`);
    res.send(buffer);
  }

  // Libro Diario — Excel
  @Get('journal-book/excel')
  async journalBookExcel(
    @Param('companyId') id: string,
    @Query() f: ReportFilterDto,
    @Res() res: Response,
  ) {
    const data   = await this.svc.getJournalBook(id, f);
    const buffer = await this.exportSvc.generateJournalBookExcel(data, data.company.name);
    const date   = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="libro-diario-${date}.xlsx"`);
    res.send(buffer);
  }
}
