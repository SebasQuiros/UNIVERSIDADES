import {
  Controller, Get, Param, Query,
  BadRequestException, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { HaciendaService, CabysItem, ExchangeRate } from './hacienda.service';

@ApiTags('Hacienda CR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hacienda')
export class HaciendaController {
  constructor(private readonly hacienda: HaciendaService) {}

  // ── CABYS search ───────────────────────────────────────────────────────────

  /**
   * GET /api/v1/hacienda/cabys/search?q=computadora&top=10
   * Full-text search in the Hacienda CABYS catalog.
   */
  @Get('cabys/search')
  @ApiOperation({ summary: 'Buscar en catálogo CABYS por descripción' })
  @ApiQuery({ name: 'q',   description: 'Término de búsqueda (mín. 2 caracteres)', required: true })
  @ApiQuery({ name: 'top', description: 'Número máximo de resultados (default 10, max 50)', required: false })
  async searchCabys(
    @Query('q')   q:   string,
    @Query('top') top: string,
  ): Promise<{ cabys: CabysItem[]; total: number; cached: boolean }> {
    if (!q || q.trim().length < 2) {
      throw new BadRequestException('El parámetro "q" debe tener al menos 2 caracteres');
    }

    const limit = Math.min(Number(top) || 10, 50);
    const items = await this.hacienda.searchCabys(q.trim(), limit);

    return { cabys: items, total: items.length, cached: false };
  }

  // ── CABYS by code ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/hacienda/cabys/:codigo
   * Look up a single CABYS item by its 13-digit code.
   */
  @Get('cabys/:codigo')
  @ApiOperation({ summary: 'Obtener item CABYS por código exacto (13 dígitos)' })
  @ApiParam({ name: 'codigo', description: 'Código CABYS de 13 dígitos' })
  async getCabysByCode(
    @Param('codigo') codigo: string,
  ): Promise<{ item: CabysItem | null; found: boolean }> {
    if (!/^\d{13}$/.test(codigo)) {
      throw new BadRequestException('El código CABYS debe tener exactamente 13 dígitos numéricos');
    }

    const item = await this.hacienda.getCabysByCode(codigo);
    return { item, found: item !== null };
  }

  // ── Exchange rate ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/hacienda/exchange-rate
   * Full exchange rate object (venta + compra + fecha).
   */
  @Get('exchange-rate')
  @ApiOperation({ summary: 'Tipo de cambio USD/CRC del BCCR vía Hacienda' })
  async getExchangeRate(): Promise<ExchangeRate & { source: string }> {
    const rate = await this.hacienda.getExchangeRate();
    return { ...rate, source: 'BCCR vía api.hacienda.go.cr' };
  }

  /**
   * GET /api/v1/hacienda/exchange-rate/usd
   * Simplified endpoint returning only the sell rate (venta).
   */
  @Get('exchange-rate/usd')
  @ApiOperation({ summary: 'Tipo de cambio venta USD (simplificado)' })
  async getUsdRate(): Promise<{
    currency: string;
    venta: number;
    compra: number;
    fecha: string;
    label: string;
    source: string;
  }> {
    const rate = await this.hacienda.getExchangeRate();
    return {
      currency: 'USD',
      venta:    rate.venta,
      compra:   rate.compra,
      fecha:    rate.fecha,
      label:    `₡${rate.venta.toFixed(2)} / $1`,
      source:   'BCCR',
    };
  }

  // ── Cédula validation ─────────────────────────────────────────────────────

  /**
   * GET /api/v1/hacienda/cedula/validate?cedula=1234567890&tipo=02
   */
  @Get('cedula/validate')
  @ApiOperation({ summary: 'Validar formato de cédula costarricense' })
  @ApiQuery({ name: 'cedula', description: 'Número de identificación', required: true })
  @ApiQuery({ name: 'tipo',   description: 'Tipo: 01=Física, 02=Jurídica, 03=DIMEX, 04=NITE', required: true })
  validateCedula(
    @Query('cedula') cedula: string,
    @Query('tipo')   tipo: string,
  ): { valid: boolean; cedula: string; tipo: string } {
    if (!cedula) throw new BadRequestException('El parámetro "cedula" es requerido');
    if (!['01', '02', '03', '04'].includes(tipo)) {
      throw new BadRequestException('El parámetro "tipo" debe ser 01, 02, 03 o 04');
    }

    const valid = this.hacienda.validateCedula(cedula, tipo as '01' | '02' | '03' | '04');
    return { valid, cedula, tipo };
  }
}
