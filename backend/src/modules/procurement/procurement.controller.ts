import {
  Controller, Get, Post, Param, Body, Query, UseGuards, Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { ProcurementService } from './procurement.service';
import { CreateProcurementOrderDto } from './dto/procurement.dto';

@UseGuards(JwtAuthGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly svc: ProcurementService) {}

  // Comprador emite una Orden de Compra.
  @Post('orders')
  create(@Body() dto: CreateProcurementOrderDto, @Request() req: any) {
    return this.svc.createOrder(dto, req.user.id);
  }

  // Órdenes donde la empresa es comprador o vendedor.
  @Get('orders')
  list(@Query('companyId') companyId: string, @Request() req: any) {
    if (!companyId) {
      throw new BadRequestException('El parámetro "companyId" es obligatorio.');
    }
    return this.svc.listForCompany(companyId, req.user.id);
  }

  @Post('orders/:id/dispatch')
  dispatch(@Param('id') id: string, @Request() req: any) {
    return this.svc.dispatch(id, req.user.id);
  }

  @Post('orders/:id/receive')
  receive(@Param('id') id: string, @Request() req: any) {
    return this.svc.receive(id, req.user.id);
  }

  @Post('orders/:id/invoice')
  invoice(@Param('id') id: string, @Request() req: any) {
    return this.svc.invoice(id, req.user.id);
  }

  @Post('orders/:id/pay')
  pay(@Param('id') id: string, @Request() req: any) {
    return this.svc.pay(id, req.user.id);
  }

  @Post('orders/:id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.svc.cancel(id, req.user.id);
  }
}
