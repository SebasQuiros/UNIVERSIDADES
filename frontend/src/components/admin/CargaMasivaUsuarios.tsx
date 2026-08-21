'use client';

/**
 * Carga masiva de personas.
 *
 * Una clase no se da de alta de a una. Con 500 estudiantes, el formulario de
 * "nuevo usuario" no es incómodo: es inviable.
 *
 * Dos cosas mandan en el diseño de esta pantalla:
 *
 * 1. Las contraseñas se muestran UNA sola vez. No quedan guardadas en ningún
 *    lado — Supabase solo tiene el hash. Si esta pantalla se cierra sin
 *    descargar el archivo, hay que restablecerlas una por una. Por eso el
 *    botón de descarga es lo más visible del resultado, y por eso se avisa
 *    antes de cerrar.
 *
 * 2. Nunca es todo-o-nada. Se muestran las que entraron Y las que fallaron,
 *    con el número de fila y el motivo, para poder corregir solo esas y
 *    volver a subirlas.
 */

import { useState } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { X, Upload, Download, AlertTriangle, CheckCircle2, Users } from 'lucide-react';

interface FilaLeida { name: string; email: string; role: string; }
interface Creado   { fila: number; nombre: string; email: string; rol: string; contrasenaTemporal: string; }
interface Fallido  { fila: number; email: string; motivo: string; }

const EJEMPLO = [
  'María Alvarado, maria@colegio.cr',
  'Carlos Mora, carlos@colegio.cr',
  'Ana Bermúdez, ana@colegio.cr, TEACHER',
].join('\n');

/**
 * Lee la lista pegada. Acepta coma, punto y coma o tabulación — porque eso es
 * lo que sale al copiar de Excel, de Sheets o de un CSV, y obligar a un
 * formato único solo genera errores que la persona no entiende.
 */
function leerLista(texto: string): { filas: FilaLeida[]; errores: string[] } {
  const filas: FilaLeida[] = [];
  const errores: string[] = [];

  texto.split(/\r?\n/).forEach((linea, i) => {
    const limpia = linea.trim();
    if (!limpia) return;
    const partes = limpia.split(/[;\t,]/).map((p) => p.trim()).filter(Boolean);

    // Encabezado de Excel: se salta en vez de intentar crear un usuario
    // llamado "nombre" con correo "email".
    if (i === 0 && /^(nombre|name)$/i.test(partes[0] ?? '')) return;

    if (partes.length < 2) {
      errores.push(`Línea ${i + 1}: falta el correo (se esperaba "Nombre, correo").`);
      return;
    }
    const [name, email, role] = partes;
    filas.push({ name, email, role: (role ?? 'STUDENT').toUpperCase() });
  });

  return { filas, errores };
}

/** Escapa un campo para CSV: una coma o una comilla en un nombre parte el archivo. */
const csvCampo = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

export function CargaMasivaUsuarios({
  universityId, onClose, onCreated,
}: {
  universityId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [texto, setTexto]       = useState('');
  const [enviando, setEnviando] = useState(false);
  const [creados, setCreados]   = useState<Creado[] | null>(null);
  const [fallidos, setFallidos] = useState<Fallido[]>([]);
  const [correoEnviado, setCorreoEnviado] = useState(false);
  const [descargado, setDescargado] = useState(false);

  const { filas, errores } = leerLista(texto);

  async function enviar() {
    if (filas.length === 0) { toast.error('No hay ninguna persona en la lista.'); return; }
    setEnviando(true);
    try {
      const { data } = await api.post(
        `/api/v1/universities/${universityId}/users/lote`,
        { usuarios: filas.map((f) => ({ name: f.name, email: f.email, role: f.role })) },
      );
      setCreados(data.creados ?? []);
      setFallidos(data.fallidos ?? []);
      setCorreoEnviado(!!data.correoEnviado);
      onCreated();
      if ((data.creados ?? []).length > 0) {
        toast.success(`${data.creados.length} persona(s) creada(s)`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  function descargar() {
    if (!creados?.length) return;
    const lineas = [
      ['Nombre', 'Correo', 'Rol', 'Contraseña temporal'].map(csvCampo).join(','),
      ...creados.map((c) => [c.nombre, c.email, c.rol, c.contrasenaTemporal].map(csvCampo).join(',')),
    ];
    // BOM: sin esto Excel abre los acentos como símbolos raros.
    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `credenciales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDescargado(true);
  }

  // Cerrar sin descargar pierde las contraseñas para siempre: se avisa.
  function intentarCerrar() {
    if (creados?.length && !descargado && !correoEnviado) {
      const seguro = window.confirm(
        'Todavía no descargaste las contraseñas.\n\n' +
        'Son la única copia: si cerrás ahora, hay que restablecerlas una por una.\n\n' +
        '¿Cerrar de todos modos?',
      );
      if (!seguro) return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={intentarCerrar} />
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-card bg-white shadow-xl">

        <div className="flex items-start gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900">Cargar varias personas</h3>
            <p className="text-xs text-gray-500">
              Pegá la lista desde Excel o escribila. Hasta 500 por carga.
            </p>
          </div>
          <button onClick={intentarCerrar} aria-label="Cerrar"
            className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-50 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!creados ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Una persona por línea: <span className="font-mono text-xs">Nombre, correo</span>
                  <span className="text-gray-400"> — y opcionalmente el rol (STUDENT, TEACHER, ADMIN)</span>
                </label>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={10}
                  placeholder={EJEMPLO}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-mono text-sm text-gray-900 placeholder-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Sirve copiar y pegar directo de Excel. Si no ponés rol, entra como estudiante.
                </p>
              </div>

              {errores.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="mb-1 text-xs font-semibold text-amber-800">
                    {errores.length} línea(s) que no se van a enviar:
                  </p>
                  <ul className="space-y-0.5 text-xs text-amber-700">
                    {errores.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {errores.length > 5 && <li>…y {errores.length - 5} más.</li>}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className="text-sm text-gray-600">
                  {filas.length === 0
                    ? 'Ninguna persona todavía'
                    : `${filas.length} persona(s) listas para crear`}
                </span>
                <Button onClick={enviar} loading={enviando} disabled={filas.length === 0}>
                  <Upload className="h-4 w-4" /> Crear {filas.length > 0 ? filas.length : ''}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {creados.length > 0 && (
                <div className={`rounded-xl border px-4 py-3 ${
                  correoEnviado
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-amber-300 bg-amber-50'}`}>
                  <div className="flex items-start gap-2.5">
                    {correoEnviado
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${correoEnviado ? 'text-emerald-900' : 'text-amber-900'}`}>
                        {creados.length} persona(s) creada(s)
                      </p>
                      <p className={`text-xs ${correoEnviado ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {correoEnviado
                          ? 'Cada quien recibió sus credenciales por correo. Descargá el archivo igual, por si acaso.'
                          : 'No hay correo configurado: esta pantalla es la ÚNICA copia de las contraseñas. Descargalas antes de cerrar.'}
                      </p>
                    </div>
                    <Button size="sm" onClick={descargar} className="flex-shrink-0">
                      <Download className="h-4 w-4" /> Descargar CSV
                    </Button>
                  </div>
                </div>
              )}

              {creados.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Persona</th>
                        <th className="px-3 py-2 text-left font-semibold">Contraseña temporal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {creados.map((c) => (
                        <tr key={c.email}>
                          <td className="px-3 py-2">
                            <p className="truncate font-medium text-gray-900">{c.nombre}</p>
                            <p className="truncate text-xs text-gray-400">{c.email}</p>
                          </td>
                          <td className="px-3 py-2">
                            <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-800">
                              {c.contrasenaTemporal}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {fallidos.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    {fallidos.length} no se pudieron crear
                  </p>
                  <div className="divide-y divide-gray-50 overflow-hidden rounded-xl border border-rose-200">
                    {fallidos.map((f, i) => (
                      <div key={i} className="flex items-baseline gap-3 bg-rose-50/40 px-3 py-2">
                        <span className="flex-shrink-0 font-mono text-xs text-rose-400">fila {f.fila}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{f.email || '(sin correo)'}</span>
                        <span className="flex-shrink-0 text-xs text-rose-700">{f.motivo}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Corregí solo esas líneas y volvé a cargarlas: las que ya entraron no se duplican.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" className="flex-1"
                  onClick={() => { setCreados(null); setFallidos([]); setTexto(''); setDescargado(false); }}>
                  Cargar otra lista
                </Button>
                <Button className="flex-1" onClick={intentarCerrar}>Listo</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
