// ── Paleta compartida de la librería de ilustraciones ──────────────────────────
// Un único set de colores de marca para que TODAS las ilustraciones (objetos
// contables y personajes 2D) se vean como una sola familia coherente.
// No inventamos colores: son los de la paleta de marca de ContaSJ.

export const ILLO = {
  // Azules noche (degradados / fondos oscuros)
  night:   '#0F2657',
  navy:    '#1B2E6E',
  royal:   '#1E3A8A',
  // Acentos azules
  blue:    '#2563EB',
  blue400: '#3B82F6',
  blue300: '#60A5FA',
  blue200: '#93C5FD',
  blue100: '#DBEAFE',
  blue50:  '#EFF6FF',
  // Dorados de marca
  goldDark:   '#B8860B',
  gold:       '#D4A017',
  goldBright: '#FBBF24',
  goldLight:  '#FDE68A',
  goldTint:   '#FDF6E3',
  // Neutros / slate
  ink:      '#0F172A',
  slate:    '#334155',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  surface:  '#F3F4F6',
  white:    '#FFFFFF',
  // Semánticos
  success:       '#16A34A',
  successBright: '#34D399',
  error:         '#EF4444',
  // Piel / cabello (personajes) — tonos neutros cálidos, minimalistas
  skin:       '#F1C9A5',
  skinShadow: '#E0AE86',
  hairDark:   '#2A2320',
  hairMid:    '#4B3A2E',
  // Sombra plana de suelo bajo los personajes / objetos
  ground: 'rgba(15,38,87,0.10)',
} as const;

// ── Props comunes ──────────────────────────────────────────────────────────────
// Cada ilustración recibe un `size` (ancho en px); la altura se deriva de la
// proporción de su viewBox. `className` permite envolver con animaciones del
// consumidor (p. ej. `lp-drift`, que ya respeta prefers-reduced-motion).
export interface IllustrationProps {
  /** Ancho en px. La altura se calcula según la proporción del viewBox. */
  size?: number;
  /** Clases utilitarias opcionales (posicionamiento, animación del consumidor). */
  className?: string;
}
