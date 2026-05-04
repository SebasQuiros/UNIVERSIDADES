/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CALC LOCAL — espejo de backend/src/modules/tax-declarations/tax-declarations.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 *  Por qué existe: la página antes hacía un POST a /calculate en cada keystroke.
 *  Eso introducía una race condition (la respuesta antigua llegaba después de la
 *  nueva y reescribía el resultado correcto), por lo que al abrir el modal de
 *  "Presentar declaración" los totales podían aparecer en 0 o desactualizados,
 *  aunque en el PDF (que se calcula en backend) sí salieran bien.
 *
 *  Solución: calcular local-mente. La fórmula y los redondeos son IDÉNTICOS
 *  al servicio de NestJS para que persistencia y vista nunca se desincronicen.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const round = (n: number) => Math.round(n * 100) / 100;
const num   = (v: any) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.') || '0');
  return Number.isFinite(n) ? n : 0;
};

// ── D-104 IVA ────────────────────────────────────────────────────────────────
export interface D104Result {
  ivaVentas:  { t13: number; t8: number; t4: number; t2: number; t1: number };
  ivaCompras: { t13: number; t8: number; t4: number; t2: number; t1: number };
  cas301_debitoFiscal:  number;
  cas302_creditoFiscal: number;
  cas303_impuestoNeto:  number;
  cas304_impuestoPagar: number;
  cas305_saldoFavor:    number;
  totalVentas:  number;
  totalCompras: number;
}

export function calcD104(d: any): D104Result {
  const v13 = num(d.ventas13), v8 = num(d.ventas8), v4 = num(d.ventas4);
  const v2  = num(d.ventas2),  v1 = num(d.ventas1), vEx = num(d.ventasExentas);
  const c13 = num(d.compras13), c8 = num(d.compras8), c4 = num(d.compras4);
  const c2  = num(d.compras2),  c1 = num(d.compras1);

  const ivaV13 = round(v13 * 0.13), ivaV8 = round(v8 * 0.08);
  const ivaV4  = round(v4  * 0.04), ivaV2 = round(v2 * 0.02);
  const ivaV1  = round(v1  * 0.01);
  const debitoFiscal = round(ivaV13 + ivaV8 + ivaV4 + ivaV2 + ivaV1);

  const ivaC13 = round(c13 * 0.13), ivaC8 = round(c8 * 0.08);
  const ivaC4  = round(c4  * 0.04), ivaC2 = round(c2 * 0.02);
  const ivaC1  = round(c1  * 0.01);
  const creditoFiscal = round(ivaC13 + ivaC8 + ivaC4 + ivaC2 + ivaC1);

  const impuestoNeto = round(debitoFiscal - creditoFiscal);
  const totalVentas  = round(v13 + v8 + v4 + v2 + v1 + vEx);
  const totalCompras = round(c13 + c8 + c4 + c2 + c1);

  return {
    ivaVentas:  { t13: ivaV13, t8: ivaV8, t4: ivaV4, t2: ivaV2, t1: ivaV1 },
    ivaCompras: { t13: ivaC13, t8: ivaC8, t4: ivaC4, t2: ivaC2, t1: ivaC1 },
    cas301_debitoFiscal:  debitoFiscal,
    cas302_creditoFiscal: creditoFiscal,
    cas303_impuestoNeto:  impuestoNeto,
    cas304_impuestoPagar: impuestoNeto > 0 ? impuestoNeto : 0,
    cas305_saldoFavor:    impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0,
    totalVentas, totalCompras,
  };
}

// ── D-101 RENTA ──────────────────────────────────────────────────────────────
export interface TramoDetalle {
  tramo: string; base: number; tasa: number; impuesto: number;
}
export interface D101Result {
  cas103_ingresosGravables: number;
  gastoRepresentacionMaximo: number;
  cas210_totalGastos: number;
  cas301_rentaNeta: number;
  tipoEmpresa: 'PYME' | 'GRANDE';
  detalleTramos: TramoDetalle[];
  cas402_impuestoCalculado: number;
  cas503_totalCreditos: number;
  cas601_impuestoNeto: number;
  cas602_impuestoPagar: number;
  cas603_saldoFavor: number;
}

const RENTA_BRACKETS_2026 = [
  { hasta: 5_610_000,  rate: 0.05 },
  { hasta: 8_415_000,  rate: 0.10 },
  { hasta: 11_220_000, rate: 0.15 },
  { hasta: 14_875_000, rate: 0.20 },
  { hasta: 17_670_000, rate: 0.25 },
  { hasta: Infinity,   rate: 0.30 },
];
const RENTA_PYME_THRESHOLD = 122_145_000;

const fmtCR = (n: number) => n.toLocaleString('es-CR');

export function calcD101(d: any): D101Result {
  const ingresosBrutos    = num(d.ingresosBrutos);
  const ingresosExentos   = num(d.ingresosExentos);
  const ingresosGravables = Math.max(0, round(ingresosBrutos - ingresosExentos));

  const gSueldos       = num(d.gastosSueldos);
  const gCargas        = num(d.gastosCargas);
  const gAlquileres    = num(d.gastosAlquileres);
  const gServicios     = num(d.gastosServicios);
  const gDepreciacion  = num(d.gastosDepreciacion);
  const gPublicidad    = num(d.gastosPublicidad);
  const gSerPublicos   = num(d.gastosSerPublicos);
  const gRepMaximo     = round(ingresosBrutos * 0.01);
  const gRepresentacion = Math.min(num(d.gastosRepresentacion), gRepMaximo);
  const gOtros         = num(d.gastosOtros);

  const totalGastos = round(
    gSueldos + gCargas + gAlquileres + gServicios + gDepreciacion +
    gPublicidad + gSerPublicos + gRepresentacion + gOtros,
  );

  const rentaNeta = Math.max(0, round(ingresosGravables - totalGastos));
  const esPyme = ingresosBrutos <= RENTA_PYME_THRESHOLD;
  let impuestoCalculado = 0;
  const detalleTramos: TramoDetalle[] = [];

  if (rentaNeta > 0) {
    if (esPyme) {
      let base = rentaNeta;
      let anterior = 0;
      for (const tramo of RENTA_BRACKETS_2026) {
        if (base <= 0) break;
        const limiteTramo = tramo.hasta === Infinity ? rentaNeta : tramo.hasta;
        const baseTramo   = Math.min(base, limiteTramo - anterior);
        const impTramo    = round(baseTramo * tramo.rate);
        if (baseTramo > 0) {
          detalleTramos.push({
            tramo:    tramo.hasta === Infinity
              ? `Más de ₡${fmtCR(anterior)}`
              : `₡${fmtCR(anterior + 1)} a ₡${fmtCR(tramo.hasta)}`,
            base:     round(baseTramo),
            tasa:     tramo.rate * 100,
            impuesto: impTramo,
          });
        }
        impuestoCalculado += impTramo;
        base     -= baseTramo;
        anterior  = tramo.hasta === Infinity ? rentaNeta : tramo.hasta;
      }
      impuestoCalculado = round(impuestoCalculado);
    } else {
      impuestoCalculado = round(rentaNeta * 0.30);
      detalleTramos.push({
        tramo: 'Tarifa única (empresa grande)',
        base: rentaNeta, tasa: 30, impuesto: impuestoCalculado,
      });
    }
  }

  const retencionesSource = num(d.retencionesSource);
  const pagosParciales    = num(d.pagosParciales);
  const totalCreditos     = round(retencionesSource + pagosParciales);

  const impuestoNeto  = round(impuestoCalculado - totalCreditos);
  const impuestoPagar = impuestoNeto > 0 ? impuestoNeto : 0;
  const saldoFavor    = impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0;

  return {
    cas103_ingresosGravables: ingresosGravables,
    gastoRepresentacionMaximo: gRepMaximo,
    cas210_totalGastos: totalGastos,
    cas301_rentaNeta: rentaNeta,
    tipoEmpresa: esPyme ? 'PYME' : 'GRANDE',
    detalleTramos,
    cas402_impuestoCalculado: impuestoCalculado,
    cas503_totalCreditos: totalCreditos,
    cas601_impuestoNeto: impuestoNeto,
    cas602_impuestoPagar: impuestoPagar,
    cas603_saldoFavor: saldoFavor,
  };
}

// ── D-103 RETENCIÓN EN LA FUENTE ─────────────────────────────────────────────
export interface D103Result {
  retencionBienes: number;
  retencionServicios: number;
  cas301_totalRetencion: number;
  cas302_creditosCertificados: number;
  cas303_impuestoNeto: number;
  cas304_impuestoPagar: number;
  cas305_saldoFavor: number;
  totalBase: number;
}

export function calcD103(d: any): D103Result {
  const bienes3    = num(d.bienes3);
  const servicios8 = num(d.servicios8);

  const retencionBienes    = round(bienes3    * 0.03);
  const retencionServicios = round(servicios8 * 0.08);
  const totalRetencion     = round(retencionBienes + retencionServicios);

  const creditosCertificados = num(d.creditosCertificados);
  const impuestoNeto         = round(totalRetencion - creditosCertificados);

  return {
    retencionBienes, retencionServicios,
    cas301_totalRetencion:       totalRetencion,
    cas302_creditosCertificados: round(creditosCertificados),
    cas303_impuestoNeto:         impuestoNeto,
    cas304_impuestoPagar:        impuestoNeto > 0 ? impuestoNeto : 0,
    cas305_saldoFavor:           impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0,
    totalBase: round(bienes3 + servicios8),
  };
}

// ── D-115 DIVIDENDOS ─────────────────────────────────────────────────────────
export interface D115Result {
  impDivRes: number; impDivNoRes: number; impPart: number; impCap: number;
  cas301_totalBase: number;
  cas302_totalImpuesto: number;
  cas303_creditos: number;
  cas304_impuestoNeto: number;
  cas305_impuestoPagar: number;
  cas306_saldoFavor: number;
}

export function calcD115(d: any): D115Result {
  const dRes   = num(d.dividendosResidentes);
  const dNoRes = num(d.dividendosNoResidentes);
  const part   = num(d.participaciones);
  const cap    = num(d.rentasCapital);

  const impDivRes   = round(dRes   * 0.15);
  const impDivNoRes = round(dNoRes * 0.15);
  const impPart     = round(part   * 0.15);
  const impCap      = round(cap    * 0.15);

  const totalBase     = round(dRes + dNoRes + part + cap);
  const totalImpuesto = round(impDivRes + impDivNoRes + impPart + impCap);

  const creditosAnteriores = num(d.creditosAnteriores);
  const impuestoNeto       = round(totalImpuesto - creditosAnteriores);

  return {
    impDivRes, impDivNoRes, impPart, impCap,
    cas301_totalBase:     totalBase,
    cas302_totalImpuesto: totalImpuesto,
    cas303_creditos:      round(creditosAnteriores),
    cas304_impuestoNeto:  impuestoNeto,
    cas305_impuestoPagar: impuestoNeto > 0 ? impuestoNeto : 0,
    cas306_saldoFavor:    impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0,
  };
}
