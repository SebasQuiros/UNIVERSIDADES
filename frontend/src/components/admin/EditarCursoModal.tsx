'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconTile } from '@/components/ui/IconTile';
import toast from 'react-hot-toast';
import { BookOpen, X, UserCog, AlertTriangle } from 'lucide-react';

/**
 * Edición de un curso desde administración.
 *
 * Lo importante acá es poder cambiar la persona responsable: los grupos se
 * reasignan a mitad de año —alguien se incapacita, entra un sustituto, se
 * reparte la carga— y antes eso no se podía hacer desde ninguna pantalla. Un
 * curso quedaba para siempre a nombre de quien lo creó, y solo esa persona
 * podía trabajarlo.
 *
 * El resto de los datos (nombre, código, período, descripción) se editan aquí
 * mismo, porque un curso mal escrito no debería obligar a crear otro y perder
 * la matrícula.
 */

interface Docente {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface CursoEditable {
  id: string;
  name: string;
  code: string | null;
  period: string | null;
  description: string | null;
  isActive?: boolean;
  teacher: { id: string; name: string; email: string };
  enrollments?: unknown[];
}

export function EditarCursoModal({
  universityId,
  curso,
  onClose,
  onGuardado,
}: {
  universityId: string;
  curso: CursoEditable;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: curso.name ?? '',
    code: curso.code ?? '',
    period: curso.period ?? '',
    description: curso.description ?? '',
    teacherId: curso.teacher?.id ?? '',
    isActive: curso.isActive ?? true,
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<Docente[]>(`/api/v1/universities/${universityId}/users`);
        // Solo quien puede quedar a cargo de un curso. Se conserva a la persona
        // responsable actual aunque esté desactivada: si no, el selector
        // aparecería vacío y guardar la reasignaría sin que nadie lo pidiera.
        const aptos = data.filter(
          (u) =>
            (u.isActive && ['TEACHER', 'ADMIN', 'SUPERADMIN'].includes(u.role)) ||
            u.id === curso.teacher?.id,
        );
        setDocentes(aptos);
      } catch {
        toast.error('No se pudo cargar la lista de profesores');
      } finally {
        setCargando(false);
      }
    })();
  }, [universityId, curso.teacher?.id]);

  const cambioDeProfesor = form.teacherId !== curso.teacher?.id;
  const nuevoProfesor = docentes.find((d) => d.id === form.teacherId);
  const matriculados = curso.enrollments?.length ?? 0;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'El nombre es requerido';
    if (!form.teacherId) errs.teacherId = 'El curso necesita una persona responsable';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await api.patch(`/api/v1/universities/${universityId}/courses/${curso.id}`, {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        period: form.period.trim() || undefined,
        description: form.description.trim() || undefined,
        teacherId: form.teacherId,
        isActive: form.isActive,
      });
      toast.success(
        cambioDeProfesor
          ? `Curso reasignado a ${nuevoProfesor?.name ?? 'la nueva persona responsable'}`
          : 'Curso actualizado',
      );
      onGuardado();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const campo =
    'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-gray-200/70 bg-white shadow-card-hover cx-pop">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <IconTile icon={BookOpen} tint="#2563EB" size={40} />
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Administración</p>
              <h3 className="font-bold tracking-tight text-gray-900">Editar curso</h3>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 transition-colors hover:text-gray-700 cx-press">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={guardar} className="space-y-4 p-6">
          <Input
            label="Nombre del curso *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />

          {/* ── Persona responsable ── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Persona responsable *
            </label>
            <div className="relative">
              <UserCog className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                disabled={cargando}
                className={`${campo} bg-white pl-9 disabled:bg-gray-50`}
              >
                {cargando && <option value="">Cargando profesorado…</option>}
                {docentes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.email}
                    {!d.isActive ? ' (cuenta desactivada)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {errors.teacherId && <p className="mt-1 text-xs text-red-600">{errors.teacherId}</p>}

            {cambioDeProfesor && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Vas a pasar el curso de{' '}
                    <span className="font-semibold">{curso.teacher?.name}</span> a{' '}
                    <span className="font-semibold">{nuevoProfesor?.name}</span>.
                    {matriculados > 0 && ` Los ${matriculados} estudiantes matriculados siguen igual.`}
                    {' '}A partir de ahora solo la nueva persona podrá trabajar el curso.
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Código"
              placeholder="CONT-101"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              label="Período"
              placeholder="2026-I"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              maxLength={500}
              placeholder="Ciclo contable completo, de la constitución al cierre."
              className={`${campo} resize-y`}
            />
          </div>

          {/* ── Estado ── */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              <span className="font-medium">Curso activo</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                Un curso terminado se desactiva, no se borra: sus ejercicios y notas siguen
                consultables, y podés volver a activarlo cuando querás.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="cx-press">
              Cancelar
            </Button>
            <Button type="submit" loading={saving} className="cx-press">
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
