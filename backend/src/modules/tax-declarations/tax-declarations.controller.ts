import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { TaxDeclarationsService } from './tax-declarations.service';
import { TaxDeclarationsPdfService } from './tax-declarations-pdf.service';
import {
  CreateTaxDeclarationDto, SubmitTaxDeclarationDto,
  AddAttachmentDto, CalculateTaxDto, CalculateD104FromCompanyDto,
} from './dto/tax-declarations.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CurrentUser } from '../auth/decorators/auth.decorators';

@Controller('tax-declarations')
@UseGuards(JwtAuthGuard)
export class TaxDeclarationsController {
  constructor(
    private readonly svc: TaxDeclarationsService,
    private readonly pdfSvc: TaxDeclarationsPdfService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.svc.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOne(id, user.id);
  }

  @Post()
  create(@Body() dto: CreateTaxDeclarationDto, @CurrentUser() user: any) {
    return this.svc.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: SubmitTaxDeclarationDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.update(id, user.id, dto);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.submit(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.remove(id, user.id);
  }

  // Endpoint de cálculo en tiempo real (sin guardar)
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculate(@Body() dto: CalculateTaxDto) {
    return this.svc.calculate(dto.type as any, dto.formData ?? {});
  }

  // Descargar PDF de la declaración (funciona en DRAFT y SUBMITTED)
  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const decl = await this.svc.findOneWithUser(id, user.id);
    const buffer = await this.pdfSvc.generate({
      type:        decl.type,
      period:      decl.period,
      referenceNo: decl.referenceNo,
      submittedAt: decl.submittedAt,
      formData:    decl.formData as any,
      result:      decl.result as any,
      user:        decl.user,
    });
    const safePeriod = decl.period.replace(/[^\w-]/g, '');
    const filename = `${decl.type}-${safePeriod}${decl.referenceNo ? '-' + decl.referenceNo : ''}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  // D-104 automático desde facturas de la empresa (con crédito fiscal)
  @Post('d104/calculate')
  @HttpCode(HttpStatus.OK)
  calculateD104FromCompany(@Body() dto: CalculateD104FromCompanyDto, @CurrentUser() user: any) {
    return this.svc.calculateD104FromCompany(dto.companyId, dto.month, dto.year, user.id);
  }

  // ── Adjuntos (comprobantes) ───────────────────────────────────────

  @Get(':id/attachments')
  listAttachments(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.listAttachments(id, user.id);
  }

  @Post(':id/attachments')
  addAttachment(
    @Param('id') id: string,
    @Body() dto: AddAttachmentDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.addAttachment(id, user.id, dto);
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const att = await this.svc.getAttachment(id, attachmentId, user.id);
    const buffer = Buffer.from(att.fileData, 'base64');
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${att.fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.removeAttachment(id, attachmentId, user.id);
  }
}
