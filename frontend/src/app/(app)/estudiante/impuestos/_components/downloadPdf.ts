import { api } from '@/lib/api';

/**
 * Download the PDF receipt of a submitted tax declaration.
 * Triggers a browser download with the backend-provided filename.
 */
export async function downloadDeclarationPdf(declarationId: string, fallbackName = 'declaracion.pdf') {
  const response = await api.get(`/api/v1/tax-declarations/${declarationId}/pdf`, {
    responseType: 'blob',
  });

  // Extract filename from Content-Disposition if present
  const disp = (response.headers['content-disposition'] || response.headers['Content-Disposition']) as string | undefined;
  let filename = fallbackName;
  if (disp) {
    const match = /filename="?([^"]+)"?/i.exec(disp);
    if (match?.[1]) filename = match[1];
  }

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
