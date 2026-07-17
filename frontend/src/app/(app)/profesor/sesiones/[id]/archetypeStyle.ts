// ── Presentación de arquetipos de negocio ───────────────────────────────────
// Icono lucide + tinte de marca por arquetipo. Es configuración de UI (no
// datos falsos): se comparte entre las fases Grupos, En curso y Resultados
// para que los 4 arquetipos se vean siempre igual en toda la sesión.

import type { ElementType } from 'react';
import { Hammer, Truck, Megaphone, Scale } from 'lucide-react';
import type { BusinessArchetype } from './_mock';

export const ARCHETYPE_ICON: Record<BusinessArchetype, ElementType> = {
  FERRETERIA:               Hammer,
  DISTRIBUIDORA_MAYORISTA:  Truck,
  AGENCIA_PUBLICIDAD:       Megaphone,
  BUFETE_CONTABLE:          Scale,
};

export const ARCHETYPE_TINT: Record<BusinessArchetype, string> = {
  FERRETERIA:               '#B8860B',
  DISTRIBUIDORA_MAYORISTA:  '#059669',
  AGENCIA_PUBLICIDAD:       '#2563EB',
  BUFETE_CONTABLE:          '#1B2E6E',
};
