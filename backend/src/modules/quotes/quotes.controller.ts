import {
  Controller, Get, Post, Patch, Body, Param,
  Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quotes.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

/**
 * Cotizaciones / presupuestos, scoped por empresa. Mismo esquema de guards
 * que CreditNotesController / InvoicesController: JWT + ownership de la
 * empresa (STUDENT dueño/miembro; TEACHER/ADMIN read-only con aislamiento
 * de universidad).
 */
@Controller('companies/:companyId/quotes')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class QuotesController {
  constructor(private readonly svc: QuotesService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.list(companyId);
  }

  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.get(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateQuoteDto,
    @Request() req: any,
  ) {
    return this.svc.create(companyId, req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.svc.update(companyId, id, dto);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  send(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.send(companyId, id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.accept(companyId, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.reject(companyId, id);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.OK)
  convert(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.svc.convert(companyId, id, req.user.id);
  }
}
