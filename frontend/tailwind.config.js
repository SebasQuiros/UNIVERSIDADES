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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
