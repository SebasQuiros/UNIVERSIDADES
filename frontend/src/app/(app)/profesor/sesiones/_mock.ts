// ============================================================================
// ANDAMIAJE DE MAQUETA — Fase 1 (sin backend real)
// ----------------------------------------------------------------------------
// Datos falsos para recorrer el flujo de "Sesión de aula" (lista de sesiones
// del profesor). En la Fase 2, este archivo se reemplaza por llamadas al
// cliente `api` (ver src/lib/api.ts) contra endpoints como
// `GET /api/v1/class-sessions` y `POST /api/v1/class-sessions`.
//
// Los tipos están pensados para calzar con lo que devolvería el backend, de
// forma que migrar sea sobre todo cambiar el origen de los datos.
// ============================================================================

/** Fases del ciclo de vida de una sesión de aula. */
export type SessionPhase = 'LOBBY' | 'GROUPS' | 'IN_PROGRESS' | 'AUDIT' | 'RESULTS';

export interface ClassSessionSummary {
  id: string;
  /** Código de unión, visible en el lobby proyectado. */
  code: string;
  exerciseId: string;
  exerciseTitle: string;
  courseName: string;
  phase: SessionPhase;
  /** Una vez finalizada (irreversible), no se puede reabrir. */
  isClosed: boolean;
  studentsConnected: number;
  studentsExpected: number;
  companiesCount: number;
  createdAt: string;
  closedAt: string | null;
}

/** Ejercicio existente sobre el cual se puede abrir una sesión de aula. */
export interface ExercisePickOption {
  id: string;
  title: string;
  courseName: string;
  difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  studentsEnrolled: number;
}

export const MOCK_EXERCISE_OPTIONS: ExercisePickOption[] = [
  {
    id: 'ex-1',
    title: 'Ciclo contable completo — Comercio B2B',
    courseName: 'Contabilidad I — Grupo 02',
    difficulty: 'INTERMEDIATE',
    studentsEnrolled: 30,
  },
  {
    id: 'ex-2',
    title: 'Cierre de periodo y declaraciones TRIBU-CR',
    courseName: 'Contabilidad II — Grupo 01',
    difficulty: 'ADVANCED',
    studentsEnrolled: 28,
  },
  {
    id: 'ex-3',
    title: 'Facturación electrónica e inventarios PEPS',
    courseName: 'Contabilidad I — Grupo 02',
    difficulty: 'BASIC',
    studentsEnrolled: 22,
  },
];

export const MOCK_SESSIONS: ClassSessionSummary[] = [
  {
    id: 'sesion-demo-1',
    code: '7F3K9Q',
    exerciseId: 'ex-1',
    exerciseTitle: 'Ciclo contable completo — Comercio B2B',
    courseName: 'Contabilidad I — Grupo 02',
    phase: 'IN_PROGRESS',
    isClosed: false,
    studentsConnected: 30,
    studentsExpected: 30,
    companiesCount: 6,
    createdAt: '2026-07-17T13:05:00-06:00',
    closedAt: null,
  },
  {
    id: 'sesion-demo-2',
    code: 'M2XQ8T',
    exerciseId: 'ex-2',
    exerciseTitle: 'Cierre de periodo y declaraciones TRIBU-CR',
    courseName: 'Contabilidad II — Grupo 01',
    phase: 'AUDIT',
    isClosed: false,
    studentsConnected: 25,
    studentsExpected: 28,
    companiesCount: 5,
    createdAt: '2026-07-16T09:30:00-06:00',
    closedAt: null,
  },
  {
    id: 'sesion-demo-3',
    code: 'K9PL4R',
    exerciseId: 'ex-3',
    exerciseTitle: 'Facturación electrónica e inventarios PEPS',
    courseName: 'Contabilidad I — Grupo 02',
    phase: 'RESULTS',
    isClosed: true,
    studentsConnected: 22,
    studentsExpected: 22,
    companiesCount: 5,
    createdAt: '2026-06-30T14:00:00-06:00',
    closedAt: '2026-06-30T16:40:00-06:00',
  },
];
