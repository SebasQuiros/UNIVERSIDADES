'use client';

import { useState, useEffect } from 'react';
import { Building2, User, Pencil, Check, X, ChevronDown, Search } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export interface PerfilTributarioData {
  tipoPersona: 'JURIDICA' | 'FISICA';
  cedula: string;
  razonSocial: string;
  correoTributario: string;
  actividadCodigo: string;
  actividadNombre: string;
}

const STORAGE_KEY = 'csq_perfil_tributario';

export const ACTIVIDADES_ECONOMICAS = [
  { codigo: '0111', nombre: 'Cultivo de cereales, legumbres y semillas oleaginosas' },
  { codigo: '0121', nombre: 'Cultivo de frutas tropicales y subtropicales' },
  { codigo: '1010', nombre: 'Elaboración y conservación de carne' },
  { codigo: '1030', nombre: 'Elaboración y conservación de frutas, legumbres y hortalizas' },
  { codigo: '1071', nombre: 'Fabricación de productos de panadería y repostería' },
  { codigo: '4520', nombre: 'Mantenimiento y reparación de vehículos automotores' },
  { codigo: '4711', nombre: 'Comercio al por menor — almacenes de alimentos' },
  { codigo: '4719', nombre: 'Comercio al por menor en otros almacenes no especializados' },
  { codigo: '4741', nombre: 'Comercio al por menor de computadoras y equipos informáticos' },
  { codigo: '4771', nombre: 'Comercio al por menor de prendas de vestir y accesorios' },
  { codigo: '4781', nombre: 'Comercio al por menor en puestos de venta (alimentos y bebidas)' },
  { codigo: '4921', nombre: 'Transporte de pasajeros por vía terrestre urbana' },
  { codigo: '4923', nombre: 'Transporte de carga por carretera' },
  { codigo: '5510', nombre: 'Actividades de alojamiento para estancias cortas (hoteles)' },
  { codigo: '5610', nombre: 'Actividades de restaurantes y servicio móvil de comidas' },
  { codigo: '5630', nombre: 'Expendio de bebidas en establecimientos especializados' },
  { codigo: '6201', nombre: 'Actividades de programación informática' },
  { codigo: '6202', nombre: 'Consultoría de informática y gestión de instalaciones' },
  { codigo: '6209', nombre: 'Otras actividades de tecnología de la información' },
  { codigo: '6311', nombre: 'Procesamiento de datos y hospedaje (nube / data center)' },
  { codigo: '6419', nombre: 'Otros tipos de intermediación monetaria' },
  { codigo: '6499', nombre: 'Otras actividades de servicios financieros n.c.p.' },
  { codigo: '6512', nombre: 'Actividades de seguros de vida' },
  { codigo: '6621', nombre: 'Evaluación de riesgos y daños' },
  { codigo: '6920', nombre: 'Contabilidad, teneduría de libros, auditoría y asesoría fiscal' },
  { codigo: '7010', nombre: 'Actividades de oficinas principales corporativas' },
  { codigo: '7020', nombre: 'Consultoría de gestión empresarial' },
  { codigo: '7111', nombre: 'Actividades de arquitectura' },
  { codigo: '7112', nombre: 'Actividades de ingeniería y consultoría técnica' },
  { codigo: '7210', nombre: 'Investigación y desarrollo en ciencias naturales' },
  { codigo: '7310', nombre: 'Publicidad' },
  { codigo: '7410', nombre: 'Actividades especializadas de diseño' },
  { codigo: '7490', nombre: 'Otras actividades profesionales, científicas y técnicas n.c.p.' },
  { codigo: '8121', nombre: 'Limpieza general de edificios' },
  { codigo: '8211', nombre: 'Servicios combinados de apoyo a instalaciones' },
  { codigo: '8219', nombre: 'Fotocopiado, preparación de documentos y servicios especializados' },
  { codigo: '8299', nombre: 'Otras actividades de apoyo a las empresas n.c.p.' },
  { codigo: '8550', nombre: 'Actividades de enseñanza superior (universidades, institutos)' },
  { codigo: '8559', nombre: 'Otras actividades de enseñanza n.c.p.' },
  { codigo: '8560', nombre: 'Actividades de apoyo a la enseñanza' },
  { codigo: '8610', nombre: 'Actividades de hospitales y clínicas con internamiento' },
  { codigo: '8620', nombre: 'Actividades de médicos y odontólogos' },
  { codigo: '8690', nombre: 'Otras actividades de atención de la salud humana' },
  { codigo: '9001', nombre: 'Artes escénicas (teatro, danza, conciertos)' },
  { codigo: '9311', nombre: 'Gestión de instalaciones deportivas' },
  { codigo: '9601', nombre: 'Lavado y limpieza de prendas de tela y de piel' },
  { codigo: '9602', nombre: 'Peluquería y otros tratamientos de belleza' },
];

const DEFAULT_PERFIL: PerfilTributarioData = {
  tipoPersona: 'JURIDICA',
  cedula: '',
  razonSocial: '',
  correoTributario: '',
  actividadCodigo: '6920',
  actividadNombre: 'Contabilidad, teneduría de libros, auditoría y asesoría fiscal',
};

interface Props {
  disabled?: boolean;
  onChange?: (perfil: PerfilTributarioData) => void;
}

/** Fila de dato del perfil (etiqueta + valor). */
function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 flex-shrink-0 text-xs text-gray-400">{label}</span>
      <span className="min-w-0 text-xs">{children}</span>
    </div>
  );
}

export function PerfilTributario({ disabled = false, onChange }: Props) {
  const [perfil, setPerfil] = useState<PerfilTributarioData>(DEFAULT_PERFIL);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PerfilTributarioData>(DEFAULT_PERFIL);
  const [actSearch, setActSearch] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPerfil(parsed);
        onChange?.(parsed);
      } else {
        setEditing(true); // First time: open form
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEdit() {
    setDraft({ ...perfil });
    setActSearch('');
    setEditing(true);
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setPerfil({ ...draft });
    onChange?.({ ...draft });
    setEditing(false);
  }

  function handleCancel() {
    setEditing(false);
    setDraft({ ...perfil });
  }

  function selectActividad(act: { codigo: string; nombre: string }) {
    setDraft(d => ({ ...d, actividadCodigo: act.codigo, actividadNombre: act.nombre }));
    setActSearch('');
  }

  const filteredActs = ACTIVIDADES_ECONOMICAS.filter(a =>
    `${a.codigo} ${a.nombre}`.toLowerCase().includes(actSearch.toLowerCase()),
  ).slice(0, 12);

  const isComplete = !!(perfil.cedula && perfil.razonSocial && perfil.actividadCodigo);

  // ── Vista de lectura ───────────────────────────────────────────────────────
  if (!editing) {
    return (
      <SectionCard
        eyebrow="Contribuyente"
        title="Datos del contribuyente"
        icon={perfil.tipoPersona === 'JURIDICA' ? Building2 : User}
        iconTint={isComplete ? '#1B2E6E' : '#B8860B'}
        className={cn('cx-pop', !isComplete && 'border-gold-100')}
        action={
          <div className="flex items-center gap-2">
            {!isComplete && <Badge variant="gold">Incompleto</Badge>}
            {!disabled && (
              <Button variant="ghost" size="sm" onClick={handleEdit} className="cx-press">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
          <Dato label="Tipo persona">
            <span className="font-medium text-gray-700">
              {perfil.tipoPersona === 'JURIDICA' ? 'Jurídica (empresa)' : 'Física (profesional)'}
            </span>
          </Dato>

          <Dato label={perfil.tipoPersona === 'JURIDICA' ? 'Cédula jurídica' : 'Número de cédula'}>
            {perfil.cedula
              ? <span className="font-mono font-semibold tabular-nums text-gray-800">{perfil.cedula}</span>
              : <span className="italic text-gold-700">No ingresada</span>}
          </Dato>

          <div className="md:col-span-2">
            <Dato label="Razón social">
              {perfil.razonSocial
                ? <span className="font-semibold uppercase text-gray-800">{perfil.razonSocial}</span>
                : <span className="italic text-gold-700">No ingresada</span>}
            </Dato>
          </div>

          <div className="md:col-span-2">
            <Dato label="Actividad econ.">
              {perfil.actividadCodigo
                ? (
                  <span className="font-medium text-blue-700">
                    <span className="font-mono font-bold tabular-nums">{perfil.actividadCodigo}</span>
                    {' — '}{perfil.actividadNombre}
                  </span>
                )
                : <span className="italic text-gold-700">No seleccionada</span>}
            </Dato>
          </div>

          {perfil.correoTributario && (
            <div className="md:col-span-2">
              <Dato label="Correo tributario">
                <span className="text-gray-600">{perfil.correoTributario}</span>
              </Dato>
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  // ── Formulario de edición ──────────────────────────────────────────────────
  return (
    <SectionCard
      eyebrow="Contribuyente"
      title="Datos del contribuyente"
      description="Se usan para identificar la declaración, igual que en el sistema de Hacienda."
      icon={Building2}
      iconTint="#1B2E6E"
      className="cx-pop"
    >
      <div className="space-y-4">
        {/* Tipo de persona */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Tipo de persona
          </label>
          <div className="flex gap-2">
            {(['JURIDICA', 'FISICA'] as const).map(tipo => {
              const TipoIcon = tipo === 'JURIDICA' ? Building2 : User;
              const selected = draft.tipoPersona === tipo;
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, tipoPersona: tipo }))}
                  className={cn(
                    'cx-press flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-xs font-semibold transition-all',
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  <TipoIcon className="h-4 w-4" />
                  {tipo === 'JURIDICA' ? 'Persona jurídica' : 'Persona física'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cédula y correo */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label={draft.tipoPersona === 'JURIDICA' ? 'Cédula jurídica' : 'Número de cédula'}
            value={draft.cedula}
            onChange={e => setDraft(d => ({ ...d, cedula: e.target.value }))}
            placeholder={draft.tipoPersona === 'JURIDICA' ? '3-101-999999' : '1-1234-5678'}
            className="font-mono tabular-nums"
          />
          <Input
            label="Correo tributario"
            type="email"
            value={draft.correoTributario}
            onChange={e => setDraft(d => ({ ...d, correoTributario: e.target.value }))}
            placeholder="empresa@demo.cr"
          />
        </div>

        <Input
          label="Razón social / Nombre del contribuyente"
          value={draft.razonSocial}
          onChange={e => setDraft(d => ({ ...d, razonSocial: e.target.value.toUpperCase() }))}
          placeholder="EMPRESA DEMO S.A."
          className="font-semibold uppercase"
        />

        {/* Actividad económica */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Actividad económica (CIIU Rev.4)
          </label>

          {draft.actividadCodigo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <span className="font-mono font-bold tabular-nums">{draft.actividadCodigo}</span>
              <span className="flex-1">{draft.actividadNombre}</span>
              <button
                type="button"
                aria-label="Quitar actividad seleccionada"
                onClick={() => setDraft(d => ({ ...d, actividadCodigo: '', actividadNombre: '' }))}
                className="cx-press rounded-md p-0.5 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={actSearch}
              onChange={e => setActSearch(e.target.value)}
              placeholder="Buscar actividad por código o descripción..."
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-900 transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          {actSearch.length > 0 && (
            <div className="cx-pop mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-card">
              {filteredActs.length === 0 ? (
                <div className="px-3 py-2.5 text-xs text-gray-400">Sin resultados</div>
              ) : filteredActs.map(act => (
                <button
                  key={act.codigo}
                  type="button"
                  onClick={() => selectActividad(act)}
                  className="flex w-full items-center gap-2 border-b border-gray-50 px-3 py-2.5 text-left text-xs transition-colors last:border-0 hover:bg-blue-50"
                >
                  <span className="w-12 flex-shrink-0 font-mono font-bold tabular-nums text-blue-700">{act.codigo}</span>
                  <span className="text-gray-700">{act.nombre}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={handleCancel} className="cx-press">
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={handleSave} className="cx-press">
          <Check className="h-3.5 w-3.5" /> Guardar datos
        </Button>
      </div>
    </SectionCard>
  );
}

export function usePerfilTributario() {
  const [perfil, setPerfil] = useState<PerfilTributarioData | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPerfil(JSON.parse(saved));
    } catch {}
  }, []);
  return { perfil, setPerfil };
}
