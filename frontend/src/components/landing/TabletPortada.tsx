'use client';

import { useEffect, useState } from 'react';

/**
 * Tablet de la portada: un marco de dispositivo donde corren las imágenes
 * del producto.
 *
 * Las imágenes las pone el dueño del sistema, no el código. Para agregarlas
 * basta con dejar los archivos en `frontend/public/portada/` numerados:
 *
 *     public/portada/1.png
 *     public/portada/2.png
 *     public/portada/3.png   … hasta 8
 *
 * No hay que tocar nada más. El componente intenta cargar 1..8, descarta en
 * silencio las que no existen y rota solo las que encontró. Se hizo así a
 * propósito: pedirle a alguien que edite un arreglo en TypeScript cada vez
 * que quiere cambiar una captura es una forma seductora de que la portada
 * se quede desactualizada para siempre.
 *
 * Si no hay ninguna imagen, el marco NO se dibuja: una tablet vacía en la
 * portada parece un error, no una sección pendiente.
 */

const MAXIMO = 8;
const SEGUNDOS_POR_IMAGEN = 5;

export function TabletPortada() {
  const [disponibles, setDisponibles] = useState<string[]>([]);
  const [actual, setActual] = useState(0);

  // Descubrimiento: se intenta cargar cada archivo y se conserva el que
  // responde. Es una comprobación de cliente, sin endpoint ni build step.
  useEffect(() => {
    let vivo = true;
    const candidatas = Array.from({ length: MAXIMO }, (_, i) => `/portada/${i + 1}.png`);

    Promise.all(
      candidatas.map(
        (src) =>
          new Promise<string | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = () => resolve(null);
            img.src = src;
          }),
      ),
    ).then((r) => {
      if (vivo) setDisponibles(r.filter((x): x is string => !!x));
    });

    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (disponibles.length < 2) return;
    const t = setInterval(
      () => setActual((i) => (i + 1) % disponibles.length),
      SEGUNDOS_POR_IMAGEN * 1000,
    );
    return () => clearInterval(t);
  }, [disponibles.length]);

  if (disponibles.length === 0) return null;

  return (
    <div
      className="lp-in lp-in-d6"
      style={{
        position: 'relative', zIndex: 2,
        width: 'min(880px, 92vw)',
        margin: '8px auto 0',
      }}
    >
      {/* Marco del dispositivo. Biselado sobrio, sin brillos ni reflejos
          falsos: el contenido es la captura, no el marco. */}
      <div
        style={{
          borderRadius: 18,
          padding: 10,
          background: 'linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#0B1220',
            aspectRatio: '16 / 10',
          }}
        >
          {disponibles.map((src, i) => (
            // Todas montadas y cruzadas por opacidad: así no parpadea en
            // blanco al cambiar, que es lo que delata un carrusel barato.
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden={i !== actual}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover',
                opacity: i === actual ? 1 : 0,
                transition: 'opacity 900ms ease-in-out',
              }}
            />
          ))}
        </div>
      </div>

      {/* Indicadores: solo si de verdad hay varias. */}
      {disponibles.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 14 }}>
          {disponibles.map((src, i) => (
            <button
              key={src}
              onClick={() => setActual(i)}
              aria-label={`Imagen ${i + 1}`}
              style={{
                width: i === actual ? 22 : 7,
                height: 7,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: i === actual ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)',
                transition: 'all 300ms ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
