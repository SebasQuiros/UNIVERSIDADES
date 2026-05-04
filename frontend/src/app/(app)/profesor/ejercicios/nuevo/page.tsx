'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import type { Course, Exercise } from '@/types';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, GripVertical, BookOpen } from 'lucide-react';

interface Rubric { criterion: string; description: string; expectedValue: string; points: string; }

const DIFFICULTIES = [
  { value: 'BASIC',        label: 'Básico',       color: 'text-green-600' },
  { value: 'INTERMEDIATE', label: 'Intermedio',   color: 'text-amber-600' },
  { value: 'ADVANCED',     label: 'Avanzado',     color: 'text-red-600' },
];

const TYPES = [
  { value: 'FULL_CYCLE',     label: 'Ciclo Completo',  desc: 'Empresa completa: clientes, inventario, facturación y contabilidad' },
  { value: 'JOURNAL_ONLY',  label: 'Solo Diario',     desc: 'Enfocado en asientos contables' },
  { value: 'INVOICING_ONLY',label: 'Solo Facturación', desc: 'Enfocado en facturación electrónica CR' },
  { value: 'INVENTORY_ONLY',label: 'Solo Inventario',  desc: 'Gestión de productos e inventario' },
];

const CRITERIA_OPTIONS = [
  { value: '',                        label: '— Seleccionar criterio —',       hint: '',                                          expectedHint: 'Valor esperado',          defaultExpected: '' },
  { value: 'has_company',             label: 'Empresa creada',                 hint: 'El estudiante creó su empresa',              expectedHint: '(no requiere valor)',     defaultExpected: '' },
  { value: 'min_clients',             label: 'Mínimo de clientes',             hint: 'N° mínimo de clientes creados',              expectedHint: 'Número mínimo (ej: 3)',   defaultExpected: '2' },
  { value: 'min_products',            label: 'Mínimo de productos',            hint: 'N° mínimo de productos en catálogo',         expectedHint: 'Número mínimo (ej: 3)',   defaultExpected: '2' },
  { value: 'min_invoices',            label: 'Mínimo de facturas',             hint: 'N° mínimo de facturas emitidas',             expectedHint: 'Número mínimo (ej: 3)',   defaultExpected: '3' },
  { value: 'has_issued_invoices',     label: 'Facturas emitidas (al menos 1)', hint: 'Al menos una factura emitida',               expectedHint: '(no requiere valor)',     defaultExpected: '' },
  { value: 'min_journal_entries',     label: 'Mínimo de asientos',             hint: 'N° mínimo de asientos contables',            expectedHint: 'Número mínimo (ej: 5)',   defaultExpected: '2' },
  { value: 'balanced_entries',        label: 'Asientos cuadrados',             hint: 'Todos los asientos débito = crédito',        expectedHint: '(no requiere valor)',     defaultExpected: '' },
  { value: 'balance_sheet_balanced',  label: 'Balance cuadrado',               hint: 'Activos = Pasivo + Patrimonio',              expectedHint: '(no requiere valor)',     defaultExpected: '' },
  { value: 'income_statement_positive', label: 'Resultado positivo',           hint: 'Estado de resultados con utilidad',          expectedHint: '(no requiere valor)',     defaultExpected: '' },
  { value: 'has_adjustment_entries',  label: 'Asientos de ajuste',             hint: 'Registró asientos de ajuste (ADJ)',          expectedHint: '(no requiere valor)',     defaultExpected: '' },
  { value: 'has_closing_entries',     label: 'Asientos de cierre',             hint: 'Registró asientos de cierre (CIER)',         expectedHint: '(no requiere valor)',     defaultExpected: '' },
  { value: 'time_spent_min',          label: 'Tiempo mínimo dedicado',         hint: 'Minutos mínimos trabajando en el ejercicio', expectedHint: 'Minutos mínimos (ej: 30)', defaultExpected: '10' },
  { value: 'account_balance_gte',     label: 'Saldo cuenta ≥ valor',          hint: 'Cuenta específica con saldo mínimo',         expectedHint: 'CODIGO:MONTO (ej: 1.1.01:100000)', defaultExpected: '' },
  { value: 'account_balance_lte',     label: 'Saldo cuenta ≤ valor',          hint: 'Cuenta específica con saldo máximo',         expectedHint: 'CODIGO:MONTO (ej: 2.1.01:50000)', defaultExpected: '' },
  { value: 'account_balance_eq',      label: 'Saldo cuenta ≈ valor',          hint: 'Cuenta específica con saldo aproximado',     expectedHint: 'CODIGO:MONTO (ej: 1.1.01:500000)', defaultExpected: '' },
];

const DEFAULT_RUBRICS: Rubric[] = [
  { criterion: 'min_clients',         description: 'Crear al menos 2 clientes',     expectedValue: '2', points: '20' },
  { criterion: 'min_products',        description: 'Crear al menos 2 productos',    expectedValue: '2', points: '20' },
  { criterion: 'min_invoices',        description: 'Emitir al menos 3 facturas',    expectedValue: '3', points: '30' },
  { criterion: 'balanced_entries',    description: 'Todos los asientos deben cuadrar (débito = crédito)', expectedValue: '', points: '30' },
];

export default function NuevoEjercicioPage() {
  const { user }       = useAuth();
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const preselectedCourseId = searchParams.get('cursoId');

  const [courses, setCourses]   = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [saving, setSaving]     = useState(false);

  const [form, setForm] = useState({
    courseId:    preselectedCourseId ?? '',
    title:       '',
    description: '',
    instructions:'',
    difficulty:  'BASIC',
    type:        'FULL_CYCLE',
    maxScore:    '100',
    dueDate:     '',
  });
  const [rubrics, setRubrics] = useState<Rubric[]>(DEFAULT_RUBRICS);
  const [errors, setErrors]   = useState<Record<string, string>>({});

  // Feature 2: Exam mode settings
  const [examMode, setExamMode] = useState(false);
  const [timeLimit, setTimeLimit] = useState('60');
  const [allowHints, setAllowHints] = useState(true);
  const [examStartsAt, setExamStartsAt] = useState('');
  const [examEndsAt, setExamEndsAt] = useState('');

  // Feature 3: Hints
  const [hints, setHints] = useState({ journal: '', ledger: '', 'balance-comprobacion': '', reports: '' });

  // Feature 4: Expected values
  const [expectedValues, setExpectedValues] = useState({ minAssets: '', minRevenue: '', minExpenses: '', balancedSheet: false });

  useEffect(() => {
    if (!user?.universityId) return;
    api.get<Course[]>(`/api/v1/universities/${user.universityId}/courses`)
      .then(({ data }) => setCourses(data))
      .catch(() => toast.error('Error al cargar cursos'))
      .finally(() => setLoadingCourses(false));
  }, [user]);

  function addRubric() {
    setRubrics([...rubrics, { criterion: '', description: '', expectedValue: '', points: '' }]);
  }

  function removeRubric(i: number) {
    setRubrics(rubrics.filter((_, idx) => idx !== i));
  }

  function updateRubric(i: number, field: keyof Rubric, value: string) {
    setRubrics(rubrics.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.courseId)    errs.courseId = 'Selecciona un curso';
    if (!form.title.trim()) errs.title  = 'El título es requerido';
    if (!form.maxScore || isNaN(Number(form.maxScore)) || Number(form.maxScore) <= 0)
      errs.maxScore = 'Puntaje máximo inválido';
    for (const r of rubrics) {
      if (!r.criterion || !r.description || !r.points)
        errs.rubrics = 'Completa todos los campos de las rúbricas';
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const hintsObj: Record<string, string> = {};
      Object.entries(hints).forEach(([k, v]) => { if (v.trim()) hintsObj[k] = v.trim(); });
      const evObj: Record<string, any> = {};
      if (expectedValues.minAssets) evObj.minAssets = Number(expectedValues.minAssets);
      if (expectedValues.minRevenue) evObj.minRevenue = Number(expectedValues.minRevenue);
      if (expectedValues.minExpenses) evObj.minExpenses = Number(expectedValues.minExpenses);
      if (expectedValues.balancedSheet) evObj.balancedSheet = true;

      const { data } = await api.post<Exercise>(`/api/v1/courses/${form.courseId}/exercises`, {
        title:       form.title,
        description: form.description || undefined,
        instructions:form.instructions || undefined,
        difficulty:  form.difficulty,
        type:        form.type,
        maxScore:    Number(form.maxScore),
        dueDate:     form.dueDate || undefined,
        settings: {
          examMode,
          timeLimit:   examMode ? Number(timeLimit) : undefined,
          startsAt:    examMode && examStartsAt ? examStartsAt : undefined,
          endsAt:      examMode && examEndsAt   ? examEndsAt   : undefined,
          allowHints,
          hints: Object.keys(hintsObj).length > 0 ? hintsObj : undefined,
          expectedValues: Object.keys(evObj).length > 0 ? evObj : undefined,
        },
        rubrics:     rubrics.map((r, i) => ({
          criterion:     r.criterion,
          description:   r.description,
          expectedValue: r.expectedValue || undefined,
          points:        Number(r.points),
          order:         i,
        })),
      });
      toast.success('Ejercicio guardado como borrador');
      router.push(`/profesor/ejercicios/${data.id}?cursoId=${form.courseId}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loadingCourses) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/profesor/ejercicios">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nuevo Ejercicio</h2>
            <p className="text-gray-500 text-sm mt-0.5">Se guardará como borrador hasta que lo publiques</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Basic info */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Información general</h3>

            {/* Course selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Curso *</label>
              <select
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un curso...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.period ? ` (${c.period})` : ''}</option>
                ))}
              </select>
              {errors.courseId && <p className="text-xs text-red-600">{errors.courseId}</p>}
            </div>

            <Input
              label="Título *"
              placeholder="Ej: Ejercicio 1 — Ciclo Contable Básico"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              error={errors.title}
              icon={<BookOpen className="w-4 h-4" />}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                placeholder="Descripción breve del ejercicio..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Instrucciones completas</label>
              <textarea
                placeholder="Instrucciones detalladas para el estudiante..."
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                rows={4}
                className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Config */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Configuración</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Dificultad</label>
                <div className="flex flex-col gap-2">
                  {DIFFICULTIES.map((d) => (
                    <label key={d.value} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${form.difficulty === d.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="difficulty" value={d.value} checked={form.difficulty === d.value} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="sr-only" />
                      <span className={`text-sm font-medium ${d.color}`}>{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Tipo de ejercicio</label>
                <div className="flex flex-col gap-2">
                  {TYPES.map((t) => (
                    <label key={t.value} className={`flex flex-col gap-0.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${form.type === t.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="type" value={t.value} checked={form.type === t.value} onChange={(e) => setForm({ ...form, type: e.target.value })} className="sr-only" />
                      <span className="text-sm font-medium text-gray-900">{t.label}</span>
                      <span className="text-xs text-gray-500 leading-snug">{t.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Puntaje máximo"
                type="number"
                min="1" max="1000"
                value={form.maxScore}
                onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
                error={errors.maxScore}
              />
              <Input
                label="Fecha límite"
                type="datetime-local"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          {/* Rubrics */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Rúbricas de evaluación</h3>
                <p className="text-xs text-gray-500 mt-0.5">Define los criterios para medir el progreso del estudiante</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addRubric}>
                <Plus className="w-4 h-4" /> Agregar
              </Button>
            </div>
            {errors.rubrics && <p className="text-xs text-red-600">{errors.rubrics}</p>}

            {/* Criteria reference */}
            <details className="bg-blue-50 border border-blue-200 rounded-xl text-xs">
              <summary className="px-4 py-2.5 cursor-pointer font-semibold text-blue-700 select-none">
                ℹ️ Criterios disponibles para auto-calificación
              </summary>
              <div className="px-4 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-gray-600">
                {CRITERIA_OPTIONS.filter(c => c.value).map(c => (
                  <div key={c.value} className="flex items-start gap-1.5">
                    <code className="text-blue-700 font-mono shrink-0">{c.value}</code>
                    <span className="text-gray-500">— {c.hint}</span>
                  </div>
                ))}
              </div>
            </details>

            <div className="space-y-3">
              {rubrics.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <GripVertical className="w-4 h-4 text-gray-300 mt-2.5 flex-shrink-0" />
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <select
                        value={r.criterion}
                        onChange={e => {
                          const opt = CRITERIA_OPTIONS.find(c => c.value === e.target.value);
                          updateRubric(i, 'criterion', e.target.value);
                          if (opt?.defaultExpected !== undefined && !r.expectedValue)
                            updateRubric(i, 'expectedValue', opt.defaultExpected);
                        }}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CRITERIA_OPTIONS.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      placeholder="Descripción del criterio"
                      value={r.description}
                      onChange={(e) => updateRubric(i, 'description', e.target.value)}
                    />
                    <Input
                      placeholder={CRITERIA_OPTIONS.find(c => c.value === r.criterion)?.expectedHint ?? 'Valor esperado'}
                      value={r.expectedValue}
                      onChange={(e) => updateRubric(i, 'expectedValue', e.target.value)}
                    />
                    <Input
                      placeholder="Puntos (ej: 25)"
                      type="number" min="0"
                      value={r.points}
                      onChange={(e) => updateRubric(i, 'points', e.target.value)}
                    />
                  </div>
                  <button type="button" onClick={() => removeRubric(i)} className="mt-2 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total puntos: <span className="text-gray-700 font-medium">
                {rubrics.reduce((s, r) => s + (Number(r.points) || 0), 0)}
              </span></span>
            </div>
          </div>

          {/* Feature 2: Exam Mode */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Modo Examen</h3>
            <p className="text-xs text-gray-500">
              Activa temporizador visible, detección de cambios de pestaña y envío automático al agotar el tiempo.
            </p>

            {/* Exam mode toggle */}
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
              <input
                type="checkbox"
                checked={examMode}
                onChange={e => setExamMode(e.target.checked)}
                className="rounded w-4 h-4 accent-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">Activar Modo Examen</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Temporizador de cuenta regresiva + detección de salidas + envío automático
                </p>
              </div>
            </label>

            {examMode && (
              <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                <Input
                  label="Tiempo límite (minutos) *"
                  type="number"
                  min="5"
                  max="300"
                  value={timeLimit}
                  onChange={e => setTimeLimit(e.target.value)}
                  placeholder="60"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Fecha/hora de inicio (opcional)</label>
                    <input
                      type="datetime-local"
                      value={examStartsAt}
                      onChange={e => setExamStartsAt(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 text-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400">Cuando el examen estará disponible</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Fecha/hora de cierre (opcional)</label>
                    <input
                      type="datetime-local"
                      value={examEndsAt}
                      onChange={e => setExamEndsAt(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 text-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400">Fecha límite para comenzar</p>
                  </div>
                </div>
              </div>
            )}

            {/* Hints toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={allowHints} onChange={e => setAllowHints(e.target.checked)} className="rounded w-4 h-4" />
              <span className="text-sm text-gray-700">Permitir pistas (botón 💡 en cada paso)</span>
            </label>
          </div>

          {/* Feature 3: Hints */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Pistas por paso</h3>
            <p className="text-xs text-gray-500">Opcional: configura una pista para cada sección del ciclo contable</p>
            {([
              { key: 'journal', label: 'Libro Diario' },
              { key: 'ledger', label: 'Libro Mayor' },
              { key: 'balance-comprobacion', label: 'Balanza de Comprobación' },
              { key: 'reports', label: 'Estados Financieros' },
            ] as { key: keyof typeof hints; label: string }[]).map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                <textarea value={hints[key]} onChange={e => setHints({ ...hints, [key]: e.target.value })}
                  placeholder={`Pista para ${label}...`} rows={2}
                  className="w-full rounded-xl border border-gray-300 text-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            ))}
          </div>

          {/* Feature 4: Expected Values */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Valores esperados</h3>
            <p className="text-xs text-gray-500">Define los criterios financieros mínimos que debe cumplir la empresa del estudiante</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Activos mínimos (₡)" type="number" min="0" value={expectedValues.minAssets}
                onChange={e => setExpectedValues({ ...expectedValues, minAssets: e.target.value })} placeholder="0" />
              <Input label="Ingresos mínimos (₡)" type="number" min="0" value={expectedValues.minRevenue}
                onChange={e => setExpectedValues({ ...expectedValues, minRevenue: e.target.value })} placeholder="0" />
              <Input label="Gastos mínimos (₡)" type="number" min="0" value={expectedValues.minExpenses}
                onChange={e => setExpectedValues({ ...expectedValues, minExpenses: e.target.value })} placeholder="0" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={expectedValues.balancedSheet} onChange={e => setExpectedValues({ ...expectedValues, balancedSheet: e.target.checked })} className="rounded w-4 h-4" />
              <span className="text-sm text-gray-700">Balance general debe cuadrar</span>
            </label>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pb-8">
            <Link href="/profesor/ejercicios" className="flex-1">
              <Button type="button" variant="secondary" className="w-full">Cancelar</Button>
            </Link>
            <Button type="submit" loading={saving} size="lg" className="flex-1">
              Guardar borrador
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
