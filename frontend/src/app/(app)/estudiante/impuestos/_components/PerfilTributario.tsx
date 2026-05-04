'use client';

import { useState, useEffect } from 'react';
import { Building2, User, Pencil, Check, X, ChevronDown } from 'lucide-react';

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

  if (!editing) {
    return (
      <div className={`bg-white border ${isComplete ? 'border-gray-200' : 'border-amber-300'} rounded-xl p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {perfil.tipoPersona === 'JURIDICA'
              ? <Building2 className="w-4 h-4 text-blue-600" />
              : <User className="w-4 h-4 text-purple-600" />}
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Datos del Contribuyente</span>
            {!isComplete && (
              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                Incompleto
              </span>
            )}
          </div>
          {!disabled && (
            <button onClick={handleEdit}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">
              <Pencil className="w-3 h-3" /> Editar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="flex gap-2">
            <span className="text-xs text-gray-400 w-28 flex-shrink-0">Tipo persona</span>
            <span className="text-xs font-medium text-gray-700">
              {perfil.tipoPersona === 'JURIDICA' ? 'Jurídica (empresa)' : 'Física (profesional)'}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-xs text-gray-400 w-28 flex-shrink-0">
              {perfil.tipoPersona === 'JURIDICA' ? 'Cédula jurídica' : 'Número de cédula'}
            </span>
            <span className="text-xs font-mono font-semibold text-gray-800">
              {perfil.cedula || <span className="text-amber-600 italic">No ingresada</span>}
            </span>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <span className="text-xs text-gray-400 w-28 flex-shrink-0">Razón social</span>
            <span className="text-xs font-semibold text-gray-800 uppercase">
              {perfil.razonSocial || <span className="text-amber-600 italic">No ingresada</span>}
            </span>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <span className="text-xs text-gray-400 w-28 flex-shrink-0">Actividad econ.</span>
            <span className="text-xs font-medium text-blue-700">
              {perfil.actividadCodigo
                ? <><span className="font-mono font-bold">{perfil.actividadCodigo}</span> — {perfil.actividadNombre}</>
                : <span className="text-amber-600 italic">No seleccionada</span>}
            </span>
          </div>
          {perfil.correoTributario && (
            <div className="flex gap-2 md:col-span-2">
              <span className="text-xs text-gray-400 w-28 flex-shrink-0">Correo tributario</span>
              <span className="text-xs text-gray-600">{perfil.correoTributario}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Edit form
  return (
    <div className="bg-white border border-blue-300 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Datos del Contribuyente</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Tipo persona */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Tipo de persona</label>
          <div className="flex gap-2">
            {(['JURIDICA', 'FISICA'] as const).map(tipo => (
              <button key={tipo} type="button"
                onClick={() => setDraft(d => ({ ...d, tipoPersona: tipo }))}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                  draft.tipoPersona === tipo
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                {tipo === 'JURIDICA' ? '🏢 Persona Jurídica' : '👤 Persona Física'}
              </button>
            ))}
          </div>
        </div>

        {/* Cédula y razón social */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              {draft.tipoPersona === 'JURIDICA' ? 'Cédula jurídica' : 'Número de cédula'}
            </label>
            <input
              type="text"
              value={draft.cedula}
              onChange={e => setDraft(d => ({ ...d, cedula: e.target.value }))}
              placeholder={draft.tipoPersona === 'JURIDICA' ? '3-101-999999' : '1-1234-5678'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Correo tributario</label>
            <input
              type="email"
              value={draft.correoTributario}
              onChange={e => setDraft(d => ({ ...d, correoTributario: e.target.value }))}
              placeholder="empresa@demo.cr"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Razón social / Nombre del contribuyente</label>
          <input
            type="text"
            value={draft.razonSocial}
            onChange={e => setDraft(d => ({ ...d, razonSocial: e.target.value.toUpperCase() }))}
            placeholder="EMPRESA DEMO S.A."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Actividad económica */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Actividad Económica (CIIU Rev.4)
          </label>
          {draft.actividadCodigo && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              <span className="font-mono font-bold">{draft.actividadCodigo}</span>
              <span className="flex-1">{draft.actividadNombre}</span>
              <button type="button" onClick={() => setDraft(d => ({ ...d, actividadCodigo: '', actividadNombre: '' }))}
                className="text-blue-400 hover:text-blue-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="relative">
            <input
              type="text"
              value={actSearch}
              onChange={e => setActSearch(e.target.value)}
              placeholder="Buscar actividad por código o descripción..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {actSearch.length > 0 && (
            <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-lg max-h-52 overflow-y-auto bg-white">
              {filteredActs.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-400">Sin resultados</div>
              ) : filteredActs.map(act => (
                <button key={act.codigo} type="button"
                  onClick={() => selectActividad(act)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center gap-2 border-b border-gray-50 last:border-0">
                  <span className="font-mono font-bold text-blue-700 w-12 flex-shrink-0">{act.codigo}</span>
                  <span className="text-gray-700">{act.nombre}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button type="button" onClick={handleCancel}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
        <button type="button" onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          <Check className="w-3.5 h-3.5" /> Guardar datos
        </button>
      </div>
    </div>
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
