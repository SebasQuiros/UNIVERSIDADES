import {
  Controller, Get, Post, Body, Param,
  Query, Request, UseGuards, HttpCode,
  HttpStatus, Res, NotFoundException,
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

  // GET — serve PDF file. El disco es efímero (Railway); getPdfPath()
  // regenera el archivo desde el respaldo en BD (pdfData) si ya no está.
  // Sigue sin ser multi-réplica-safe (cada instancia tiene su propio disco) —
  // para eso hace falta almacenamiento compartido real (S3/R2/volumen
  // compartido), pero cubre el caso real hoy: 1 réplica + redeploys.
  @Get(':id/pdf')
  async getPdf(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfPath = await this.svc.getPdfPath(companyId, id);

    // El PDF se guarda en uploads/pdfs/<companyId>/FE-xxx.pdf. Servirlo con
    // path.basename() lo buscaba en uploads/pdfs/FE-xxx.pdf —sin la carpeta de
    // la empresa— asi que NUNCA lo encontraba: la descarga fallaba para todas
    // las facturas emitidas. El basename estaba ahi para cortar un ../, pero
    // se llevo por delante tambien el segmento que hace falta.
    //
    // Se conserva la proteccion sin romper la ruta: se comprueba que el
    // archivo caiga dentro de uploads/pdfs y se sirve relativo a esa raiz, de
    // modo que un path manipulado no puede escaparse.
    const raiz = path.resolve(path.join(process.cwd(), 'uploads', 'pdfs'));
    const absoluto = path.resolve(pdfPath);
    if (absoluto !== raiz && !absoluto.startsWith(raiz + path.sep)) {
      throw new NotFoundException('El archivo PDF no se encontró en el servidor.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura-${id}.pdf"`);

    // sendFile falla de forma asincrona: sin callback la peticion se queda
    // colgada y quien descarga solo ve un spinner eterno.
    res.sendFile(path.relative(raiz, absoluto), { root: raiz }, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({
          statusCode: 404,
          message: 'El archivo PDF no se encontró en el servidor.',
        });
      }
    });
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
