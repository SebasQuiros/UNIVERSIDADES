import { Controller, Get, Query, Res, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { DownloadsService } from './downloads.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../auth/decorators/auth.decorators';

/**
 * Descargas por enlace firmado.
 *
 * La ruta es pública a propósito: la autorización viaja en el token, que se
 * emitió a un usuario que YA había pasado por el guard de la empresa. Eso es
 * lo que permite que el botón sea un `<a href download>` de verdad — ver
 * DownloadsService para por qué eso importa.
 *
 * El token ata empresa + recurso + tipo, así que no sirve para pedir otra
 * factura ni la de otra empresa.
 *
 * La ruta NO lleva `:companyId` a propósito: el guard global
 * CompanyEnabledGuard intercepta esas rutas y responderia 404 antes de llegar
 * acá.
 */
@Controller('descargas')
export class DownloadsController {
  constructor(
    private readonly svc: DownloadsService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('xml')
  async xml(@Query('t') token: string, @Res() res: Response) {
    const { companyId, recursoId, tipo } = this.svc.verificar(token);
    if (tipo !== 'factura-xml') throw new BadRequestException('Enlace de descarga inválido.');

    const factura = await this.prisma.invoice.findFirst({
      where:  { id: recursoId, companyId },
      select: { xml: true, status: true, consecutiveNumber: true },
    });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    if (!factura.xml || factura.status === 'DRAFT') {
      throw new BadRequestException('El XML no está disponible: la factura aún no fue emitida.');
    }

    // Nombre de archivo saneado: el consecutivo viene de la base, pero un
    // valor con comillas o saltos de linea partiria la cabecera en dos.
    const nombre = String(factura.consecutiveNumber ?? recursoId).replace(/[^\w.-]/g, '');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="FE-${nombre}.xml"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(factura.xml);
  }
}
