// ── Andamiaje de FASE 1 (maquetación) ───────────────────────────────────────
// Datos falsos para la feature "Sesión de Aula": unirse con código, lobby,
// mi empresa (arquetipos + cadena de suministro), auditoría entre pares y
// resultados. NADA de esto llama a `api` (ver src/lib/api.ts) — es solo para
// validar el flujo antes de construir el backend (fase 2).
//
// Los tipos están pensados para parecerse a la futura respuesta del backend:
// en fase 2, este archivo se reemplaza por llamadas reales y los componentes
// deberían cambiar poco.
//
// El paquete financiero de "Bufete Contable Herrera & Castro S.A." (empresa
// auditada) es un juego de estados financieros que CUADRA (Activo = Pasivo +
// Patrimonio en ambos períodos, el Estado de Flujo de Efectivo concilia
// exactamente el efectivo inicial con el final) y contiene UNA discrepancia
// plantada y encontrable: el saldo de Cuentas por Cobrar de su cliente
// "Constructora Rivas Hermanos S.A." no coincide con lo que el cliente
// confirma al circularizarlo. El resto de las "sorpresas" (aumento en otros
// gastos) están explicadas en las notas — a propósito, para enseñar a
// priorizar en vez de reportar todo.

import type { ElementType } from 'react';
import { BookOpen, Handshake, FileSignature, Landmark } from 'lucide-react';

// ── Fases de la sesión ──────────────────────────────────────────────────────

export type SessionPhase = 'LOBBY' | 'MI_EMPRESA' | 'AUDITORIA' | 'RESULTADOS';

export const PHASES: { key: SessionPhase; label: string }[] = [
  { key: 'LOBBY', label: 'Lobby' },
  { key: 'MI_EMPRESA', label: 'Mi empresa' },
  { key: 'AUDITORIA', label: 'Auditoría' },
  { key: 'RESULTADOS', label: 'Resultados' },
];

// ── Arquetipos de negocio ────────────────────────────────────────────────────

export type ArchetypeKey = 'FERRETERIA' | 'DISTRIBUIDORA' | 'AGENCIA_PUBLICIDAD' | 'BUFETE_CONTABLE';

export interface CompanyArchetype {
  key: ArchetypeKey;
  label: string;
  description: string;
}

export const ARCHETYPES: Record<ArchetypeKey, CompanyArchetype> = {
  FERRETERIA: {
    key: 'FERRETERIA',
    label: 'Ferretería',
    description: 'Venta al detalle de herramientas, tornillería y materiales de construcción.',
  },
  DISTRIBUIDORA: {
    key: 'DISTRIBUIDORA',
    label: 'Distribuidora',
    description: 'Mayorista que abastece de inventario a los demás negocios del aula.',
  },
  AGENCIA_PUBLICIDAD: {
    key: 'AGENCIA_PUBLICIDAD',
    label: 'Agencia de publicidad',
    description: 'Servicios de mercadeo, diseño y montaje de campañas para otras empresas.',
  },
  BUFETE_CONTABLE: {
    key: 'BUFETE_CONTABLE',
    label: 'Bufete contable',
    description: 'Servicios profesionales de contabilidad y asesoría legal-tributaria.',
  },
};

// ── La sesión ────────────────────────────────────────────────────────────────

export interface ClassSession {
  id: string;
  code: string;
  title: string;
  courseName: string;
  teacherName: string;
  phase: SessionPhase;
  participantsCount: number;
  companiesCount: number;
}

/** Código válido para "unirse" en la maqueta (fase 1). */
export const VALID_JOIN_CODE = 'K7QX2M';

export const MOCK_SESSION: ClassSession = {
  id: 'aula-viva-2t-2026',
  code: VALID_JOIN_CODE,
  title: 'Aula Viva — Cierre del II Trimestre',
  courseName: 'Contabilidad I · Grupo 02',
  teacherName: 'Prof. Andrea Jiménez Rojas',
  phase: 'LOBBY',
  participantsCount: 18,
  companiesCount: 4,
};

// ── Fase LOBBY ───────────────────────────────────────────────────────────────

export interface LobbyParticipant {
  id: string;
  name: string;
  joinedAgo: string;
  isYou: boolean;
}

export const LOBBY_PARTICIPANTS: LobbyParticipant[] = [
  { id: 'p1',  name: 'Vos',                             joinedAgo: 'recién',    isYou: true },
  { id: 'p2',  name: 'María José Alvarado Solís',        joinedAgo: 'hace 1 min', isYou: false },
  { id: 'p3',  name: 'Kevin Rojas Mora',                 joinedAgo: 'hace 1 min', isYou: false },
  { id: 'p4',  name: 'Fabiola Chinchilla Vindas',        joinedAgo: 'hace 2 min', isYou: false },
  { id: 'p5',  name: 'Diego Salazar Quesada',            joinedAgo: 'hace 2 min', isYou: false },
  { id: 'p6',  name: 'Andrea Barquero Mata',             joinedAgo: 'hace 3 min', isYou: false },
  { id: 'p7',  name: 'Josué Fernández Céspedes',         joinedAgo: 'hace 3 min', isYou: false },
  { id: 'p8',  name: 'Melissa Castro Núñez',              joinedAgo: 'hace 4 min', isYou: false },
  { id: 'p9',  name: 'Randall Gómez Araya',               joinedAgo: 'hace 4 min', isYou: false },
  { id: 'p10', name: 'Pamela Vargas Chacón',              joinedAgo: 'hace 5 min', isYou: false },
  { id: 'p11', name: 'Esteban Ramírez Brenes',            joinedAgo: 'hace 5 min', isYou: false },
  { id: 'p12', name: 'Natalia Sánchez Porras',            joinedAgo: 'hace 6 min', isYou: false },
  { id: 'p13', name: 'Luis Diego Herrera Campos',         joinedAgo: 'hace 6 min', isYou: false },
  { id: 'p14', name: 'Grettel Solano Zamora',             joinedAgo: 'hace 7 min', isYou: false },
  { id: 'p15', name: 'Jonathan Miranda Rojas',            joinedAgo: 'hace 8 min', isYou: false },
  { id: 'p16', name: 'Karla Elizondo Ureña',              joinedAgo: 'hace 8 min', isYou: false },
  { id: 'p17', name: 'Adrián Loría Montero',              joinedAgo: 'hace 9 min', isYou: false },
  { id: 'p18', name: 'Priscilla Valverde Cordero',        joinedAgo: 'hace 10 min', isYou: false },
];

/** Datos contables curiosos para que la espera del lobby no sea aburrida. */
export const WAITING_FACTS: string[] = [
  'En Costa Rica el XML es el comprobante legal ante Hacienda; el PDF es solo una representación.',
  'La ecuación contable nunca descansa: Activo = Pasivo + Patrimonio, siempre.',
  'Bajo NIIF para PYMES, el inventario se valúa al menor entre el costo y el valor neto realizable.',
  'Un auditor no prueba fraude: reporta diferencias y limitaciones al alcance (NIA 240 lo deja clarísimo).',
  '"Circularizar" es pedirle confirmación directa a un tercero — no volver a preguntarle a la propia empresa.',
  'El FIFO asume que lo primero que entra a la bodega es lo primero que sale.',
  'Una opinión "con salvedades" no invalida los estados financieros: los limita a un punto concreto.',
];

// ── Fase MI EMPRESA ──────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  suggestedRole: string;
  isYou: boolean;
}

export interface SupplyChainPartner {
  companyId: string;
  companyName: string;
  archetype: ArchetypeKey;
  note: string;
}

export interface MyCompany {
  id: string;
  name: string;
  legalId: string;
  archetype: ArchetypeKey;
  /** Ejercicio ya existente al que enlaza esta empresa (workspace contable real). */
  attemptId: string;
  members: TeamMember[];
  buysFrom: SupplyChainPartner[];
  sellsTo: SupplyChainPartner[];
}

export const MY_COMPANY: MyCompany = {
  id: 'ferreteria-martillo',
  name: 'Ferretería El Martillo',
  legalId: '3-101-445678',
  archetype: 'FERRETERIA',
  attemptId: 'demo-attempt-8841',
  members: [
    { id: 'm0', name: 'Vos',                      suggestedRole: 'Gerencia financiera',     isYou: true },
    { id: 'm1', name: 'María José Alvarado Solís', suggestedRole: 'Ventas y facturación',    isYou: false },
    { id: 'm2', name: 'Kevin Rojas Mora',          suggestedRole: 'Inventario y compras',    isYou: false },
    { id: 'm3', name: 'Fabiola Chinchilla Vindas', suggestedRole: 'Cumplimiento tributario', isYou: false },
    { id: 'm4', name: 'Diego Salazar Quesada',     suggestedRole: 'Bancos y conciliación',   isYou: false },
  ],
  buysFrom: [
    {
      companyId: 'distribuidora-central',
      companyName: 'Distribuidora Central CR S.A.',
      archetype: 'DISTRIBUIDORA',
      note: 'Inventario al por mayor: herramientas, tornillería y materiales de construcción.',
    },
  ],
  sellsTo: [
    {
      companyId: 'agencia-impacto',
      companyName: 'Agencia de Publicidad Impacto Creativo',
      archetype: 'AGENCIA_PUBLICIDAD',
      note: 'Materiales para el montaje de estands y estructuras de eventos.',
    },
    {
      companyId: 'bufete-herrera-castro',
      companyName: 'Bufete Contable Herrera & Castro S.A.',
      archetype: 'BUFETE_CONTABLE',
      note: 'Mobiliario y mantenimiento de oficina.',
    },
  ],
};

// ── Fase AUDITORÍA ───────────────────────────────────────────────────────────

export interface AuditAssignment {
  id: string;
  auditeeCompanyId: string;
  auditeeCompanyName: string;
  auditeeArchetype: ArchetypeKey;
  auditeeLegalId: string;
  periodLabel: string;
  priorPeriodLabel: string;
  budgetTotal: number;
}

export const MY_AUDIT_ASSIGNMENT: AuditAssignment = {
  id: 'audit-ferreteria-sobre-bufete',
  auditeeCompanyId: 'bufete-herrera-castro',
  auditeeCompanyName: 'Bufete Contable Herrera & Castro S.A.',
  auditeeArchetype: 'BUFETE_CONTABLE',
  auditeeLegalId: '3-101-789456',
  periodLabel: 'II Trimestre 2026 (abr–jun)',
  priorPeriodLabel: 'I Trimestre 2026 (ene–mar)',
  budgetTotal: 14,
};

/** Quién audita a MI empresa (para la fase de Resultados). */
export const MY_COMPANY_AUDITOR_NAME = 'Distribuidora Central CR S.A.';

export interface FindingAgainstMe {
  id: string;
  title: string;
  accountRef: string;
  status: 'ACEPTADO' | 'RECHAZADO' | 'EN_REVISION';
  teacherNote: string;
}

export const FINDINGS_AGAINST_MY_COMPANY: FindingAgainstMe[] = [
  {
    id: 'f-1',
    title: 'Diferencia sin explicar entre el conteo físico y el saldo en libros de Mercadería para la venta.',
    accountRef: 'Inventario — Mercadería para la venta',
    status: 'ACEPTADO',
    teacherNote: 'Hallazgo válido: falta el acta de conteo físico como respaldo del ajuste. Afecta la fiabilidad del corte de inventario.',
  },
];

// ── Paquete financiero congelado (lo que recibe el auditor) ────────────────

export interface AccountLine {
  code: string;
  name: string;
  current: number;
  prior: number;
}

export interface StatementSection {
  title: string;
  lines: AccountLine[];
  totalCurrent: number;
  totalPrior: number;
}

export interface BalanceSheetPackage {
  asOfCurrent: string;
  asOfPrior: string;
  assetSections: StatementSection[];
  liabilitySections: StatementSection[];
  equitySections: StatementSection[];
  totalAssetsCurrent: number;
  totalAssetsPrior: number;
  totalLiabEquityCurrent: number;
  totalLiabEquityPrior: number;
}

export interface IncomeStatementPackage {
  periodCurrent: string;
  periodPrior: string;
  income: AccountLine[];
  totalIncomeCurrent: number;
  totalIncomePrior: number;
  expenses: AccountLine[];
  totalExpensesCurrent: number;
  totalExpensesPrior: number;
  financialExpenseCurrent: number;
  financialExpensePrior: number;
  incomeTaxCurrent: number;
  incomeTaxPrior: number;
  netIncomeCurrent: number;
  netIncomePrior: number;
}

export interface CashFlowLine { label: string; amount: number; }

export interface CashFlowPackage {
  operating: CashFlowLine[];
  operatingTotal: number;
  investing: CashFlowLine[];
  investingTotal: number;
  financing: CashFlowLine[];
  financingTotal: number;
  netChange: number;
  cashBeginning: number;
  cashEnding: number;
}

export interface FinancialNote {
  id: string;
  title: string;
  body: string;
}

export interface TaxFiling {
  id: string;
  form: 'D-101' | 'D-103' | 'D-104' | 'D-115';
  label: string;
  period: string;
  filedAt: string;
  amount: number;
  status: 'PRESENTADA' | 'PENDIENTE';
}

export interface FrozenFinancialPackage {
  companyName: string;
  legalId: string;
  balanceSheet: BalanceSheetPackage;
  incomeStatement: IncomeStatementPackage;
  cashFlow: CashFlowPackage;
  notes: FinancialNote[];
  taxFilings: TaxFiling[];
}

export const AUDIT_PACKAGE: FrozenFinancialPackage = {
  companyName: 'Bufete Contable Herrera & Castro S.A.',
  legalId: '3-101-789456',
  balanceSheet: {
    asOfCurrent: '30 de junio de 2026',
    asOfPrior: '31 de marzo de 2026',
    assetSections: [
      {
        title: 'Activo circulante',
        lines: [
          { code: '1101', name: 'Efectivo y caja chica',            current: 2_050_000,  prior: 1_850_000 },
          { code: '1102', name: 'Bancos',                            current: 10_243_000, prior: 9_420_000 },
          { code: '1103', name: 'Cuentas por cobrar comerciales',    current: 7_650_000,  prior: 6_400_000 },
          { code: '1104', name: 'Suministros de oficina',            current: 275_000,    prior: 310_000 },
        ],
        totalCurrent: 20_218_000,
        totalPrior: 17_980_000,
      },
      {
        title: 'Activo no circulante',
        lines: [
          { code: '1201', name: 'Mobiliario y equipo de oficina',    current: 8_600_000,  prior: 8_600_000 },
          { code: '1202', name: 'Equipo de cómputo',                 current: 4_950_000,  prior: 4_200_000 },
          { code: '1203', name: 'Depreciación acumulada',            current: -2_680_000, prior: -2_150_000 },
        ],
        totalCurrent: 10_870_000,
        totalPrior: 10_650_000,
      },
    ],
    liabilitySections: [
      {
        title: 'Pasivo circulante',
        lines: [
          { code: '2101', name: 'Cuentas por pagar comerciales',     current: 1_890_000, prior: 2_140_000 },
          { code: '2102', name: 'Impuestos por pagar',               current: 1_140_000, prior: 980_000 },
          { code: '2103', name: 'Gastos acumulados por pagar',       current: 1_410_000, prior: 1_320_000 },
        ],
        totalCurrent: 4_440_000,
        totalPrior: 4_440_000,
      },
      {
        title: 'Pasivo no circulante',
        lines: [
          { code: '2201', name: 'Préstamo bancario a largo plazo',   current: 5_850_000, prior: 6_500_000 },
        ],
        totalCurrent: 5_850_000,
        totalPrior: 6_500_000,
      },
    ],
    equitySections: [
      {
        title: 'Patrimonio',
        lines: [
          { code: '3101', name: 'Capital social',                   current: 12_000_000, prior: 12_000_000 },
          { code: '3102', name: 'Utilidades retenidas',              current: 8_798_000,  prior: 5_690_000 },
        ],
        totalCurrent: 20_798_000,
        totalPrior: 17_690_000,
      },
    ],
    totalAssetsCurrent: 31_088_000,
    totalAssetsPrior: 28_630_000,
    totalLiabEquityCurrent: 31_088_000,
    totalLiabEquityPrior: 28_630_000,
  },
  incomeStatement: {
    periodCurrent: 'II Trimestre 2026 (abr–jun)',
    periodPrior: 'I Trimestre 2026 (ene–mar)',
    income: [
      { code: '4101', name: 'Ingresos por servicios profesionales', current: 12_400_000, prior: 9_800_000 },
    ],
    totalIncomeCurrent: 12_400_000,
    totalIncomePrior: 9_800_000,
    expenses: [
      { code: '5101', name: 'Planilla y cargas sociales',                current: 4_350_000, prior: 4_100_000 },
      { code: '5102', name: 'Alquiler de oficina',                       current: 950_000,   prior: 950_000 },
      { code: '5103', name: 'Servicios públicos',                        current: 410_000,   prior: 380_000 },
      { code: '5104', name: 'Honorarios profesionales subcontratados',   current: 590_000,   prior: 420_000 },
      { code: '5105', name: 'Depreciación del período',                  current: 530_000,   prior: 350_000 },
      { code: '5106', name: 'Otros gastos operativos',                   current: 950_000,   prior: 480_000 },
    ],
    totalExpensesCurrent: 7_780_000,
    totalExpensesPrior: 6_680_000,
    financialExpenseCurrent: 180_000,
    financialExpensePrior: 210_000,
    incomeTaxCurrent: 1_332_000,
    incomeTaxPrior: 873_000,
    netIncomeCurrent: 3_108_000,
    netIncomePrior: 2_037_000,
  },
  cashFlow: {
    operating: [
      { label: 'Utilidad neta',                                       amount: 3_108_000 },
      { label: 'Más: depreciación del período',                       amount: 530_000 },
      { label: 'Aumento en cuentas por cobrar comerciales',           amount: -1_250_000 },
      { label: 'Disminución en suministros de oficina',                amount: 35_000 },
      { label: 'Disminución en cuentas por pagar comerciales',        amount: -250_000 },
      { label: 'Aumento en impuestos por pagar',                      amount: 160_000 },
      { label: 'Aumento en gastos acumulados por pagar',              amount: 90_000 },
    ],
    operatingTotal: 2_423_000,
    investing: [
      { label: 'Compra de equipo de cómputo', amount: -750_000 },
    ],
    investingTotal: -750_000,
    financing: [
      { label: 'Pago de préstamo bancario a largo plazo', amount: -650_000 },
    ],
    financingTotal: -650_000,
    netChange: 1_023_000,
    cashBeginning: 11_270_000,
    cashEnding: 12_293_000,
  },
  notes: [
    {
      id: 'n1',
      title: 'Nota 1 — Base de preparación',
      body: 'Los estados financieros se prepararon de acuerdo con la NIIF para PYMES, en colones costarricenses (CRC), bajo el principio de negocio en marcha.',
    },
    {
      id: 'n2',
      title: 'Nota 2 — Concentración de cuentas por cobrar',
      body: 'Al cierre del período, el 81% del saldo de cuentas por cobrar se concentra en tres clientes: Constructora Rivas Hermanos S.A. (₡3.100.000), Soluciones Empresariales Vindas S.A. (₡1.780.000) y Hotelera Costa Azul Ltda. (₡1.340.000).',
    },
    {
      id: 'n3',
      title: 'Nota 3 — Otros gastos operativos',
      body: 'El incremento respecto al período anterior corresponde a dos pagos únicos y no recurrentes: recertificación profesional ante el Colegio de Contadores Públicos (₡620.000) y renovación de pólizas de responsabilidad civil (₡330.000).',
    },
    {
      id: 'n4',
      title: 'Nota 4 — Préstamo bancario a largo plazo',
      body: 'Préstamo con el Banco Nacional de Costa Rica, tasa fija 9,5% anual, saldo a junio 2026 de ₡5.850.000, con vencimiento en 2029 y cuotas mensuales de capital e interés.',
    },
    {
      id: 'n5',
      title: 'Nota 5 — Hechos posteriores al cierre',
      body: 'No se identificaron eventos posteriores al cierre del período que requieran ajuste o revelación adicional.',
    },
  ],
  taxFilings: [
    {
      id: 't1', form: 'D-104', label: 'IVA — I Trimestre 2026',
      period: '01/ene/2026 – 31/mar/2026', filedAt: '15/abr/2026',
      amount: 365_000, status: 'PRESENTADA',
    },
    {
      id: 't2', form: 'D-104', label: 'IVA — II Trimestre 2026',
      period: '01/abr/2026 – 30/jun/2026', filedAt: '15/jul/2026',
      amount: 482_000, status: 'PRESENTADA',
    },
    {
      id: 't3', form: 'D-101', label: 'Renta — Período fiscal 2025',
      period: '01/ene/2025 – 31/dic/2025', filedAt: '15/mar/2026',
      amount: 2_772_000, status: 'PRESENTADA',
    },
  ],
};

// ── Presupuesto de auditoría: evidencia y hallazgos ─────────────────────────

export type EvidenceType = 'MAYOR_CUENTA' | 'CIRCULARIZACION' | 'XML_FACTURA' | 'EXTRACTO_BANCARIO';

export interface EvidenceOption {
  id: string;
  label: string;
}

export interface EvidenceTypeDef {
  type: EvidenceType;
  label: string;
  description: string;
  cost: number;
  icon: ElementType;
  options: EvidenceOption[];
}

export const EVIDENCE_TYPES: EvidenceTypeDef[] = [
  {
    type: 'MAYOR_CUENTA',
    label: 'Mayor de una cuenta',
    description: 'El detalle cronológico de los movimientos de una cuenta contable específica.',
    cost: 2,
    icon: BookOpen,
    options: [
      { id: 'cxc', label: 'Cuentas por Cobrar Comerciales' },
      { id: 'gastos-otros', label: 'Otros gastos operativos' },
    ],
  },
  {
    type: 'CIRCULARIZACION',
    label: 'Circularizar saldo con la contraparte',
    description: 'Pedirle confirmación directa a un tercero sobre el saldo que la empresa dice tener con él.',
    cost: 3,
    icon: Handshake,
    options: [
      { id: 'rivas', label: 'Constructora Rivas Hermanos S.A. (cliente)' },
    ],
  },
  {
    type: 'XML_FACTURA',
    label: 'XML de una factura electrónica',
    description: 'El comprobante electrónico tal como se presentó ante Hacienda.',
    cost: 2,
    icon: FileSignature,
    options: [
      { id: 'fe-123', label: 'Factura Electrónica #00100001010000000123' },
    ],
  },
  {
    type: 'EXTRACTO_BANCARIO',
    label: 'Extracto bancario del período',
    description: 'Movimientos reales de la cuenta bancaria de la empresa auditada.',
    cost: 3,
    icon: Landmark,
    options: [
      { id: 'bn-t2', label: 'Cuenta corriente BN — abr-jun 2026' },
    ],
  },
];

export const FINDING_COST = 2;

export type FindingSeverity = 'BAJA' | 'MEDIA' | 'ALTA';

export const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
};

// ── Contenido de la evidencia solicitada ────────────────────────────────────

interface LedgerRow { date: string; description: string; debit: number; credit: number }
interface BankRow { date: string; description: string; amount: number }

export interface EvidenceContentLedger {
  kind: 'LEDGER';
  accountLabel: string;
  rows: LedgerRow[];
  total: number;
  statementAmount: number;
  note: string;
}
export interface EvidenceContentConfirmation {
  kind: 'CONFIRMATION';
  counterparty: string;
  bookBalance: number;
  confirmedBalance: number;
  letterDate: string;
  signedBy: string;
  note: string;
}
export interface EvidenceContentInvoice {
  kind: 'INVOICE';
  number: string;
  date: string;
  client: string;
  netAmount: number;
  iva: number;
  total: number;
  condition: string;
  haciendaStatus: string;
  note: string;
}
export interface EvidenceContentBankStatement {
  kind: 'BANK_STATEMENT';
  periodLabel: string;
  rows: BankRow[];
  endingBalance: number;
  note: string;
}

export type EvidenceContent =
  | EvidenceContentLedger
  | EvidenceContentConfirmation
  | EvidenceContentInvoice
  | EvidenceContentBankStatement;

const EVIDENCE_CONTENT: Record<string, EvidenceContent> = {
  'MAYOR_CUENTA:cxc': {
    kind: 'LEDGER',
    accountLabel: 'Cuentas por Cobrar Comerciales — saldos por cliente al 30/jun/2026',
    rows: [
      { date: '30/jun/2026', description: 'Constructora Rivas Hermanos S.A.',        debit: 3_100_000, credit: 0 },
      { date: '30/jun/2026', description: 'Soluciones Empresariales Vindas S.A.',     debit: 1_780_000, credit: 0 },
      { date: '30/jun/2026', description: 'Hotelera Costa Azul Ltda.',                debit: 1_340_000, credit: 0 },
      { date: '30/jun/2026', description: 'Varios clientes menores (14 clientes)',    debit: 1_430_000, credit: 0 },
    ],
    total: 7_650_000,
    statementAmount: 7_650_000,
    note: 'El mayor cuadra exactamente con el saldo del Balance General (₡7.650.000). No hay diferencia de registro interno: si hay un problema, está en la relación con el tercero, no en la contabilidad de la empresa.',
  },
  'MAYOR_CUENTA:gastos-otros': {
    kind: 'LEDGER',
    accountLabel: 'Otros gastos operativos — movimientos del período',
    rows: [
      { date: '18/may/2026', description: 'Recertificación profesional CCPA (colegiatura)', debit: 620_000, credit: 0 },
      { date: '22/may/2026', description: 'Renovación de pólizas de responsabilidad civil', debit: 330_000, credit: 0 },
    ],
    total: 950_000,
    statementAmount: 950_000,
    note: 'Coincide con el Estado de Resultados y con la Nota 3 del paquete: dos pagos únicos y documentados, no recurrentes.',
  },
  'CIRCULARIZACION:rivas': {
    kind: 'CONFIRMATION',
    counterparty: 'Constructora Rivas Hermanos S.A.',
    bookBalance: 3_100_000,
    confirmedBalance: 1_850_000,
    letterDate: '10 de julio de 2026',
    signedBy: 'Ing. Rodrigo Rivas Solano, Gerente Financiero',
    note: 'La contraparte confirma un saldo distinto al registrado en los libros de la empresa auditada (diferencia de ₡1.250.000). Una diferencia así no prueba, por sí sola, ninguna intención — pero sí es una diferencia sin explicar que amerita quedar documentada.',
  },
  'XML_FACTURA:fe-123': {
    kind: 'INVOICE',
    number: '00100001010000000123',
    date: '18 de junio de 2026',
    client: 'Constructora Rivas Hermanos S.A.',
    netAmount: 1_250_000,
    iva: 162_500,
    total: 1_412_500,
    condition: 'Crédito 30 días',
    haciendaStatus: 'Aceptada por Hacienda',
    note: 'El comprobante es válido ante Hacienda y su monto neto coincide exactamente con la diferencia detectada en la circularización. Por sí solo no explica el origen del desacuerdo con el cliente.',
  },
  'EXTRACTO_BANCARIO:bn-t2': {
    kind: 'BANK_STATEMENT',
    periodLabel: 'abr–jun 2026',
    rows: [
      { date: '05/abr/2026', description: 'Depósito transferencia — Soluciones Empresariales Vindas', amount: 1_780_000 },
      { date: '14/abr/2026', description: 'Pago de planilla',                                          amount: -2_150_000 },
      { date: '30/abr/2026', description: 'Pago CCSS',                                                  amount: -640_000 },
      { date: '12/may/2026', description: 'Depósito transferencia — Hotelera Costa Azul',              amount: 890_000 },
      { date: '18/may/2026', description: 'Pago colegiatura CCPA',                                      amount: -620_000 },
      { date: '22/may/2026', description: 'Pago pólizas de responsabilidad civil',                     amount: -330_000 },
      { date: '05/jun/2026', description: 'Depósito transferencia — varios clientes menores',          amount: 1_020_000 },
      { date: '15/jun/2026', description: 'Pago de alquiler de oficina',                                amount: -950_000 },
      { date: '28/jun/2026', description: 'Pago de cuota de préstamo BN',                               amount: -650_000 },
    ],
    endingBalance: 10_243_000,
    note: 'Extracto resumido con los movimientos principales del período (no incluye la totalidad de líneas). El saldo final coincide con "Bancos" del Balance General. No aparece ningún depósito de Constructora Rivas Hermanos S.A. en el período.',
  },
};

export function getEvidenceContent(type: EvidenceType, optionId: string): EvidenceContent | null {
  return EVIDENCE_CONTENT[`${type}:${optionId}`] ?? null;
}

// ── Opinión de auditoría ─────────────────────────────────────────────────────

export type AuditOpinionType = 'LIMPIA' | 'SALVEDADES' | 'ADVERSA' | 'ABSTENCION';

export interface OpinionOption {
  type: AuditOpinionType;
  label: string;
  description: string;
}

export const OPINION_OPTIONS: OpinionOption[] = [
  {
    type: 'LIMPIA',
    label: 'Opinión limpia (sin salvedades)',
    description: 'Los estados financieros presentan razonablemente la situación de la empresa; no se identificaron diferencias significativas sin explicar.',
  },
  {
    type: 'SALVEDADES',
    label: 'Opinión con salvedades',
    description: 'Salvo por los hallazgos puntuales identificados y citados, el resto de los estados financieros presenta razonablemente la situación de la empresa.',
  },
  {
    type: 'ADVERSA',
    label: 'Opinión adversa',
    description: 'Los hallazgos identificados son de tal magnitud que los estados financieros, en su conjunto, no presentan razonablemente la situación de la empresa.',
  },
  {
    type: 'ABSTENCION',
    label: 'Abstención de opinión',
    description: 'No fue posible reunir evidencia suficiente y apropiada para formarse una opinión.',
  },
];

// ── Fase RESULTADOS ──────────────────────────────────────────────────────────

export interface ResultCompany {
  companyId: string;
  companyName: string;
  archetype: ArchetypeKey;
  accountingScore: number;
  auditScore: number;
  combinedScore: number;
  isMine: boolean;
}

export const SESSION_RESULTS: ResultCompany[] = [
  { companyId: 'agencia-impacto',        companyName: 'Agencia de Publicidad Impacto Creativo',    archetype: 'AGENCIA_PUBLICIDAD', accountingScore: 79, auditScore: 94, combinedScore: 86.5, isMine: false },
  { companyId: 'ferreteria-martillo',    companyName: 'Ferretería El Martillo',                    archetype: 'FERRETERIA',         accountingScore: 88, auditScore: 76, combinedScore: 82.0, isMine: true },
  { companyId: 'distribuidora-central',  companyName: 'Distribuidora Central CR S.A.',              archetype: 'DISTRIBUIDORA',      accountingScore: 91, auditScore: 68, combinedScore: 79.5, isMine: false },
  { companyId: 'bufete-herrera-castro',  companyName: 'Bufete Contable Herrera & Castro S.A.',      archetype: 'BUFETE_CONTABLE',    accountingScore: 84, auditScore: 71, combinedScore: 77.5, isMine: false },
];
