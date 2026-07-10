/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          900: '#1E3A5F',
        },
        csq: {
          dark:         '#03080F',   // Casi negro azulado — fondo sidebar/landing
          'dark-2':     '#060F1C',   // Un tono arriba para profundidad
          'dark-hover': '#0B1A2E',   // Hover oscuro
          mid:          '#0F2657',   // Azul noche — hover nav, bordes activos
          active:       '#1E3A8A',   // Azul medio — item activo sidebar
          accent:       '#3B82F6',   // Azul claro — botones, badges
          'accent-bright': '#60A5FA', // Azul brillante — glow, highlights
          'accent-dim': '#93c5fd',   // Azul tenue — iconos inactivos
          white:        '#FFFFFF',
          light:        '#EFF6FF',   // Azul muy claro — fondos de página
        },
        // Acento dorado de marca (antes solo inline en el landing).
        // Usado en eyebrows, avisos y detalles de las ilustraciones.
        gold: {
          50:  '#FDF6E3',   // Tinte muy claro — fondos de aviso suaves
          100: '#FDE68A',   // Dorado claro — bordes/relleno de acentos
          500: '#FBBF24',   // Dorado brillante — highlights, badges
          600: '#D4A017',   // Dorado medio — degradado de botón gold
          700: '#B8860B',   // Dorado oscuro — texto de eyebrow, iconos
          900: '#8A6608',   // Dorado profundo — texto sobre fondos claros
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        // Radio de tarjeta del lenguaje landing (24px).
        card: '1.5rem',
      },
      boxShadow: {
        // Sombras suaves compartidas, calcadas del landing.
        soft:         '0 10px 30px rgba(15,38,87,0.25)',   // superficies elevadas oscuras
        card:         '0 4px 16px rgba(27,46,110,0.06)',   // tarjeta en reposo (clara)
        'card-hover': '0 24px 48px rgba(27,46,110,0.12)',  // tarjeta en hover
        gold:         '0 12px 36px rgba(184,134,11,0.35)', // acento dorado
      },
    },
  },
  plugins: [],
};
