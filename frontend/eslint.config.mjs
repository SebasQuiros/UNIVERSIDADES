import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// `eslint-config-next` todavía se publica en el formato viejo (eslintrc), así
// que FlatCompat lo traduce al formato plano que exige ESLint 9.
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'next-env.d.ts', 'public/**'],
  },

  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      // El proyecto usa `any` en las respuestas de la API y en handlers de
      // error. Avisar está bien; romper el build por eso, no.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',   // `catch {}` vacío es un patrón deliberado acá
      }],
      // Hay <img> intencionales (data URIs, logos inline) donde next/image
      // no aporta nada.
      '@next/next/no-img-element': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
