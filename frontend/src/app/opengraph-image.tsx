import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo';

// Imagen social por defecto (1200×630) generada en tiempo de ejecución.
// Marca ContaSJ, sin institución específica. Se reusa como og:image y twitter:image.
export const alt = 'ContaSJ — Simulador contable y fiscal universitario de Costa Rica';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0A1535 0%, #0F2657 45%, #1B2E6E 100%)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#93C5FD',
          }}
        >
          Costa Rica · 2026
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            color: '#FFFFFF',
          }}
        >
          {SITE_NAME}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 24,
            maxWidth: 900,
            fontSize: 40,
            lineHeight: 1.35,
            color: 'rgba(255,255,255,0.82)',
          }}
        >
          Simulador contable y fiscal universitario: partida doble, facturación
          electrónica de Hacienda y declaraciones TRIBU-CR.
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 48,
            height: 8,
            width: 220,
            borderRadius: 8,
            background: 'linear-gradient(90deg, #FBBF24, #B8860B)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
