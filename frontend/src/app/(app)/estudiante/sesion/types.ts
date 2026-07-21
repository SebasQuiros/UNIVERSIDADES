// ── Tipos de "Sesión de Aula" del lado estudiante ───────────────────────────
// Calzan con las respuestas reales del backend (ver
// `backend/src/modules/class-sessions/class-sessions.service.ts`).

import type { ClassSessionArchetype, ClassSessionStatus } from '@/lib/classSession';

export interface MyCompany {
  id: string;
  name: string;
  legalId: string;
  archetype: ClassSessionArchetype;
}

export interface MyGroupMember {
  id: string;
  name: string;
  role: string;
}

export interface MeResponse {
  status: ClassSessionStatus;
  companyId: string | null;
  company: MyCompany | null;
  groupMembers: MyGroupMember[];
  attemptId: string | null;
}

export interface LiveGroup {
  companyId: string;
  name: string;
  archetype: ClassSessionArchetype;
  memberCount: number;
}

export interface LiveResponse {
  status: ClassSessionStatus;
  code: string;
  participantsCount: number;
  groups: LiveGroup[];
}

export interface AuditAssignment {
  auditeeCompanyId: string;
  auditeeName: string;
  archetype: ClassSessionArchetype;
}

// ── Snapshot congelado (paquete que recibe el auditor) ──────────────────────
// Forma real de `ReportsService.getTrialBalance/getBalanceSheet/getIncomeStatement`.

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  isHeader: boolean;
  normalBalance: string;
  totalDebit: string;
  totalCredit: string;
  balance: string;
}

export interface TrialBalanceReport {
  reportType: 'TRIAL_BALANCE';
  company: { id: string; name: string; legalId?: string };
  generatedAt: string;
  rows: AccountRow[];
  totals: { totalDebit: string; totalCredit: string; difference: string; isBalanced: boolean };
}

export interface BalanceSheetReport {
  reportType: 'BALANCE_SHEET';
  company: { id: string; name: string; legalId?: string };
  asOfDate: string;
  assets: { accounts: AccountRow[]; total: string };
  liabilities: { accounts: AccountRow[]; total: string };
  equity: { accounts: AccountRow[]; total: string };
  totals: {
    totalAssets: string; totalLiabilities: string; totalEquity: string;
    currentNetIncome: string; adjustedEquity: string; totalLiabEquity: string;
    isBalanced: boolean; difference: string;
  };
}

export interface IncomeStatementReport {
  reportType: 'INCOME_STATEMENT';
  company: { id: string; name: string; legalId?: string };
  income: { accounts: AccountRow[]; total: string };
  expenses: { accounts: AccountRow[]; total: string };
  totals: { totalIncome: string; totalExpenses: string; netIncome: string; isProfit: boolean };
}

export type TaxDeclarationType = 'D104_IVA' | 'D101_RENTA' | 'D103_RETENCION' | 'D115_DIVIDENDOS';

export interface TaxDeclarationSummary {
  type: TaxDeclarationType;
  presentada: boolean;
  period?: string;
  result?: unknown;
  referenceNo?: string;
  submittedAt?: string;
}

export interface TaxDeclarationsReport {
  declaraciones?: TaxDeclarationSummary[];
  nota?: string;
}

export interface AuditSnapshot {
  trialBalance: TrialBalanceReport | null;
  balanceSheet: BalanceSheetReport | null;
  incomeStatement: IncomeStatementReport | null;
  taxDeclarations: TaxDeclarationsReport | null;
  publishedAt: string;
}

// ── Hallazgos de auditoría ───────────────────────────────────────────────────

export interface AuditFinding {
  id: string;
  assignmentId: string;
  createdById: string;
  section: string;
  accountCode: string | null;
  description: string;
  claimedAmount: string | number | null;
  createdAt: string;
  matched: boolean | null;
  matchDetail: string | null;
}
