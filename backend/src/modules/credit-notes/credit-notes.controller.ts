import {
  Controller, Get, Post, Body, Param,
  Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { CreateCreditNoteDto } from './dto/credit-notes.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

/**
 * Notas de crédito, scoped por empresa. Mismo esquema de guards que
 * InvoicesController / ProductsController: JWT + ownership de la empresa
 * (STUDENT dueño/miembro; TEACHER/ADMIN read-only con aislamiento de universidad).
 */
@Controller('companies/:companyId/credit-notes')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class CreditNotesController {
  constructor(private readonly svc: CreditNotesService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.listCreditNotes(companyId);
  }

  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.getCreditNote(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateCreditNoteDto,
    @Request() req: any,
  ) {
    return this.svc.createCreditNote(companyId, req.user.id, dto);
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  issue(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.svc.issueCreditNote(companyId, id, req.user.id);
  }
}
