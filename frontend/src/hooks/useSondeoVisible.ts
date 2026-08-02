'use client';

import { useEffect, useRef } from 'react';

/**
 * Sondeo periódico que se DETIENE cuando la pestaña no está a la vista.
 *
 * Por qué importa: los estudiantes dejan la pestaña abierta toda la clase —y
 * a veces todo el día— mientras trabajan en otra cosa. Con `setInterval` a
 * secas, esa pantalla sigue preguntando al servidor cada pocos segundos sin
 * que nadie la esté mirando.
 *
 * Con 1500 alumnos, la pantalla de sesión sondeando cada 4 s son ~375
 * peticiones por segundo, y cada una son 3 consultas a la base: más de 1000
 * consultas por segundo con el sistema en reposo. Pausar lo invisible quita
 * la mayor parte de eso sin que el usuario note ninguna diferencia: al volver
 * a la pestaña se refresca de inmediato.
 *
 * @param fn        qué ejecutar en cada vuelta
 * @param intervalo milisegundos entre vueltas
 * @param activo    permite apagarlo sin desmontar el componente
 */
export function useSondeoVisible(fn: () => void, intervalo: number, activo = true) {
  // La referencia evita reprogramar el temporizador en cada render solo
  // porque `fn` cambió de identidad.
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }, [fn]);

  useEffect(() => {
    if (!activo || intervalo <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const arrancar = () => {
      if (timer) return;
      timer = setInterval(() => ref.current(), intervalo);
    };
    const parar = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        parar();
      } else {
        // Al volver, refrescar YA: si no, el usuario vería datos viejos
        // durante un intervalo entero justo cuando vuelve a mirar.
        ref.current();
        arrancar();
      }
    };

    if (!document.hidden) arrancar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    return () => {
      parar();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [intervalo, activo]);
}
