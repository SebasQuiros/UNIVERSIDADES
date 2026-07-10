// ── Librería de ilustraciones de marca (SVG inline, hechas a mano) ─────────────
// Objetos contables (spot-art) + escenas de personajes 2D planos. Sin emojis,
// sin raster, sin <img> externo: 100% vectorial en la paleta de ContaSJ.
//
// Uso:
//   import { ArtBalance, SceneEmptyBox } from '@/components/illustrations';
//   <ArtBalance size={200} className="lp-drift" />
//
// Todas aceptan { size?: number; className?: string } y son aria-hidden.

export { ILLO } from './palette';
export type { IllustrationProps } from './palette';

// Objetos contables (spot-art)
export { ArtBalance } from './ArtBalance';
export { ArtInvoice } from './ArtInvoice';
export { ArtGrowth } from './ArtGrowth';
export { ArtCoins } from './ArtCoins';
export { ArtLedger } from './ArtLedger';
export { ArtFiscalCalendar } from './ArtFiscalCalendar';
export { ArtBankReconcile } from './ArtBankReconcile';
export { ArtInventory } from './ArtInventory';
export { ArtReport } from './ArtReport';

// Escenas de personajes 2D planos
export { SceneStudentDesk } from './SceneStudentDesk';
export { SceneWelcome } from './SceneWelcome';
export { SceneEmptyBox } from './SceneEmptyBox';
export { SceneSearchEmpty } from './SceneSearchEmpty';
