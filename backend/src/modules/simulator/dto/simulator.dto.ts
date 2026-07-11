import { IsIn, IsInt, IsNumber, Max, Min } from 'class-validator';

/**
 * Sectores económicos soportados por el simulador. El outlook por sector se
 * deriva determinísticamente de los indicadores macro reales (ver
 * EconomicSimulationService).
 */
export const SIMULATOR_SECTORS = [
  'comercio',
  'servicios',
  'tecnologia',
  'manufactura',
  'alimentos',
  'construccion',
  'transporte',
] as const;

export type SimulatorSector = (typeof SIMULATOR_SECTORS)[number];

/**
 * Perfil de la empresa ficticia que el estudiante quiere evaluar.
 * Todos los montos en la moneda base (₡). El análisis es una PROYECCIÓN
 * separada — no toca los libros contables.
 */
export class AnalyzeCompanyDto {
  @IsIn(SIMULATOR_SECTORS as unknown as string[])
  sector: SimulatorSector;

  /** Precio de venta por unidad. */
  @IsNumber()
  @Min(0)
  unitPrice: number;

  /** Costo variable por unidad. */
  @IsNumber()
  @Min(0)
  unitCost: number;

  /** Costos fijos mensuales (alquiler, salarios base, etc.). */
  @IsNumber()
  @Min(0)
  monthlyFixedCosts: number;

  /** Inversión inicial (CAPEX + capital de trabajo). */
  @IsNumber()
  @Min(0)
  initialInvestment: number;

  /** Nivel de innovación del producto/servicio (1 = commodity, 5 = disruptivo). */
  @IsInt()
  @Min(1)
  @Max(5)
  innovationLevel: number;

  /** Nivel de competencia en el mercado (1 = casi monopolio, 5 = saturado). */
  @IsInt()
  @Min(1)
  @Max(5)
  competitionLevel: number;

  /** Tamaño de mercado mensual estimado en unidades (mercado alcanzable). */
  @IsNumber()
  @Min(0)
  estimatedMarketSizeUnits: number;
}
