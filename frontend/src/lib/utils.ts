import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * HTML-escape para evitar XSS al inyectar valores controlados por el usuario
 * en strings de HTML (p.ej. `document.write` en ventanas de impresión).
 *
 * Reemplaza los 5 caracteres peligrosos: & < > " '
 * Convierte cualquier valor a string primero (null/undefined → '').
 *
 * Uso:
 *   `<td>${esc(item.description)}</td>`
 */
export function esc(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-CR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000;
  } catch {
    return 0;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as any).response?.data;
    if (resp?.message) {
      return Array.isArray(resp.message) ? resp.message[0] : resp.message;
    }
  }
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}
