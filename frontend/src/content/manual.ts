/**
 * Manual de uso de ContaSJ: tipos y acceso al contenido.
 *
 * El contenido vive en `manual.json`, no aquí. Así lo leen por igual la
 * página de Ayuda (TypeScript) y el generador del PDF (Python, en
 * scripts/manual-pdf.py). Mantener dos copias del mismo manual termina
 * siempre igual: una se actualiza y la otra se queda mintiendo.
 *
 * Para cambiar el manual se edita el JSON. No hace falta tocar este archivo
 * salvo que cambie la ESTRUCTURA de una sección.
 */

import datos from './manual.json';

export type Rol = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface Seccion {
  id: string;
  titulo: string;
  /** Una o dos frases: qué es y para qué sirve. */
  resumen: string;
  paraQuien: Rol[];
  /** Nombre del archivo en public/manual/ (sin ruta). Opcional. */
  captura?: string;
  /** Pasos numerados. Verbo primero, sin relleno. */
  pasos?: string[];
  /** Lo que conviene saber antes de equivocarse. */
  avisos?: string[];
}

export interface Capitulo {
  id: string;
  numero: number;
  titulo: string;
  intro: string;
  secciones: Seccion[];
}

export interface ManualMeta {
  sistema: string;
  subtitulo: string;
  empresa: string;
  version: string;
  revisado: string;
}

export const ROL_NOMBRE: Record<Rol, string> = {
  ADMIN:   'Administración',
  TEACHER: 'Profesorado',
  STUDENT: 'Estudiantes',
};

export const MANUAL_META: ManualMeta = datos.meta as ManualMeta;
export const MANUAL: Capitulo[] = datos.capitulos as Capitulo[];

/** Capturas que el manual espera encontrar en public/manual/. */
export function capturasEsperadas(): string[] {
  return MANUAL.flatMap((c) => c.secciones.map((s) => s.captura).filter((x): x is string => !!x));
}
