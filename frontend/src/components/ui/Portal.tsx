'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Saca su contenido al final del `<body>`.
 *
 * Existe por un problema concreto y difícil de ver: un elemento con
 * `transform` se convierte en el marco de referencia de sus hijos
 * `position: fixed`. Las tarjetas de la interfaz entran con animación
 * (`lp-in`, `cx-pop`) y `animation-fill-mode: both`, así que al terminar
 * conservan un transform — identidad, pero transform al fin.
 *
 * Resultado: cualquier modal dentro de una tarjeta animada se dibuja
 * ENCERRADO en esa tarjeta en vez de cubrir la pantalla. Se ve como un
 * formulario cortado, montado sobre el contenido, imposible de usar.
 *
 * Poner `transform: none` en el último fotograma NO lo arregla: la animación
 * interpola el transform y el valor final se resuelve igual a la matriz
 * identidad. Comprobado en el navegador. La única salida es sacar el modal
 * del árbol de la tarjeta, que es lo que hace esto.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [montado, setMontado] = useState(false);

  // En el servidor no hay `document`: se dibuja solo después de montar.
  useEffect(() => {
    setMontado(true);
    return () => setMontado(false);
  }, []);

  if (!montado) return null;
  return createPortal(children, document.body);
}
