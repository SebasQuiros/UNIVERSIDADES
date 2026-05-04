import {
  Controller, Get, Post, Body, Param,
  Query, Request, UseGuards, HttpCode,
  HttpStatus, Res,
} from '@nestjs/common';
import * as path from 'path';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, InvoiceFilterDto } from './dto/invoices.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/invoices')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  // GET — list invoices with optional filters
  @Get()
  findAll(
    @Param('companyId') companyId: string,
    @Query() filter: InvoiceFilterDto,
  ) {
    return this.svc.findAll(companyId, filter);
  }

  // GET — one invoice with all lines
  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.findOne(companyId, id);
  }

  // POST — create draft invoice
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateInvoiceDto,
    @Request() req: any,
  ) {
    return this.svc.create(companyId, req.user.id, dto);
  }

  // POST — issue invoice (the full 10-step flow)
  // No DELETE, No PATCH on issued invoices — immutable
  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  issue(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.svc.issue(companyId, id, req.user.id);
  }

  // POST — duplicate rejected invoice as new DRAFT
  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  duplicate(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.svc.duplicate(companyId, id, req.user.id);
  }

  // GET — serve PDF file
  // TODO(production): PDFs are stored on the local container filesystem.
  // Replace with object storage (S3/MinIO/R2) before multi-instance or
  // stateless deployment. See invoices.service → getPdfPath().
  @Get(':id/pdf')
  async getPdf(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfPath = await this.svc.getPdfPath(companyId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura-${id}.pdf"`);
    const filename = path.basename(pdfPath); // only the filename, no directory traversal
    const pdfDir = path.join(process.cwd(), 'uploads', 'pdfs');
    res.sendFile(filename, { root: pdfDir });
  }

  // GET — download Hacienda XML (v4.4)
  @Get(':id/xml')
  async downloadXml(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const xml = await this.svc.getInvoiceXml(companyId, id);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${id}.xml"`);
    res.send(xml);
  }

  // GET — validate invoice for Hacienda compliance
  @Get(':id/validate')
  validate(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.svc.validateInvoice(companyId, id);
  }
}
