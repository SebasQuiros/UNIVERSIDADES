'use client';

import { Users, BarChart3, TrendingUp } from 'lucide-react';

/**
 * Las tres tarjetas bajo el titular de la portada.
 *
 * Reemplazan a la tablet con carrusel. Una tablet rotando obliga a esperar
 * para ver el segundo mensaje; tres tarjetas lo dicen todo de una vez, y
 * quien llega entiende en un vistazo de qué se trata el sistema.
 *
 * Cada una lleva su rótulo encima de la imagen: el texto va sobre un velo
 * oscuro con desenfoque, no directamente sobre la foto, porque sobre una
 * fotografía clara el texto blanco se pierde.
 */

const TARJETAS = [
  {
    src: '/portada/tarjeta1.webp',
    icono: Users,
    titulo: 'Gestión Empresarial',
    bajada: 'Clientes, proveedores y facturación',
  },
  {
    src: '/portada/tarjeta2.webp',
    icono: BarChart3,
    titulo: 'Finanzas y Análisis',
    bajada: 'Reportes, indicadores y razones financieras',
  },
  {
    src: '/portada/tarjeta3.webp',
    icono: TrendingUp,
    titulo: 'Crecimiento y Oportunidades',
    bajada: 'Convierte la contabilidad en resultados',
  },
];

export function TarjetasPortada() {
  return (
    <div
      className="lp-in lp-in-d6 lp-tarjetas"
      style={{ position: 'relative', zIndex: 2, width: 'min(1240px, 94vw)', margin: '6px auto 0' }}
    >
      {TARJETAS.map(({ src, icono: Icono, titulo, bajada }) => (
        <figure
          key={titulo}
          style={{
            position: 'relative',
            margin: 0,
            borderRadius: 14,
            overflow: 'hidden',
            aspectRatio: '4 / 3',
            boxShadow: '0 18px 44px rgba(27,46,110,0.18)',
            border: '1px solid rgba(27,46,110,0.08)',
          }}
        >
          {/* Carga inmediata y con prioridad: estas tres imagenes son lo
              primero que se ve al llegar. Con carga diferida aparecian unos
              instantes despues y la portada abria con tres huecos blancos,
              que es la peor primera impresion posible. */}
          <img
            src={src}
            alt={titulo}
            loading="eager"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({ fetchpriority: 'high' } as any)}
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />

          <figcaption
            style={{
              position: 'absolute',
              left: 14, right: 14, bottom: 14,
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '11px 14px',
              borderRadius: 11,
              background: 'rgba(11,26,58,0.80)',
              border: '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(6px)',
              textAlign: 'left',
            }}
          >
            <Icono size={18} color="#FFFFFF" strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                {titulo}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.35 }}>
                {bajada}
              </div>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
