import type { ReactNode } from 'react';

// Envuelve todo el módulo de Tributación con `.tribu-calm` para desactivar las
// animaciones ambientales (deriva/rebote/entradas escalonadas) que hacían
// "bailar" la pantalla. `display:contents` no genera caja, así que no altera
// el layout flex de las páginas; la clase sigue aplicando a los descendientes.
export default function ImpuestosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tribu-calm" style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
