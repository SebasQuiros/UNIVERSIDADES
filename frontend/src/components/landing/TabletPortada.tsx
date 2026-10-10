'use client';

import { useEffect, useState } from 'react';

/**
 * Tablet de la portada: un marco de dispositivo donde corren las imágenes
 * del producto.
 *
 * Las imágenes NO están escritas en el código. Se publican en
 * `public/portada/` junto a un `manifest.json` que las lista:
 *
 *     { "imagenes": ["/portada/1.webp", "/portada/2.webp"] }
 *
 * Una versión anterior intentaba adivinar los archivos cargando 1.png,
 * 2.png... hasta 8 y descartando los que fallaran. Funcionaba, pero cobraba
 * ocho peticiones fallidas a CADA visitante de la portada para averiguar
 * algo que se sabe de antemano. Con el manifiesto es una sola petición y la
 * lista es explícita, así que también se controla el ORDEN.
 *
 * Si no hay manifiesto, el marco no se dibuja: una tablet vacía en la
 * portada parece un error, no una sección pendiente.
 */

const SEGUNDOS_POR_IMAGEN = 5;

interface Manifiesto {
  imagenes?: string[];
  /** Ancho/alto del marco. Lo calcula el script a partir de las imágenes. */
  aspecto?: number;
}

export function TabletPortada() {
  const [imagenes, setImagenes] = useState<string[]>([]);
  // 16:10 solo como respaldo: lo normal es que lo diga el manifiesto.
  const [aspecto, setAspecto] = useState(1.6);
  const [actual, setActual] = useState(0);

  useEffect(() => {
    let vivo = true;
    fetch('/portada/manifest.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Manifiesto | null) => {
        if (!vivo || !m?.imagenes?.length) return;
        setImagenes(m.imagenes.filter((x) => typeof x === 'string' && x.trim()));
        if (Number.isFinite(m.aspecto) && (m.aspecto as number) > 0) {
          setAspecto(m.aspecto as number);
        }
      })
      .catch(() => { /* sin manifiesto no hay tablet, y está bien */ });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (imagenes.length < 2) return;
    const t = setInterval(
      () => setActual((i) => (i + 1) % imagenes.length),
      SEGUNDOS_POR_IMAGEN * 1000,
    );
    return () => clearInterval(t);
  }, [imagenes.length]);

  if (imagenes.length === 0) return null;

  return (
    <div
      className="lp-in lp-in-d6"
      style={{ position: 'relative', zIndex: 2, width: 'min(880px, 92vw)', margin: '8px auto 0' }}
    >
      {/* Marco sobrio: el contenido es la captura, no el marco. */}
      <div
        style={{
          borderRadius: 18,
          padding: 10,
          // Marco para fondo CLARO: el translúcido blanco que tenía antes
          // desaparecía sobre la portada en blanco.
          background: 'linear-gradient(160deg, #FFFFFF, #EEF2F9)',
          border: '1px solid rgba(27,46,110,0.10)',
          boxShadow: '0 24px 60px rgba(27,46,110,0.18)',
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#0B1220',
            aspectRatio: String(aspecto),
          }}
        >
          {imagenes.map((src, i) => (
            // Todas montadas y cruzadas por opacidad: así no parpadea en
            // blanco al cambiar, que es lo que delata un carrusel barato.
            // La primera carga con prioridad; las demás, perezosas.
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden={i !== actual}
              loading={i === 0 ? 'eager' : 'lazy'}
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

      {imagenes.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 14 }}>
          {imagenes.map((src, i) => (
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
                background: i === actual ? '#1B2E6E' : 'rgba(27,46,110,0.22)',
                transition: 'all 300ms ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
