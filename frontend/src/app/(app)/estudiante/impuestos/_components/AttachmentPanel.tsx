'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Paperclip, Trash2, Download, FileText, ImageIcon, Loader2, X } from 'lucide-react';

export interface Attachment {
  id: string;
  lineKey: string;
  lineLabel: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

interface Props {
  declarationId: string | null;  // null = borrador aún no guardado
  lineKey: string;
  lineLabel: string;
  attachments: Attachment[];
  onAttachmentAdded: (att: Attachment) => void;
  onAttachmentRemoved: (id: string) => void;
  disabled?: boolean;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPanel({
  declarationId, lineKey, lineLabel, attachments, onAttachmentAdded, onAttachmentRemoved, disabled,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const lineAtts = attachments.filter(a => a.lineKey === lineKey);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !declarationId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo supera el límite de 10 MB');
      return;
    }

    setUploading(true);
    try {
      const fileData = await toBase64(file);
      const { data } = await api.post<Attachment>(
        `/api/v1/tax-declarations/${declarationId}/attachments`,
        { lineKey, lineLabel, fileName: file.name, mimeType: file.type, fileData },
      );
      onAttachmentAdded(data);
      toast.success('Comprobante adjuntado');
    } catch {
      toast.error('No se pudo subir el archivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`) || !declarationId) return;
    try {
      await api.delete(`/api/v1/tax-declarations/${declarationId}/attachments/${id}`);
      onAttachmentRemoved(id);
      toast.success('Comprobante eliminado');
    } catch {
      toast.error('No se pudo eliminar');
    }
  }

  function handleDownload(id: string, name: string) {
    if (!declarationId) return;
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/tax-declarations/${declarationId}/attachments/${id}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.target = '_blank';
    // attach Authorization header via fetch + blob
    fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob);
        a.href = burl;
        a.click();
        URL.revokeObjectURL(burl);
      })
      .catch(() => toast.error('No se pudo descargar'));
  }

  return (
    <div className="ml-1 relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={disabled || !declarationId}
        title={!declarationId ? 'Guarda el borrador primero para adjuntar comprobantes' : 'Adjuntar comprobante'}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
          lineAtts.length > 0
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
      >
        <Paperclip className="w-3 h-3" />
        {lineAtts.length > 0 ? lineAtts.length : ''}
        <span className="hidden sm:inline">{lineAtts.length > 0 ? 'adjunto(s)' : 'Adjuntar'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 w-80">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-blue-500" />
              Comprobantes — {lineLabel}
            </p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Adjunta las facturas o recibos que respaldan este monto. (PDF, JPG, PNG — máx. 10 MB c/u)
          </p>

          {/* Archivos adjuntos */}
          {lineAtts.length > 0 && (
            <div className="space-y-2 mb-3">
              {lineAtts.map(att => (
                <div key={att.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                  {att.mimeType === 'application/pdf'
                    ? <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                    : <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{att.fileName}</p>
                    <p className="text-xs text-gray-400">{fmtBytes(att.fileSize)}</p>
                  </div>
                  <button
                    onClick={() => handleDownload(att.id, att.fileName)}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Ver / descargar"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {!disabled && (
                    <button
                      onClick={() => handleDelete(att.id, att.fileName)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Botón subir */}
          {!disabled && (
            <label className={`flex items-center justify-center gap-2 w-full py-2 text-xs font-medium border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              uploading ? 'border-gray-200 text-gray-400' : 'border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50'
            }`}>
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
                : <><Paperclip className="w-4 h-4" /> Seleccionar archivo</>
              }
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFile}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result = "data:application/pdf;base64,XXXXX"
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const auth = localStorage.getItem('auth') ?? sessionStorage.getItem('auth') ?? '{}';
    return JSON.parse(auth)?.access_token ?? '';
  } catch { return ''; }
}
