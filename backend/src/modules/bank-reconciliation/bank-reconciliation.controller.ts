import {
  Controller, Get, Post, Delete, Body, Param,
  Query, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { BankReconciliationService } from './bank-reconciliation.service';
import {
  CreateBankAccountDto,
  CreateBankTransactionDto,
  MatchTransactionDto,
  BankTransactionFilterDto,
} from './dto/bank-reconciliation.dto';
import { JwtAuthGuard }       from '../auth/guards/auth.guards';
import { CompanyOwnerGuard }  from '../../common/guards/company-owner.guard';

@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
@Controller('companies/:companyId')
export class BankReconciliationController {
  constructor(private readonly svc: BankReconciliationService) {}

  // ── Bank Accounts ────────────────────────────────────────────

  @Post('bank-accounts')
  @HttpCode(HttpStatus.CREATED)
  createBankAccount(
    @Param('companyId') companyId: string,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.svc.createBankAccount(companyId, dto);
  }

  @Get('bank-accounts')
  getBankAccounts(@Param('companyId') companyId: string) {
    return this.svc.getBankAccounts(companyId);
  }

  @Get('bank-accounts/:id')
  getBankAccount(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getBankAccount(id, companyId);
  }

  // ── Statements ───────────────────────────────────────────────

  @Post('bank-accounts/:bankAccountId/statements/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: undefined })) // memory storage
  uploadStatement(
    @Param('companyId')     companyId: string,
    @Param('bankAccountId') bankAccountId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No se recibió ningún archivo');
    }
    return this.svc.uploadStatement(companyId, bankAccountId, file);
  }

  @Get('bank-accounts/:bankAccountId/statements')
  getStatements(
    @Param('companyId')     companyId: string,
    @Param('bankAccountId') bankAccountId: string,
  ) {
    return this.svc.getStatements(companyId, bankAccountId);
  }

  @Get('bank-statements/:statementId')
  getStatement(
    @Param('companyId')    companyId: string,
    @Param('statementId')  statementId: string,
  ) {
    return this.svc.getStatement(statementId, companyId);
  }

  // ── Reconciliation Actions ───────────────────────────────────

  @Post('bank-statements/:statementId/auto-match')
  @HttpCode(HttpStatus.OK)
  autoMatch(
    @Param('companyId')   companyId: string,
    @Param('statementId') statementId: string,
  ) {
    return this.svc.autoMatch(statementId, companyId);
  }

  @Post('bank-statements/:statementId/match')
  @HttpCode(HttpStatus.OK)
  matchTransaction(
    @Param('companyId')   companyId: string,
    @Param('statementId') _statementId: string,
    @Body() dto: MatchTransactionDto,
  ) {
    return this.svc.matchTransaction(dto.statementLineId, dto.bankTransactionId, companyId);
  }

  @Delete('bank-statements/:statementId/match/:statementLineId')
  @HttpCode(HttpStatus.OK)
  unmatchTransaction(
    @Param('companyId')      companyId: string,
    @Param('statementId')    _statementId: string,
    @Param('statementLineId') statementLineId: string,
  ) {
    return this.svc.unmatchTransaction(statementLineId, companyId);
  }

  @Post('bank-statements/:statementId/ignore/:statementLineId')
  @HttpCode(HttpStatus.OK)
  ignoreLine(
    @Param('companyId')       companyId: string,
    @Param('statementId')     _statementId: string,
    @Param('statementLineId') statementLineId: string,
  ) {
    return this.svc.ignoreLine(statementLineId, companyId);
  }

  @Post('bank-statements/:statementId/complete')
  @HttpCode(HttpStatus.OK)
  completeReconciliation(
    @Param('companyId')   companyId: string,
    @Param('statementId') statementId: string,
  ) {
    return this.svc.completeReconciliation(statementId, companyId);
  }

  @Get('bank-statements/:statementId/status')
  getReconciliationStatus(
    @Param('companyId')   companyId: string,
    @Param('statementId') statementId: string,
  ) {
    return this.svc.getReconciliationStatus(statementId, companyId);
  }

  @Get('bank-statements/:statementId/export')
  async exportReconciliation(
    @Param('companyId')   companyId: string,
    @Param('statementId') statementId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.svc.exportReconciliation(statementId, companyId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="conciliacion-${statementId}.xlsx"`);
    res.send(buffer);
  }

  // ── Bank Transactions ────────────────────────────────────────

  @Post('bank-transactions')
  @HttpCode(HttpStatus.CREATED)
  createBankTransaction(
    @Param('companyId') companyId: string,
    @Body() dto: CreateBankTransactionDto,
  ) {
    return this.svc.createBankTransaction(companyId, dto);
  }

  @Get('bank-transactions')
  getTransactions(
    @Param('companyId') companyId: string,
    @Query() filter: BankTransactionFilterDto,
  ) {
    return this.svc.getTransactions(companyId, filter);
  }

  // ── Unreconciled transactions (scoped to a bank account) ──────

  @Get('bank-accounts/:bankAccountId/transactions/unreconciled')
  getUnreconciledTransactions(
    @Param('companyId')     companyId: string,
    @Param('bankAccountId') bankAccountId: string,
  ) {
    return this.svc.getUnreconciledTransactions(bankAccountId, companyId);
  }
}
