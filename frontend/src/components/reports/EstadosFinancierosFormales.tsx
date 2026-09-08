'use client';

import React from 'react';

/**
 * Estados financieros en el formato formal que se usa en Costa Rica.
 *
 * Reemplaza una presentación de tarjetas de colores que era legible pero no
 * era la que el estudiante se va a encontrar en la práctica. Un estado
 * financiero costarricense tiene una forma reconocible, y esa forma es parte
 * de lo que hay que aprender:
 *
 *   · encabezado con razón social, cédula jurídica, dirección y teléfono
 *   · título, período y la leyenda "(Expresado en colones costarricenses)"
 *   · columna de NOTA junto a cada rubro
 *   · cifras comparativas del período anterior y la variación en monto y en %
 *   · el pie con la leyenda de las notas y la referencia a las NIIF
 *   · los espacios de firma: representante legal, contador y auditor externo
 *
 * El Estado de Resultados va escalonado —ingresos, utilidad bruta, utilidad
 * operativa, utilidad antes de impuestos, utilidad neta— y el Estado de
 * Situación va a dos columnas, activos a la izquierda y pasivos con
 * patrimonio a la derecha, que es como se presenta y como se ve de un vistazo
 * que la ecuación contable cierra.
 *
 * La estructura (qué cuenta cae en qué rubro) la sigue armando el backend en
 * `classified` / `structured`. Aquí solo se dibuja.
 */

// ── Paleta ───────────────────────────────────────────────────────────────────
// Azul marino y azules claros: es el código de color de los estados formales.
// Sin verdes ni rosados; el color no debe competir con las cifras.
const C = {
  cabecera:   'bg-[#2E4A66] text-white',
  seccion:    'bg-[#E8EDF2] text-[#1F3348]',
  subtotal:   'bg-[#D6E3EF] text-[#1F3348]',
  resultado:  'bg-[#C2D5E8] text-[#16293C]',
  final:      'bg-[#2E4A66] text-white',
  borde:      'border-[#C9D6E2]',
};

const num = (v: any) => Number(v ?? 0);

/** Cifra al estilo de un estado impreso: negativos entre paréntesis, cero como guion. */
function cifra(v: any, mostrarCero = false): string {
  const n = num(v);
  if (n === 0 && !mostrarCero) return '-';
  const abs = Math.abs(n).toLocaleString('es-CR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return n < 0 ? `(${abs})` : abs;
}

function porcentaje(v: any): string {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(1)}%`;
}

/** Celda numérica: tipografía tabular para que las columnas se alineen. */
function Cifra({ v, className = '' }: { v: any; className?: string }) {
  return (
    <td className={`px-3 py-[3px] text-right font-mono text-[12px] tabular-nums ${className}`}>
      {cifra(v)}
    </td>
  );
}

interface Props {
  data: any;
  companyName?: string;
  /** Numeración de notas: arranca donde diga el estado. */
  primeraNota?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Encabezado y pie, compartidos por los dos estados
// ─────────────────────────────────────────────────────────────────────────────

function Encabezado({
  empresa, titulo, subtitulo,
}: { empresa: any; titulo: string; subtitulo: string }) {
  return (
    <header className="mb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold uppercase tracking-tight text-gray-900">
            {empresa?.name ?? 'Nombre de la empresa'}
          </p>
          {empresa?.legalId && (
            <p className="text-[11px] text-gray-600">Cédula Jurídica: {empresa.legalId}</p>
          )}
          <p className="text-[11px] text-gray-600">
            Dirección: {empresa?.address?.trim() || 'San José, Costa Rica'}
          </p>
          {empresa?.phone && <p className="text-[11px] text-gray-600">Tel: {empresa.phone}</p>}
        </div>
      </div>

      <div className="mt-3 text-center">
        <h2 className="text-[19px] font-extrabold uppercase tracking-tight text-gray-900">
          {titulo}
        </h2>
        <p className="text-[12px] text-gray-700">{subtitulo}</p>
        <p className="text-[11px] text-gray-500">(Expresado en colones costarricenses)</p>
      </div>
    </header>
  );
}

function Pie({ tipo }: { tipo: 'resultados' | 'situacion' }) {
  const Firma = ({ rol, extra }: { rol: string; extra?: string }) => (
    <div className="flex-1 text-center">
      <div className="mx-auto mb-1 w-full max-w-[220px] border-t border-gray-500" />
      <p className="text-[11px] text-gray-700">Nombre</p>
      <p className="text-[11px] font-semibold text-gray-800">{rol}</p>
      {extra && <p className="text-[10px] text-gray-500">{extra}</p>}
    </div>
  );

  return (
    <footer className="mt-6">
      <p className="text-[10.5px] text-gray-600">
        Las notas adjuntas son parte integral de estos estados financieros.
      </p>
      <p className="text-[10.5px] text-gray-600">
        El presente {tipo === 'resultados' ? 'estado de resultados' : 'estado de situación financiera'}{' '}
        ha sido preparado de conformidad con las Normas Internacionales de Información
        Financiera (NIIF) vigentes en Costa Rica.
      </p>

      <div className="mt-8 flex flex-wrap gap-6">
        <Firma rol="Representante Legal" />
        <Firma rol="Contador(a)" extra={tipo === 'situacion' ? 'CPI N.º XXXXX' : undefined} />
        <Firma rol="Auditor(a) Externo(a)" extra="(si aplica)" />
      </div>
    </footer>
  );
}

/** Aviso cuando el estado no cierra: en un estado formal esto no puede pasar callado. */
function Descuadre({ mensaje }: { mensaje: string }) {
  return (
    <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
      {mensaje}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DE RESULTADOS
// ─────────────────────────────────────────────────────────────────────────────

export function EstadoResultadosFormal({ data, companyName, primeraNota = 18 }: Props) {
  const s = data?.structured;
  const comp = data?.comparativo;
  const hayComparativo = !!comp;

  const desde = data?.period?.startDate ? new Date(data.period.startDate) : null;
  const hasta = data?.period?.endDate ? new Date(data.period.endDate) : null;
  const fLarga = (d: Date | null) =>
    d ? d.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

  const empresa = { ...(data?.company ?? {}), name: companyName ?? data?.company?.name };

  // Cada rubro lleva su número de nota, correlativo, igual que en un estado real.
  let nota = primeraNota;
  const siguienteNota = () => nota++;

  // 4 columnas sin comparativo (detalle, nota, monto) y 6 con él.
  const totalCols = hayComparativo ? 6 : 3;

  const FilaSeccion = ({ titulo, nota: n }: { titulo: string; nota?: number }) => (
    <tr className={C.seccion}>
      <td className="px-3 py-[5px] text-[12px] font-bold uppercase">{titulo}</td>
      <td className="px-2 py-[5px] text-center text-[11px] font-semibold">{n ?? ''}</td>
      <td colSpan={totalCols - 2} />
    </tr>
  );

  const FilaCuenta = ({ a, sangria = 2 }: { a: any; sangria?: number }) => (
    <tr className="border-b border-gray-100">
      <td className="py-[3px] pr-3 text-[12px] text-gray-700" style={{ paddingLeft: `${sangria * 12}px` }}>
        {a.name}
      </td>
      <td className="px-2 text-center text-[11px] text-gray-500">{a.nota ?? ''}</td>
      <Cifra v={a.amount} className="text-gray-800" />
      {hayComparativo && <Cifra v={a.anterior} className="text-gray-600" />}
      {hayComparativo && <Cifra v={a.variacion?.monto} className="text-gray-600" />}
      {hayComparativo && (
        <td className="px-3 py-[3px] text-right font-mono text-[12px] tabular-nums text-gray-600">
          {porcentaje(a.variacion?.porcentaje)}
        </td>
      )}
    </tr>
  );

  const FilaSubtotal = ({
    titulo, valor, anterior, variacion, nota: n, tono = C.subtotal, sangria = 1,
  }: any) => (
    <tr className={`${tono} border-y ${C.borde}`}>
      <td className="py-[4px] pr-3 text-[12px] font-bold" style={{ paddingLeft: `${sangria * 12}px` }}>
        {titulo}
      </td>
      <td className="px-2 text-center text-[11px] font-semibold">{n ?? ''}</td>
      <Cifra v={valor} className="font-bold" />
      {hayComparativo && <Cifra v={anterior} className="font-bold" />}
      {hayComparativo && <Cifra v={variacion?.monto} className="font-bold" />}
      {hayComparativo && (
        <td className="px-3 py-[4px] text-right font-mono text-[12px] font-bold tabular-nums">
          {porcentaje(variacion?.porcentaje)}
        </td>
      )}
    </tr>
  );

  const bloques = s?.bloques ?? [];

  return (
    <article className="mx-auto max-w-5xl bg-white px-6 py-6 text-gray-900">
      <Encabezado
        empresa={empresa}
        titulo="Estado de Resultados"
        subtitulo={
          desde && hasta
            ? `Por el período comprendido del ${fLarga(desde)} al ${fLarga(hasta)}`
            : 'Por el período'
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className={C.cabecera}>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide">Detalle</th>
              <th className="px-2 py-2 text-center text-[11px] font-bold uppercase">Nota</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold">
                {comp?.etiquetaActual ?? ''}<br /><span className="font-normal">¢</span>
              </th>
              {hayComparativo && (
                <th className="px-3 py-2 text-right text-[11px] font-bold">
                  {comp.etiquetaAnterior}<br /><span className="font-normal">¢</span>
                </th>
              )}
              {hayComparativo && (
                <th className="px-3 py-2 text-center text-[11px] font-bold uppercase" colSpan={2}>
                  Variación
                </th>
              )}
            </tr>
            {hayComparativo && (
              <tr className={C.cabecera}>
                <th colSpan={4} />
                <th className="px-3 pb-1 text-right text-[10px] font-normal">¢</th>
                <th className="px-3 pb-1 text-right text-[10px] font-normal">%</th>
              </tr>
            )}
          </thead>

          <tbody>
            {bloques.map((b: any) => {
              const notaBloque = siguienteNota();
              const esFinal = b.numero === bloques.length;
              return (
                <React.Fragment key={b.numero}>
                  <FilaSeccion titulo={b.titulo} nota={notaBloque} />

                  {(b.grupos ?? []).length === 0 ? (
                    <tr className="border-b border-gray-100">
                      <td className="py-[3px] pl-6 text-[11px] italic text-gray-400">
                        Sin movimiento en el período
                      </td>
                      <td colSpan={totalCols - 1} />
                    </tr>
                  ) : (
                    (b.grupos ?? []).map((g: any, gi: number) => (
                      <React.Fragment key={gi}>
                        {/* Un grupo con varias cuentas se abre; con una sola,
                            repetir el nombre dos veces sería ruido. */}
                        {(g.accounts ?? []).length > 1 ? (
                          <>
                            <tr>
                              <td className="py-[3px] pl-4 text-[12px] font-semibold text-gray-800">
                                {g.label}
                              </td>
                              <td colSpan={totalCols - 1} />
                            </tr>
                            {(g.accounts ?? []).map((a: any, ai: number) => (
                              <FilaCuenta key={ai} a={a} sangria={3} />
                            ))}
                            <FilaSubtotal
                              titulo={`Total ${g.label.toLowerCase()}`}
                              valor={g.total} anterior={g.anterior} variacion={g.variacion}
                              sangria={1}
                            />
                          </>
                        ) : (
                          <FilaCuenta
                            a={{
                              name: g.label,
                              amount: g.total,
                              anterior: g.anterior,
                              variacion: g.variacion,
                            }}
                            sangria={2}
                          />
                        )}
                      </React.Fragment>
                    ))
                  )}

                  <FilaSubtotal
                    titulo={b.resultado?.label}
                    valor={b.resultado?.value}
                    anterior={b.resultado?.anterior}
                    variacion={b.resultado?.variacion}
                    nota={notaBloque}
                    tono={esFinal ? C.final : C.resultado}
                    sangria={0}
                  />
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {s?.cuadra === false && (
        <Descuadre mensaje="Los escalones no dan lo mismo que ingresos menos gastos: hay alguna cuenta que no está cayendo en ningún bloque. Avisale al profesor." />
      )}

      <Pie tipo="resultados" />
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DE SITUACIÓN FINANCIERA
// ─────────────────────────────────────────────────────────────────────────────

export function EstadoSituacionFormal({ data, companyName, primeraNota = 4 }: Props) {
  const c = data?.classified;
  const comp = data?.comparativo;
  const hayComparativo = !!comp;

  const fecha = data?.asOfDate ? new Date(data.asOfDate) : new Date();
  const empresa = { ...(data?.company ?? {}), name: companyName ?? data?.company?.name };

  let nota = primeraNota;
  const siguienteNota = () => nota++;

  const cols = hayComparativo ? 4 : 3;

  /** Una de las dos columnas del estado (activos | pasivos y patrimonio). */
  function Columna({
    titulo, secciones, totales,
  }: {
    titulo: string;
    secciones: Array<{ encabezado: string; seccion: any; totalLabel: string }>;
    totales: Array<{ label: string; valor: any; anterior?: any }>;
  }) {
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr className={C.cabecera}>
            <th className="px-3 py-2 text-left text-[12px] font-bold uppercase tracking-wide">{titulo}</th>
            <th className="px-2 py-2 text-center text-[11px] font-bold">Nota</th>
            <th className="px-3 py-2 text-right text-[11px] font-bold">
              {comp?.etiquetaActual ?? ''}<br /><span className="font-normal">¢</span>
            </th>
            {hayComparativo && (
              <th className="px-3 py-2 text-right text-[11px] font-bold">
                {comp.etiquetaAnterior}<br /><span className="font-normal">¢</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {secciones.map(({ encabezado, seccion, totalLabel }, si) => (
            <React.Fragment key={si}>
              <tr className={C.seccion}>
                <td className="px-3 py-[5px] text-[12px] font-bold uppercase" colSpan={cols}>
                  {encabezado}
                </td>
              </tr>

              {(seccion?.grupos ?? []).length === 0 ? (
                <tr className="border-b border-gray-100">
                  <td className="py-[3px] pl-5 text-[11px] italic text-gray-400" colSpan={cols}>
                    Sin saldos
                  </td>
                </tr>
              ) : (
                (seccion.grupos ?? []).flatMap((g: any, gi: number) => {
                  const cuentas = g.accounts ?? [];
                  // Con una sola cuenta se muestra el grupo y ya: desdoblarlo
                  // repetiría la misma línea dos veces.
                  if (cuentas.length <= 1) {
                    return [(
                      <tr key={`g${gi}`} className="border-b border-gray-100">
                        <td className="py-[3px] pl-5 pr-3 text-[12px] text-gray-700">{g.label}</td>
                        <td className="px-2 text-center text-[11px] text-gray-500">{siguienteNota()}</td>
                        <Cifra v={g.total} className="text-gray-800" />
                        {hayComparativo && <Cifra v={g.anterior} className="text-gray-600" />}
                      </tr>
                    )];
                  }
                  return [
                    <tr key={`g${gi}h`}>
                      <td className="py-[3px] pl-4 text-[12px] font-semibold text-gray-800" colSpan={cols}>
                        {g.label}
                      </td>
                    </tr>,
                    ...cuentas.map((a: any, ai: number) => (
                      <tr key={`g${gi}a${ai}`} className="border-b border-gray-100">
                        <td className="py-[3px] pl-7 pr-3 text-[12px] text-gray-700">{a.name}</td>
                        <td className="px-2 text-center text-[11px] text-gray-500">{siguienteNota()}</td>
                        <Cifra v={a.amount} className="text-gray-800" />
                        {hayComparativo && <Cifra v={a.anterior} className="text-gray-600" />}
                      </tr>
                    )),
                    <tr key={`g${gi}t`} className={`${C.subtotal} border-y ${C.borde}`}>
                      <td className="py-[4px] pl-4 pr-3 text-[12px] font-bold">
                        Total {g.label.toLowerCase()}
                      </td>
                      <td />
                      <Cifra v={g.total} className="font-bold" />
                      {hayComparativo && <Cifra v={g.anterior} className="font-bold" />}
                    </tr>,
                  ];
                })
              )}

              <tr className={`${C.subtotal} border-y ${C.borde}`}>
                <td className="px-3 py-[5px] text-[12px] font-bold">{totalLabel}</td>
                <td />
                <Cifra v={seccion?.total} className="font-bold" />
                {hayComparativo && <Cifra v={seccion?.anterior} className="font-bold" />}
              </tr>
            </React.Fragment>
          ))}

          {totales.map((t, i) => (
            <tr key={i} className={C.final}>
              <td className="px-3 py-2 text-[12px] font-bold uppercase tracking-wide">{t.label}</td>
              <td />
              <Cifra v={t.valor} className="font-bold" />
              {hayComparativo && <Cifra v={t.anterior} className="font-bold" />}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <article className="mx-auto max-w-6xl bg-white px-6 py-6 text-gray-900">
      <Encabezado
        empresa={empresa}
        titulo="Estado de Situación Financiera"
        subtitulo={`Al ${fecha.toLocaleDateString('es-CR', {
          day: '2-digit', month: 'long', year: 'numeric',
        })}`}
      />

      {/* Dos columnas: activos a la izquierda, pasivos y patrimonio a la
          derecha. En pantalla angosta se apilan, porque una tabla de seis
          columnas encogida no la lee nadie. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <Columna
            titulo="Activos"
            secciones={[
              { encabezado: 'Activos corrientes',     seccion: c?.activo?.corriente,   totalLabel: 'Total activos corrientes' },
              { encabezado: 'Activos no corrientes',  seccion: c?.activo?.noCorriente, totalLabel: 'Total activos no corrientes' },
            ]}
            totales={[{ label: 'Total activos', valor: c?.activo?.total, anterior: c?.activo?.anterior }]}
          />
        </div>

        <div className="overflow-x-auto">
          <Columna
            titulo="Pasivos y Patrimonio"
            secciones={[
              { encabezado: 'Pasivos corrientes',    seccion: c?.pasivo?.corriente,   totalLabel: 'Total pasivos corrientes' },
              { encabezado: 'Pasivos no corrientes', seccion: c?.pasivo?.noCorriente, totalLabel: 'Total pasivos no corrientes' },
            ]}
            totales={[{ label: 'Total pasivos', valor: c?.pasivo?.total, anterior: c?.pasivo?.anterior }]}
          />
          <div className="mt-2 overflow-x-auto">
            <Columna
              titulo="Patrimonio"
              secciones={[
                { encabezado: 'Patrimonio', seccion: c?.patrimonio, totalLabel: 'Total patrimonio' },
              ]}
              totales={[{
                label: 'Total pasivos y patrimonio',
                valor: c?.ecuacion?.pasivoMasPatrimonio,
                anterior: undefined,
              }]}
            />
          </div>
        </div>
      </div>

      {/* La ecuación contable es la prueba de que el estado es un estado. */}
      <div className={`mt-5 rounded border px-4 py-2 text-[11.5px] ${
        c?.ecuacion?.cuadra
          ? 'border-[#C9D6E2] bg-[#F2F6FA] text-[#1F3348]'
          : 'border-rose-300 bg-rose-50 text-rose-900'
      }`}>
        <span className="font-semibold">Ecuación contable: </span>
        Activo {cifra(c?.ecuacion?.activo, true)} = Pasivo + Patrimonio{' '}
        {cifra(c?.ecuacion?.pasivoMasPatrimonio, true)}
        {c?.ecuacion?.cuadra
          ? ' · el estado cuadra.'
          : ` · descuadrado por ${cifra(c?.ecuacion?.diferencia, true)}: revisá los asientos.`}
      </div>

      <Pie tipo="situacion" />
    </article>
  );
}
