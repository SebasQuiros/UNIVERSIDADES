/**
 * Verificación del motor de planilla contra una planilla real.
 *
 * Los valores esperados salen de "Planilla_Integral_PLANTILLA_EN_resuelto.xlsx",
 * resuelta a mano por un contador. No son invención: si el motor no reproduce
 * esas celdas exactamente, el motor está mal.
 *
 * Dos casos que entre ambos cubren todo el modelo:
 *   Roberto — ₡400.000 base + ₡350.000 comisiones, exento de renta, con
 *             viáticos y regalos no salariales.
 *   Alberto — ₡3.500.000, cuatro hijos, pensión alimenticia; cruza cuatro de
 *             los cinco tramos de renta.
 *
 * No toca la base de datos: el calculador es puro.
 */
import { PayrollCalculatorService } from '../src/modules/payroll/payroll-calculator.service';

let ok = 0;
let fallos = 0;
const detalle: string[] = [];

function chequear(nombre: string, obtenido: number, esperado: number, tol = 0.51) {
  const bien = Math.abs(obtenido - esperado) <= tol;
  if (bien) { ok++; console.log(`  ok   ${nombre}  = ${fmt(obtenido)}`); }
  else {
    fallos++;
    const msg = `${nombre}: obtenido ${fmt(obtenido)}, esperado ${fmt(esperado)}`;
    detalle.push(msg);
    console.log(`  FALLA ${msg}`);
  }
}

function chequearBool(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre} ${extra}`); console.log(`  FALLA ${nombre} ${extra}`); }
}

const fmt = (n: number) =>
  n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const calc = new PayrollCalculatorService();

console.log('===== TASAS =====');
chequear('carga patronal total 26,83%', calc.TASA_PATRONAL_TOTAL * 100, 26.83, 0.001);
chequear('cuota obrera total 10,83%', calc.TASA_OBRERA_TOTAL * 100, 10.83, 0.001);
chequearBool('cinco tramos de renta', calc.TRAMOS_RENTA.length === 5, `hay ${calc.TRAMOS_RENTA.length}`);
chequearBool('el tramo superior es 25%', calc.TRAMOS_RENTA[4].tarifa === 0.25);
chequear('crédito por hijo', calc.CREDITO_HIJO, 1710, 0);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n===== ROBERTO — ₡400.000 + ₡350.000 comisiones =====');
const roberto = calc.calcularLinea({
  salarioBase: 400_000,
  comisiones:  350_000,
  viaticos:     30_000,
  regalos:      80_000,
});

chequear('salario bruto (F6)', roberto.salarioBruto, 750_000);
chequear('SEM obrero 5,50% (G6)', roberto.cuotasObreras.sem, 41_250);
chequear('IVM obrero 4,33% (H6)', roberto.cuotasObreras.ivm, 32_475);
chequear('Banco Popular 1% (I6)', roberto.cuotasObreras.bancoPopular, 7_500);
chequear('impuesto de renta (J6) — exento', roberto.impuestoRenta, 0);
chequear('total deducciones (N6)', roberto.totalDeducciones, 81_225);
chequear('salario neto (O6)', roberto.salarioNeto, 668_775);
chequear('viáticos (P6)', roberto.viaticos, 30_000);
chequear('regalos (Q6)', roberto.regalos, 80_000);
chequear('total efectivo a pagar (R6)', roberto.totalEfectivoAPagar, 778_775);

console.log('  -- cargas patronales --');
chequear('SEM patrono 9,25% (S6)', roberto.cargasPatronales.sem, 69_375);
chequear('IVM patrono 5,58% (T6)', roberto.cargasPatronales.ivm, 41_850);
chequear('FODESAF 5% (U6)', roberto.cargasPatronales.fodesaf, 37_500);
chequear('INA 1,5% (V6)', roberto.cargasPatronales.ina, 11_250);
chequear('IMAS 0,5% (W6)', roberto.cargasPatronales.imas, 3_750);
chequear('Banco Popular patrono 0,5% (X6)', roberto.cargasPatronales.bancoPopularPatrono, 3_750);
chequear('FCL 3% (Y6)', roberto.cargasPatronales.fcl, 22_500);
chequear('ROP 1,25% (Z6)', roberto.cargasPatronales.rop, 9_375);
chequear('Banco Popular LPT 0,25% (AA6)', roberto.cargasPatronales.bancoPopularLpt, 1_875);
chequear('aguinaldo 8,33% (AB6)', roberto.provisionAguinaldo, 62_475);
chequear('vacaciones 4,16% (AC6)', roberto.provisionVacaciones, 31_200);
chequear('póliza INS 1,50% (AD6)', roberto.polizaINS, 11_250);
chequear('COSTO TOTAL PATRONO (AE6)', roberto.costoTotalPatrono, 1_056_150);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n===== ALBERTO — ₡3.500.000, 4 hijos, pensión ₡200.000 =====');
const alberto = calc.calcularLinea({
  salarioBase:        3_500_000,
  cantidadHijos:      4,
  pensionAlimenticia: 200_000,
  viaticos:            80_000,
});

chequear('salario bruto (F7)', alberto.salarioBruto, 3_500_000);
chequear('SEM obrero (G7)', alberto.cuotasObreras.sem, 192_500);
chequear('IVM obrero (H7)', alberto.cuotasObreras.ivm, 151_550);
chequear('Banco Popular (I7)', alberto.cuotasObreras.bancoPopular, 35_000);

console.log('  -- tramos del impuesto sobre la renta --');
const t = alberto.detalleRenta.tramos;
chequear('tramo 1 exento: monto (D30)', t[0].montoDelTramo, 918_000);
chequear('tramo 1: impuesto (E30)', t[0].impuesto, 0);
chequear('tramo 2 al 10%: monto (D31)', t[1].montoDelTramo, 429_000);
chequear('tramo 2: impuesto (E31)', t[1].impuesto, 42_900);
chequear('tramo 3 al 15%: monto (D32)', t[2].montoDelTramo, 1_017_000);
chequear('tramo 3: impuesto (E32)', t[2].impuesto, 152_550);
chequear('tramo 4 al 20%: monto (D33)', t[3].montoDelTramo, 1_136_000);
chequear('tramo 4: impuesto (E33)', t[3].impuesto, 227_200);
chequear('tramo 5 al 25%: monto (D34)', t[4].montoDelTramo, 0);
chequearBool('los tramos suman el salario bruto',
  Math.abs(t.reduce((s, x) => s + x.montoDelTramo, 0) - 3_500_000) < 0.51);
chequear('impuesto antes de créditos (E35)', alberto.detalleRenta.impuestoBruto, 422_650);
chequear('crédito por 4 hijos (B39)', alberto.detalleRenta.creditoHijos, 6_840);
chequear('IMPUESTO DE RENTA A PAGAR (B40 / J7)', alberto.impuestoRenta, 415_810);

chequear('pensión alimenticia (K7)', alberto.pensionAlimenticia, 200_000);
chequear('total deducciones (N7)', alberto.totalDeducciones, 994_860);
chequear('salario neto (O7)', alberto.salarioNeto, 2_505_140);
chequear('total efectivo a pagar (R7)', alberto.totalEfectivoAPagar, 2_585_140);
chequear('COSTO TOTAL PATRONO (AE7)', alberto.costoTotalPatrono, 4_928_700);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n===== TOTALES DE LA PLANILLA (fila 10) =====');
const tot = calc.totalizar([roberto, alberto]);
chequear('salario bruto (F10)', tot.salarioBruto, 4_250_000);
chequear('impuesto de renta (J10)', tot.impuestoRenta, 415_810);
chequear('pensión alimenticia (K10)', tot.pensionAlimenticia, 200_000);
chequear('total deducciones (N10)', tot.totalDeducciones, 1_076_085);
chequear('salario neto (O10)', tot.salarioNeto, 3_173_915);
chequear('viáticos (P10)', tot.viaticos, 110_000);
chequear('regalos (Q10)', tot.regalos, 80_000);
chequear('total efectivo a pagar (R10)', tot.totalEfectivoAPagar, 3_363_915);
chequear('cuotas obreras 10,83% (G10+H10+I10)', tot.cuotasObreras, 460_275);
chequear('cargas patronales 26,83%', tot.cargasPatronales, 1_140_275);
chequear('provisión aguinaldo (AB10)', tot.provisionAguinaldo, 354_025);
chequear('provisión vacaciones (AC10)', tot.provisionVacaciones, 176_800);
chequear('póliza INS (AD10)', tot.polizaINS, 63_750);
chequear('costo total patrono (AE10)', tot.costoTotalPatrono, 5_984_850);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n===== ASIENTO CONTABLE (hoja "Asiento Contable") =====');
const debe = [
  ['Gasto por salarios',                   tot.salarioBruto,        4_250_000],
  ['Gasto por cargas patronales CCSS',     tot.cargasPatronales,    1_140_275],
  ['Gasto por provisión de aguinaldo',     tot.provisionAguinaldo,    354_025],
  ['Gasto por provisión de vacaciones',    tot.provisionVacaciones,   176_800],
  ['Gasto por póliza del INS',             tot.polizaINS,              63_750],
  ['Gasto por viáticos (no salarial)',     tot.viaticos,              110_000],
  ['Gasto por regalos (no salarial)',      tot.regalos,                80_000],
] as const;
for (const [nombre, obtenido, esperado] of debe) chequear('DEBE  ' + nombre, obtenido, esperado);

const haber = [
  ['Cargas patronales CCSS por pagar',     tot.cargasPatronales,    1_140_275],
  ['Cuotas obreras por pagar',             tot.cuotasObreras,         460_275],
  ['Impuesto de renta por pagar',          tot.impuestoRenta,         415_810],
  ['Pensión alimenticia por pagar',        tot.pensionAlimenticia,    200_000],
  ['Ahorro asociación por pagar',          tot.ahorroAsociacion,            0],
  ['Préstamo asociación por pagar',        tot.prestamoAsociacion,          0],
  ['Provisión de aguinaldo por pagar',     tot.provisionAguinaldo,    354_025],
  ['Provisión de vacaciones por pagar',    tot.provisionVacaciones,   176_800],
  ['INS por pagar',                        tot.polizaINS,              63_750],
  ['Banco (efectivo a pagar)',             tot.totalEfectivoAPagar, 3_363_915],
] as const;
for (const [nombre, obtenido, esperado] of haber) chequear('HABER ' + nombre, obtenido, esperado);

const sumaDebe  = debe.reduce((s, [, v]) => s + (v as number), 0);
const sumaHaber = haber.reduce((s, [, v]) => s + (v as number), 0);
chequear('SUMAS IGUALES — debe', sumaDebe, 6_174_850);
chequear('SUMAS IGUALES — haber', sumaHaber, 6_174_850);
chequearBool('el asiento cuadra', Math.abs(sumaDebe - sumaHaber) < 0.51,
  `debe=${fmt(sumaDebe)} haber=${fmt(sumaHaber)}`);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n===== CASOS BORDE =====');
const conConyuge = calc.calcularLinea({ salarioBase: 1_500_000, tieneConyuge: true });
const sinConyuge = calc.calcularLinea({ salarioBase: 1_500_000 });
chequear('el crédito por cónyuge rebaja ₡2.580',
  sinConyuge.impuestoRenta - conConyuge.impuestoRenta, 2_580);

const bajito = calc.calcularLinea({ salarioBase: 900_000, cantidadHijos: 5 });
chequear('los créditos no vuelven negativo el impuesto', bajito.impuestoRenta, 0);

const cero = calc.calcularLinea({ salarioBase: 0 });
chequear('salario cero no rompe nada', cero.costoTotalPatrono, 0);
chequearBool('salario cero no se marca bajo el mínimo', cero.bajoSalarioMinimo === false);

const minimo = calc.calcularLinea({ salarioBase: 300_000 });
chequearBool('avisa cuando el salario está bajo el mínimo', minimo.bajoSalarioMinimo === true);

const tope = calc.calcularLinea({ salarioBase: 6_000_000 });
chequear('el tramo del 25% se activa sobre ₡4.727.000',
  tope.detalleRenta.tramos[4].montoDelTramo, 1_273_000);

console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
if (fallos) { console.log('FALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
process.exit(fallos ? 1 : 0);
