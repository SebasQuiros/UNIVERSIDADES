import { Injectable } from '@nestjs/common';

/**
 * Motor de cálculo de planilla — Costa Rica.
 *
 * Servicio puro, sin Prisma: se puede probar contra una planilla real celda
 * por celda, que es exactamente como se verificó (ver qa/planilla.spec-manual).
 *
 * Reemplaza a una versión anterior cuyas tasas no correspondían a Costa Rica:
 * la carga patronal daba 22.17% en vez de 26.83% —FODESAF estaba al 0.50% en
 * lugar del 5%, faltaba el ROP y el IVM obrero estaba en 3.84% en vez de
 * 4.33%— y el impuesto sobre la renta se calculaba sobre el salario menos la
 * CCSS, cuando la retención de asalariados se aplica sobre el bruto. Un
 * estudiante que aprendiera con esos números aprendería mal.
 *
 * Cubre lo que de verdad lleva una planilla costarricense: comisiones y horas
 * extra, las tres cuotas obreras, los cinco tramos de renta con los créditos
 * familiares, pensión alimenticia, ahorro y préstamo de asociación
 * solidarista, pagos no salariales, las nueve cargas patronales, las
 * provisiones de aguinaldo y vacaciones, y la póliza de riesgos del trabajo.
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Las nueve cargas que paga el patrono, más la póliza del INS aparte. */
export interface CargasPatronales {
  /** CCSS 14.83% */
  sem: number;              // Seguro de Enfermedad y Maternidad — 9.25%
  ivm: number;              // Invalidez, Vejez y Muerte          — 5.58%
  /** Otras instituciones sociales 7.50% */
  fodesaf: number;          // 5.00%
  ina: number;              // 1.50%
  imas: number;             // 0.50%
  bancoPopularPatrono: number; // 0.50%
  /** Ley de Protección al Trabajador 4.50% */
  fcl: number;              // Fondo de Capitalización Laboral — 3.00%
  rop: number;              // Régimen Obligatorio de Pensiones — 1.25%
  bancoPopularLpt: number;  // 0.25%
  /** Suma de las nueve: 26.83% del bruto. */
  total: number;
}

/** Las tres cuotas que se le retienen al trabajador: 10.83%. */
export interface CuotasObreras {
  sem: number;          // 5.50%
  ivm: number;          // 4.33%
  bancoPopular: number; // 1.00%
  total: number;
}

export interface TramoRenta {
  desde: number;
  hasta: number | null;   // null = sin tope
  tarifa: number;
  /** Parte del salario que cae dentro de este tramo. */
  montoDelTramo: number;
  /** Impuesto que aporta este tramo. */
  impuesto: number;
}

export interface DetalleRenta {
  /** Base sobre la que se aplican los tramos: el salario bruto. */
  baseImponible: number;
  tramos: TramoRenta[];
  /** Impuesto antes de restar los créditos familiares. */
  impuestoBruto: number;
  creditoConyuge: number;
  creditoHijos: number;
  totalCreditos: number;
  /** Nunca negativo: los créditos no generan devolución. */
  impuestoNeto: number;
}

/** Lo que entra en el cálculo de una línea de planilla. */
export interface EntradaPlanilla {
  salarioBase: number;
  comisiones?: number;
  horasExtra?: number;
  bonoFijo?: number;

  // Situación familiar — mueve el impuesto sobre la renta.
  tieneConyuge?: boolean;
  cantidadHijos?: number;

  // Deducciones propias de cada persona.
  pensionAlimenticia?: number;
  /** Ahorro de asociación solidarista, como porcentaje del bruto (ej. 0.05). */
  tasaAhorroAsociacion?: number;
  prestamoAsociacion?: number;
  otrasDeducciones?: number;

  // Pagos que NO son salario: no cotizan ni pagan renta, pero sí se entregan.
  viaticos?: number;
  regalos?: number;
}

export interface LineaPlanillaCalculada {
  // Devengado
  salarioBase: number;
  comisiones: number;
  horasExtra: number;
  bonoFijo: number;
  salarioBruto: number;

  // Deducciones del trabajador
  cuotasObreras: CuotasObreras;
  impuestoRenta: number;
  pensionAlimenticia: number;
  ahorroAsociacion: number;
  prestamoAsociacion: number;
  otrasDeducciones: number;
  totalDeducciones: number;
  salarioNeto: number;

  // No salariales y efectivo entregado
  viaticos: number;
  regalos: number;
  totalEfectivoAPagar: number;

  // Costo del patrono
  cargasPatronales: CargasPatronales;
  provisionAguinaldo: number;   // 8.33%
  provisionVacaciones: number;  // 4.16%
  polizaINS: number;            // 1.50%
  /** Bruto + cargas + provisiones + póliza. Lo que de verdad cuesta la persona. */
  costoTotalPatrono: number;

  detalleRenta: DetalleRenta;
  /** true si el salario base queda por debajo del mínimo de ley. */
  bajoSalarioMinimo: boolean;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class PayrollCalculatorService {
  // ── Cargas patronales: 26.83% ───────────────────────────────────────────────
  readonly PATRONO = {
    sem:                 0.0925,
    ivm:                 0.0558,
    fodesaf:             0.0500,
    ina:                 0.0150,
    imas:                0.0050,
    bancoPopularPatrono: 0.0050,
    fcl:                 0.0300,
    rop:                 0.0125,
    bancoPopularLpt:     0.0025,
  } as const;

  /** 26.83% — se calcula, no se escribe a mano, para que no se desfase. */
  readonly TASA_PATRONAL_TOTAL =
    Object.values(this.PATRONO).reduce((a, b) => a + b, 0);

  // ── Cuotas obreras: 10.83% ──────────────────────────────────────────────────
  readonly OBRERO = {
    sem:          0.0550,
    ivm:          0.0433,
    bancoPopular: 0.0100,
  } as const;

  readonly TASA_OBRERA_TOTAL =
    Object.values(this.OBRERO).reduce((a, b) => a + b, 0);

  // ── Provisiones y póliza ────────────────────────────────────────────────────
  /** Un mes de salario por año: 1/12. Se declara como 8.33% porque así se
   *  presenta en las planillas y así lo espera el asiento contable. */
  readonly TASA_AGUINALDO  = 0.0833;
  /** Dos semanas por año: 4.16%. */
  readonly TASA_VACACIONES = 0.0416;
  /** Póliza de Riesgos del Trabajo del INS. Varía según la actividad; 1.50%
   *  es la tasa de referencia para oficina/servicios. */
  readonly TASA_INS = 0.0150;

  /** Salario mínimo mensual, trabajador no calificado. */
  readonly SALARIO_MINIMO = 381_000;

  // ── Impuesto sobre la renta de asalariados ─────────────────────────────────
  //
  // Cinco tramos mensuales. Ojo: se aplican sobre el salario BRUTO. La cuota
  // obrera de la CCSS no se resta antes —ese es un error frecuente y estaba
  // metido en la versión anterior de este archivo.
  readonly TRAMOS_RENTA: Array<{ desde: number; hasta: number | null; tarifa: number }> = [
    { desde: 0,         hasta: 918_000,   tarifa: 0.00 },
    { desde: 918_000,   hasta: 1_347_000, tarifa: 0.10 },
    { desde: 1_347_000, hasta: 2_364_000, tarifa: 0.15 },
    { desde: 2_364_000, hasta: 4_727_000, tarifa: 0.20 },
    { desde: 4_727_000, hasta: null,      tarifa: 0.25 },
  ];

  /** Créditos familiares mensuales que se restan del impuesto ya calculado. */
  readonly CREDITO_CONYUGE = 2_580;
  readonly CREDITO_HIJO    = 1_710;

  // ── Cálculo de una línea ───────────────────────────────────────────────────

  calcularLinea(entrada: EntradaPlanilla): LineaPlanillaCalculada {
    const salarioBase = this.n(entrada.salarioBase);
    const comisiones  = this.n(entrada.comisiones);
    const horasExtra  = this.n(entrada.horasExtra);
    const bonoFijo    = this.n(entrada.bonoFijo);

    // Todo lo salarial cotiza y paga renta. Los viáticos y regalos no.
    const salarioBruto = this.r(salarioBase + comisiones + horasExtra + bonoFijo);

    // ── Deducciones del trabajador ──
    const cuotasObreras: CuotasObreras = {
      sem:          this.r(salarioBruto * this.OBRERO.sem),
      ivm:          this.r(salarioBruto * this.OBRERO.ivm),
      bancoPopular: this.r(salarioBruto * this.OBRERO.bancoPopular),
      total:        0,
    };
    cuotasObreras.total = this.r(
      cuotasObreras.sem + cuotasObreras.ivm + cuotasObreras.bancoPopular,
    );

    const detalleRenta = this.calcularRenta(
      salarioBruto,
      !!entrada.tieneConyuge,
      Math.max(0, Math.trunc(this.n(entrada.cantidadHijos))),
    );

    const pensionAlimenticia = this.r(entrada.pensionAlimenticia);
    const ahorroAsociacion   = this.r(salarioBruto * this.n(entrada.tasaAhorroAsociacion));
    const prestamoAsociacion = this.r(entrada.prestamoAsociacion);
    const otrasDeducciones   = this.r(entrada.otrasDeducciones);

    const totalDeducciones = this.r(
      cuotasObreras.total +
      detalleRenta.impuestoNeto +
      pensionAlimenticia +
      ahorroAsociacion +
      prestamoAsociacion +
      otrasDeducciones,
    );
    const salarioNeto = this.r(salarioBruto - totalDeducciones);

    // ── No salariales ──
    const viaticos = this.r(entrada.viaticos);
    const regalos  = this.r(entrada.regalos);
    const totalEfectivoAPagar = this.r(salarioNeto + viaticos + regalos);

    // ── Costo del patrono ──
    const cargasPatronales: CargasPatronales = {
      sem:                 this.r(salarioBruto * this.PATRONO.sem),
      ivm:                 this.r(salarioBruto * this.PATRONO.ivm),
      fodesaf:             this.r(salarioBruto * this.PATRONO.fodesaf),
      ina:                 this.r(salarioBruto * this.PATRONO.ina),
      imas:                this.r(salarioBruto * this.PATRONO.imas),
      bancoPopularPatrono: this.r(salarioBruto * this.PATRONO.bancoPopularPatrono),
      fcl:                 this.r(salarioBruto * this.PATRONO.fcl),
      rop:                 this.r(salarioBruto * this.PATRONO.rop),
      bancoPopularLpt:     this.r(salarioBruto * this.PATRONO.bancoPopularLpt),
      total:               0,
    };
    cargasPatronales.total = this.r(
      cargasPatronales.sem + cargasPatronales.ivm + cargasPatronales.fodesaf +
      cargasPatronales.ina + cargasPatronales.imas + cargasPatronales.bancoPopularPatrono +
      cargasPatronales.fcl + cargasPatronales.rop + cargasPatronales.bancoPopularLpt,
    );

    const provisionAguinaldo  = this.r(salarioBruto * this.TASA_AGUINALDO);
    const provisionVacaciones = this.r(salarioBruto * this.TASA_VACACIONES);
    const polizaINS           = this.r(salarioBruto * this.TASA_INS);

    const costoTotalPatrono = this.r(
      salarioBruto + cargasPatronales.total +
      provisionAguinaldo + provisionVacaciones + polizaINS,
    );

    return {
      salarioBase, comisiones, horasExtra, bonoFijo, salarioBruto,
      cuotasObreras,
      impuestoRenta: detalleRenta.impuestoNeto,
      pensionAlimenticia, ahorroAsociacion, prestamoAsociacion, otrasDeducciones,
      totalDeducciones, salarioNeto,
      viaticos, regalos, totalEfectivoAPagar,
      cargasPatronales, provisionAguinaldo, provisionVacaciones, polizaINS,
      costoTotalPatrono,
      detalleRenta,
      bajoSalarioMinimo: salarioBase > 0 && salarioBase < this.SALARIO_MINIMO,
    };
  }

  /**
   * Impuesto sobre la renta de asalariados, tramo por tramo.
   *
   * Se devuelve el desglose completo —incluidos los tramos en cero— porque en
   * un simulador contable el estudiante tiene que VER por qué paga lo que
   * paga, no solo el total.
   */
  calcularRenta(salarioBruto: number, tieneConyuge: boolean, cantidadHijos: number): DetalleRenta {
    const tramos: TramoRenta[] = this.TRAMOS_RENTA.map((t) => {
      const techo = t.hasta === null ? salarioBruto : Math.min(salarioBruto, t.hasta);
      const montoDelTramo = Math.max(0, this.r(techo - t.desde));
      return {
        desde: t.desde,
        hasta: t.hasta,
        tarifa: t.tarifa,
        montoDelTramo,
        impuesto: this.r(montoDelTramo * t.tarifa),
      };
    });

    const impuestoBruto = this.r(tramos.reduce((s, t) => s + t.impuesto, 0));

    const creditoConyuge = tieneConyuge ? this.CREDITO_CONYUGE : 0;
    const creditoHijos   = this.r(cantidadHijos * this.CREDITO_HIJO);
    const totalCreditos  = this.r(creditoConyuge + creditoHijos);

    // Los créditos rebajan el impuesto, pero nunca lo vuelven negativo: no
    // existe devolución por tener familia.
    const impuestoNeto = Math.max(0, this.r(impuestoBruto - totalCreditos));

    return {
      baseImponible: salarioBruto,
      tramos,
      impuestoBruto,
      creditoConyuge,
      creditoHijos,
      totalCreditos,
      impuestoNeto,
    };
  }

  /** Totales de la planilla completa, para el encabezado y el asiento. */
  totalizar(lineas: LineaPlanillaCalculada[]) {
    const sum = (f: (l: LineaPlanillaCalculada) => number) =>
      this.r(lineas.reduce((s, l) => s + f(l), 0));

    return {
      salarioBruto:        sum((l) => l.salarioBruto),
      cuotasObreras:       sum((l) => l.cuotasObreras.total),
      impuestoRenta:       sum((l) => l.impuestoRenta),
      pensionAlimenticia:  sum((l) => l.pensionAlimenticia),
      ahorroAsociacion:    sum((l) => l.ahorroAsociacion),
      prestamoAsociacion:  sum((l) => l.prestamoAsociacion),
      otrasDeducciones:    sum((l) => l.otrasDeducciones),
      totalDeducciones:    sum((l) => l.totalDeducciones),
      salarioNeto:         sum((l) => l.salarioNeto),
      viaticos:            sum((l) => l.viaticos),
      regalos:             sum((l) => l.regalos),
      totalEfectivoAPagar: sum((l) => l.totalEfectivoAPagar),
      cargasPatronales:    sum((l) => l.cargasPatronales.total),
      provisionAguinaldo:  sum((l) => l.provisionAguinaldo),
      provisionVacaciones: sum((l) => l.provisionVacaciones),
      polizaINS:           sum((l) => l.polizaINS),
      costoTotalPatrono:   sum((l) => l.costoTotalPatrono),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private n(v: number | undefined | null): number {
    const x = Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
  }

  private r(v: number | undefined | null): number {
    return Math.round(this.n(v) * 100) / 100;
  }
}
