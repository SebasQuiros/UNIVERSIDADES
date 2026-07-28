import {
  Controller, Get, Patch, Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

/**
 * Endpoints read-only del módulo de inventario (Fase 2).
 *
 * Las mutaciones se hacen indirectamente via:
 *   - Compra de proveedor (PurchaseInvoicesService) → addLot
 *   - Emisión/aceptación de factura (InvoicesService) → consumeFIFO
 *
 * Acá solo exponemos:
 *   - GET valuation (totales por producto al costo)
 *   - GET lots por producto (lotes activos)
 *   - GET movements por producto (kardex)
 */
@Controller('companies/:companyId/inventory')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('valuation')
  valuation(@Param('companyId') companyId: string) {
    return this.svc.valuation(companyId);
  }

  @Get('products/:productId/lots')
  lots(
    @Param('companyId') companyId: string,
    @Param('productId') productId: string,
  ) {
    return this.svc.lotsForProduct(companyId, productId);
  }

  @Get('products/:productId/movements')
  movements(
    @Param('companyId') companyId: string,
    @Param('productId') productId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.movements(companyId, productId, {
      from: from ? new Date(from) : undefined,
      to:   to   ? new Date(to)   : undefined,
    });
  }

  /** Kardex (tarjeta de existencias) de un producto: entradas/salidas/saldo. */
  @Get('products/:productId/kardex')
  kardex(
    @Param('companyId') companyId: string,
    @Param('productId') productId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.kardex(companyId, productId, {
      from: from ? new Date(from) : undefined,
      to:   to   ? new Date(to)   : undefined,
    });
  }

  /** Método de valuación vigente (PEPS/UEPS/PROMEDIO). */
  @Get('cost-method')
  getCostMethod(@Param('companyId') companyId: string) {
    return this.svc.getCostMethod(companyId);
  }

  /** Cambia el método de valuación de la empresa. */
  @Patch('cost-method')
  setCostMethod(
    @Param('companyId') companyId: string,
    @Body() dto: { costMethod: 'PEPS' | 'UEPS' | 'PROMEDIO' },
  ) {
    return this.svc.setCostMethod(companyId, dto.costMethod);
  }
}
