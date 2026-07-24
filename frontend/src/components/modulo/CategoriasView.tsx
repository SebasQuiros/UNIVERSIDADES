'use client';

import { useEffect, useState, FormEvent, KeyboardEvent } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import {
  FolderTree, Package, Tag, AlertTriangle,
  Plus, Pencil, Trash2, Check, X,
} from 'lucide-react';

// ── Tipos del endpoint real ────────────────────────────────────
// GET    /api/v1/companies/:companyId/products/categories
//   → ProductCategory[] (Prisma) + `_count.products` (activos de la empresa).
// POST   /api/v1/companies/:companyId/products/categories        { name }
// PATCH  /api/v1/companies/:companyId/products/categories/:id    { name }
// DELETE /api/v1/companies/:companyId/products/categories/:id
//   → { ok: true, detachedProducts: number }
interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count?: { products: number };
}

const NAME_MIN = 2;
const NAME_MAX = 60;

function validName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null;
  return name;
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as any)?.response?.data?.message;
  if (Array.isArray(msg) && msg.length > 0) return String(msg[0]);
  if (typeof msg === 'string' && msg) return msg;
  return fallback;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'no-company' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; companyId: string; categories: Category[] };

export function CategoriasView() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  // Alta
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Renombrar inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Mutación en curso sobre una fila (renombrar / eliminar)
  const [busyId, setBusyId] = useState<string | null>(null);

  // Buscador (solo filtra client-side sobre la lista ya cargada)
  const [query, setQuery] = useState('');

  const fetchCategories = async (companyId: string): Promise<Category[]> => {
    const res = await api.get<Category[]>(`/api/v1/companies/${companyId}/products/categories`);
    return Array.isArray(res.data) ? res.data : [];
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) Resolver la empresa igual que el sidebar: attempt activo → company.
        const { data } = await api.get<any[]>('/api/v1/attempts');
        const list = Array.isArray(data) ? data : [];
        const active =
          list.find((x) => x.status === 'IN_PROGRESS') ??
          list.find((x) => x.company) ??
          list.find((x) => x.status === 'NOT_STARTED') ??
          list[0];

        const companyId: string | undefined = active?.company?.id;
        if (!companyId) {
          if (alive) setState({ phase: 'no-company' });
          return;
        }

        // 2) Traer las categorías con su conteo de productos.
        const categories = await fetchCategories(companyId);
        if (alive) setState({ phase: 'ready', companyId, categories });
      } catch {
        if (alive) {
          setState({
            phase: 'error',
            message: 'No pudimos cargar tus categorías. Intentá de nuevo en un momento.',
          });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Re-fetch tras una mutación (mantiene orden alfabético y conteos del backend).
  const refresh = async (companyId: string) => {
    try {
      const categories = await fetchCategories(companyId);
      setState({ phase: 'ready', companyId, categories });
    } catch {
      // Silencioso: la mutación ya avisó por toast; conservamos la lista previa.
    }
  };

  // ── Crear ─────────────────────────────────────────────────────
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (state.phase !== 'ready' || creating) return;

    const name = validName(newName);
    if (!name) {
      toast.error(`El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`);
      return;
    }

    setCreating(true);
    try {
      await api.post(`/api/v1/companies/${state.companyId}/products/categories`, { name });
      setNewName('');
      toast.success(`Categoría "${name}" creada.`);
      await refresh(state.companyId);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'No pudimos crear la categoría.'));
    } finally {
      setCreating(false);
    }
  };

  // ── Renombrar ─────────────────────────────────────────────────
  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleRename = async (cat: Category) => {
    if (state.phase !== 'ready' || busyId) return;

    const name = validName(editName);
    if (!name) {
      toast.error(`El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`);
      return;
    }
    if (name === cat.name) {
      cancelEdit();
      return;
    }

    setBusyId(cat.id);
    try {
      await api.patch(
        `/api/v1/companies/${state.companyId}/products/categories/${cat.id}`,
        { name },
      );
      toast.success('Categoría renombrada.');
      cancelEdit();
      await refresh(state.companyId);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'No pudimos renombrar la categoría.'));
    } finally {
      setBusyId(null);
    }
  };

  const onEditKeyDown = (e: KeyboardEvent<HTMLInputElement>, cat: Category) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleRename(cat);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // ── Eliminar ──────────────────────────────────────────────────
  const handleDelete = async (cat: Category) => {
    if (state.phase !== 'ready' || busyId) return;

    const count = cat._count?.products ?? 0;
    const ok = window.confirm(
      count > 0
        ? `¿Eliminar la categoría "${cat.name}"? Sus ${count} producto(s) quedarán sin categoría (no se borran).`
        : `¿Eliminar la categoría "${cat.name}"?`,
    );
    if (!ok) return;

    setBusyId(cat.id);
    try {
      const res = await api.delete<{ ok: boolean; detachedProducts: number }>(
        `/api/v1/companies/${state.companyId}/products/categories/${cat.id}`,
      );
      const n = res.data?.detachedProducts ?? 0;
      toast.success(
        n > 0
          ? `Categoría eliminada. ${n} producto(s) quedaron sin categoría.`
          : 'Categoría eliminada.',
      );
      if (editingId === cat.id) cancelEdit();
      await refresh(state.companyId);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'No pudimos eliminar la categoría.'));
    } finally {
      setBusyId(null);
    }
  };

  const header = (
    <PageHeader
      eyebrow="Inventario"
      title="Categorías"
      subtitle="Organizá tus productos y servicios en categorías."
      icon={FolderTree}
      iconTint="#1B2E6E"
      className="mb-6"
    />
  );

  // ── Loading ───────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <SectionCard>
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Cargando tus categorías…</p>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  // ── Sin empresa activa ────────────────────────────────────────
  if (state.phase === 'no-company') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={<SceneSearchEmpty size={200} className="cx-float" />}
              title="Aún no tenés una empresa activa"
              description="Iniciá un ejercicio para constituir tu empresa; ahí podrás organizar tus productos en categorías."
              action={
                <Link href="/estudiante" className={buttonClasses({ variant: 'primary', className: 'cx-press' })}>
                  Ir a mis ejercicios
                </Link>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={
                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-9 h-9 text-amber-600" />
                </div>
              }
              title="No pudimos cargar las categorías"
              description={state.message}
            />
          </Card>
        </div>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────
  const { categories } = state;
  const totalProducts = categories.reduce((acc, c) => acc + (c._count?.products ?? 0), 0);
  const unusedCount = categories.filter((c) => (c._count?.products ?? 0) === 0).length;
  const filteredCategories = query.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : categories;

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
      <div className="max-w-6xl mx-auto">
        {header}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard label="Categorías" value={categories.length.toLocaleString('es-CR')} icon={FolderTree} tint="#1B2E6E" className="cx-pop cx-d1" />
          <StatCard label="Productos categorizados" value={totalProducts.toLocaleString('es-CR')} icon={Package} tint="#2563EB" className="cx-pop cx-d2" />
          <StatCard label="Categorías sin uso" value={unusedCount.toLocaleString('es-CR')} icon={Tag} tint="#B8860B" className="cx-pop cx-d3" />
        </div>

        {/* Lista + alta */}
        <SectionCard flushBody className="cx-pop cx-d2">
          {/* Toolbar: crear categoría + buscador */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-wrap">
            <form onSubmit={handleCreate} className="flex items-center gap-3 flex-1 min-w-[220px]">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre de la nueva categoría"
                aria-label="Nombre de la nueva categoría"
                maxLength={NAME_MAX}
                disabled={creating}
                className="h-9 px-3 rounded-xl flex-1 min-w-[180px] max-w-sm bg-gray-50 border border-gray-200 outline-none text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white transition-colors disabled:opacity-60"
              />
              <Button type="submit" size="sm" loading={creating} className="cx-press">
                {!creating && <Plus className="w-4 h-4" />} Nueva categoría
              </Button>
            </form>

            {categories.length > 5 && (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar categoría…"
                aria-label="Buscar categoría"
                className="h-9 px-3 rounded-xl w-full sm:w-56 bg-gray-50 border border-gray-200 outline-none text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white transition-colors"
              />
            )}
          </div>

          {categories.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={180} className="cx-float" />}
              title="Aún no hay categorías"
              description="Agrupá tus ítems para reportes más claros. Creá la primera con el campo de arriba."
            />
          ) : filteredCategories.length === 0 ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={160} className="cx-float" />}
              title="Sin resultados"
              description={`No encontramos categorías que coincidan con "${query}".`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2.5 font-semibold">Nombre</th>
                    <th className="px-4 py-2.5 font-semibold w-32">Productos</th>
                    <th className="px-4 py-2.5 font-semibold w-28 text-right">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((cat) => {
                    const count = cat._count?.products ?? 0;
                    const isEditing = editingId === cat.id;
                    const isBusy = busyId === cat.id;

                    return (
                      <tr
                        key={cat.id}
                        className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => onEditKeyDown(e, cat)}
                                aria-label={`Nuevo nombre para "${cat.name}"`}
                                maxLength={NAME_MAX}
                                autoFocus
                                disabled={isBusy}
                                className="h-8 px-2.5 rounded-lg w-full max-w-xs bg-white border border-blue-300 outline-none text-sm text-gray-800 focus:border-blue-500 disabled:opacity-60"
                              />
                              <button
                                type="button"
                                onClick={() => void handleRename(cat)}
                                disabled={isBusy}
                                aria-label="Guardar nombre"
                                title="Guardar (Enter)"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50 cx-press"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isBusy}
                                aria-label="Cancelar edición"
                                title="Cancelar (Esc)"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50 cx-press"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-2.5 font-medium text-gray-800">
                              <span
                                aria-hidden
                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50"
                              >
                                <FolderTree className="w-3.5 h-3.5 text-blue-700" />
                              </span>
                              {cat.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={
                              count > 0
                                ? 'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ring-inset bg-blue-50 text-blue-700 ring-blue-100'
                                : 'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ring-inset bg-gray-50 text-gray-500 ring-gray-200'
                            }
                          >
                            {count.toLocaleString('es-CR')} {count === 1 ? 'producto' : 'productos'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => startEdit(cat)}
                                disabled={Boolean(busyId)}
                                aria-label={`Renombrar la categoría "${cat.name}"`}
                                title="Renombrar"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50 cx-press"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleDelete(cat)}
                              disabled={Boolean(busyId)}
                              aria-label={`Eliminar la categoría "${cat.name}"`}
                              title="Eliminar"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 cx-press"
                            >
                              {isBusy ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            <span className="font-mono tabular-nums">{filteredCategories.length}</span>{' '}
            {filteredCategories.length === 1 ? 'categoría' : 'categorías'}
            {query.trim() && (
              <> de <span className="font-mono tabular-nums">{categories.length}</span></>
            )}
            {' '}· ordenadas por nombre · al eliminar una categoría, sus productos no se borran: quedan sin categoría
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
