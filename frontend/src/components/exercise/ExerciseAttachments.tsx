'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Paperclip, Trash2, Download, FileText, ImageIcon,
  FileSpreadsheet, Loader2, UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExerciseAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface Props {
  courseId: string;
  exerciseId: string;
  /** true = profesor (puede subir/eliminar); false = estudiante (solo ver). */
  editable?: boolean;
}

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp';

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string) {
  if (mime === 'application/pdf') return <FileText className="h-5 w-5 flex-shrink-0 text-red-500" />;
  if (mime.startsWith('image/')) return <ImageIcon className="h-5 w-5 flex-shrink-0 text-blue-600" />;
  if (mime.includes('spreadsheet') || mime.includes('excel'))
    return <FileSpreadsheet className="h-5 w-5 flex-shrink-0 text-emerald-600" />;
  return <FileText className="h-5 w-5 flex-shrink-0 text-gray-500" />;
}

function getToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const auth = localStorage.getItem('auth') ?? sessionStorage.getItem('auth') ?? '{}';
    return JSON.parse(auth)?.access_token ?? '';
  } catch { return ''; }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ExerciseAttachments({ courseId, exerciseId, editable = false }: Props) {
  const [items, setItems] = useState<ExerciseAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const base = `/api/v1/courses/${courseId}/exercises/${exerciseId}/attachments`;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<ExerciseAttachment[]>(base);
      setItems(data);
    } catch {
      /* silencioso: sin adjuntos o sin acceso aún */
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo supera el límite de 10 MB');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const fileData = await toBase64(file);
      const { data } = await api.post<ExerciseAttachment>(base, {
        fileName: file.name, mimeType: file.type, fileData,
      });
      setItems((prev) => [...prev, data]);
      toast.success('Material adjuntado');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'No se pudo subir el archivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      await api.delete(`${base}/${id}`);
      setItems((prev) => prev.filter((a) => a.id !== id));
      toast.success('Material eliminado');
    } catch {
      toast.error('No se pudo eliminar');
    }
  }

  function handleDownload(id: string, name: string) {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? ''}${base}/${id}/download`;
    fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((blob) => {
        const burl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = burl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.click();
        URL.revokeObjectURL(burl);
      })
      .catch(() => toast.error('No se pudo abrir el archivo'));
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Cargando material…</div>;
  }

  // El estudiante sin adjuntos no ve nada (evita ruido visual).
  if (!editable && items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((att) => (
            <li key={att.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
              {fileIcon(att.mimeType)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{att.fileName}</p>
                <p className="text-xs tabular-nums text-gray-400">{fmtBytes(att.fileSize)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(att.id, att.fileName)}
                className="cx-press rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
                title="Ver / descargar"
              >
                <Download className="h-4 w-4" />
              </button>
              {editable && (
                <button
                  type="button"
                  onClick={() => handleDelete(att.id, att.fileName)}
                  className="cx-press rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        editable && (
          <p className="flex items-center gap-2 text-sm text-gray-400">
            <Paperclip className="h-4 w-4" /> Aún no has adjuntado material al caso.
          </p>
        )
      )}

      {editable && (
        <label className={cn(
          'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-semibold transition-colors',
          uploading
            ? 'border-gray-200 text-gray-400'
            : 'border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50',
        )}>
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
            : <><UploadCloud className="h-4 w-4" /> Adjuntar material (PDF, Word, Excel, imágenes — máx. 10 MB)</>
          }
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
