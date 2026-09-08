'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Aísla el contenido de una pestaña para que un error de dibujado no se lleve
 * puesto todo el espacio de trabajo.
 *
 * Pasó de verdad: un cambio en la forma que devuelve la planilla dejó una
 * lectura sobre `undefined`; React abortó el render del árbol completo y el
 * estudiante quedó con la pantalla congelada — no podía ni cambiar de
 * pestaña, ni volver, ni entender qué había pasado. Un módulo roto es un
 * problema; un módulo roto que secuestra los otros doce es otra cosa.
 *
 * Con esto, el módulo que falla muestra su error y los demás siguen andando.
 */
interface Props {
  children: React.ReactNode;
  /** Nombre del módulo, para que el aviso diga cuál falló. */
  modulo?: string;
}

interface State {
  error: Error | null;
}

export class TabErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // A la consola del navegador: es donde se va a mirar cuando alguien
    // reporte "se me quedó pegado".
    console.error(`[${this.props.modulo ?? 'módulo'}] error de dibujado:`, error, info);
  }

  /** Al cambiar de pestaña se reintenta: el módulo pudo haberse recuperado. */
  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="rounded-card border border-amber-200 bg-amber-50/70 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <h3 className="font-bold text-amber-900">
              No se pudo mostrar {this.props.modulo ?? 'este módulo'}
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              Los demás módulos siguen funcionando: podés cambiar de pestaña y seguir
              trabajando. Tus datos no se perdieron.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Si vuelve a pasar, avisale al profesor y mencioná qué módulo era.
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </button>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-amber-700">Detalle técnico</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-2 text-[11px] text-amber-900">
                {this.state.error.message}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }
}
