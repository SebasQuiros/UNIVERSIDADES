'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback — if omitted, shows the default error card */
  fallback?: React.ReactNode;
  /** Optional label shown in the error card header */
  context?: string;
}

interface State {
  hasError: boolean;
  error:    Error | null;
}

/**
 * Class-based React error boundary.
 * Use this to wrap page sections so a single failing component
 * doesn't blank the entire screen.
 *
 * Usage:
 *   <ErrorBoundary context="Tabla de facturas">
 *     <InvoicesTable />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production you'd send this to a monitoring service (Sentry, etc.)
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-red-200 bg-red-50 text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-red-800 text-sm">
              {this.props.context ? `Error en: ${this.props.context}` : 'Ocurrió un error inesperado'}
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <p className="text-xs text-red-500 mt-1 font-mono max-w-md truncate">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white border border-red-200 text-red-700 text-sm hover:bg-red-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Convenience wrapper — same as ErrorBoundary but full-page centered layout.
 * In development, surfaces the actual error message + stack to speed up debugging.
 */
export class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[PageErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Algo salió mal</h3>
            <p className="text-gray-500 text-sm mb-5">
              Ocurrió un error inesperado al cargar esta página. Recarga para intentarlo de nuevo.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="text-left bg-red-50 border border-red-200 rounded-xl p-4 mb-5 max-h-64 overflow-auto">
                <p className="text-xs font-mono font-semibold text-red-700 mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                <pre className="text-xs font-mono text-red-600 whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
