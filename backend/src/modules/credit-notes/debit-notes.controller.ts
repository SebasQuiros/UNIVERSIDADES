import {
  Controller, Get, Post, Body, Param,
  Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { CreateDebitNoteDto } from './dto/credit-notes.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

/**
 * Notas de débito, scoped por empresa. Mismos guards que CreditNotesController.
 */
@Controller('companies/:companyId/debit-notes')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class DebitNotesController {
  constructor(private readonly svc: CreditNotesService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.listDebitNotes(companyId);
  }

  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.getDebitNote(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateDebitNoteDto,
    @Request() req: any,
  ) {
    return this.svc.createDebitNote(companyId, req.user.id, dto);
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  issue(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.svc.issueDebitNote(companyId, id, req.user.id);
  }
}
