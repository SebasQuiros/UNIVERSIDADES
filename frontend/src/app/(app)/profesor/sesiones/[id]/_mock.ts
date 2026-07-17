// ============================================================================
// ANDAMIAJE DE MAQUETA — Fase 1 (sin backend real)
// ----------------------------------------------------------------------------
// Datos falsos para la pantalla de control de una sesión de aula: 30
// estudiantes ticos-plausibles repartidos en 6 empresas con arquetipos de
// negocio, la cadena de comercio B2B entre ellas, el cruce de auditoría y el
// resultado final. Todos los montos son colones (₡) creíbles para una PYME.
//
// En la Fase 2 este archivo se reemplaza por llamadas al cliente `api` (ver
// src/lib/api.ts), p. ej. `GET /api/v1/class-sessions/:id`,
// `GET /api/v1/class-sessions/:id/companies`, `.../trades`, `.../audit`,
// `.../results`. Los tipos de abajo están pensados para calzar con esas
// respuestas, para que migrar sea sobre todo cambiar el origen de los datos.
// ============================================================================

// ── Arquetipos de negocio ───────────────────────────────────────────────────

export type BusinessArchetype =
  | 'FERRETERIA'
  | 'DISTRIBUIDORA_MAYORISTA'
  | 'AGENCIA_PUBLICIDAD'
  | 'BUFETE_CONTABLE';

export const ARCHETYPE_LABELS: Record<BusinessArchetype, string> = {
  FERRETERIA:               'Ferretería',
  DISTRIBUIDORA_MAYORISTA:  'Distribuidora mayorista',
  AGENCIA_PUBLICIDAD:       'Agencia de publicidad',
  BUFETE_CONTABLE:          'Bufete contable',
};

export const ARCHETYPE_DESCRIPTIONS: Record<BusinessArchetype, string> = {
  FERRETERIA:              'Vende materiales de construcción y herramientas al público; compra mercadería a las distribuidoras.',
  DISTRIBUIDORA_MAYORISTA: 'Vende mercadería al por mayor a las ferreterías de la sesión.',
  AGENCIA_PUBLICIDAD:      'Vende servicios de mercadeo y diseño al resto de las empresas.',
  BUFETE_CONTABLE:         'Vende servicios de contabilidad y auditoría al resto de las empresas.',
};

/** Qué vende cada arquetipo, para etiquetar los flujos de comercio. */
export const ARCHETYPE_PRODUCT: Record<BusinessArchetype, string> = {
  FERRETERIA:               'Mercadería al detalle',
  DISTRIBUIDORA_MAYORISTA:  'Mercadería al por mayor',
  AGENCIA_PUBLICIDAD:       'Servicios de publicidad',
  BUFETE_CONTABLE:          'Servicios contables',
};

// ── Estudiantes y empresas ──────────────────────────────────────────────────

export interface RosterStudent {
  id: string;
  name: string;
}

/** Los 30 estudiantes de la sesión, en orden de unión al lobby. */
export const ROSTER: RosterStudent[] = [
  { id: 'stu-01', name: 'María José Solís Vargas' },
  { id: 'stu-02', name: 'Andrés Rodríguez Jiménez' },
  { id: 'stu-03', name: 'Fernanda Mora Chacón' },
  { id: 'stu-04', name: 'Kenneth Zamora Araya' },
  { id: 'stu-05', name: 'Yendry Salazar Quesada' },
  { id: 'stu-06', name: 'Esteban Brenes Alvarado' },
  { id: 'stu-07', name: 'Gabriela Camacho Rojas' },
  { id: 'stu-08', name: 'Marlon Hidalgo Valverde' },
  { id: 'stu-09', name: 'Pamela Chinchilla Cordero' },
  { id: 'stu-10', name: 'Jonathan Navarro Barboza' },
  { id: 'stu-11', name: 'Priscilla Vindas Villalobos' },
  { id: 'stu-12', name: 'Randall Solano Mata' },
  { id: 'stu-13', name: 'Tatiana Fallas Ureña' },
  { id: 'stu-14', name: 'Kevin Montero Segura' },
  { id: 'stu-15', name: 'Melissa Arce Gamboa' },
  { id: 'stu-16', name: 'Warner Castro Loría' },
  { id: 'stu-17', name: 'Silvia Rojas Herrera' },
  { id: 'stu-18', name: 'Ronald Guzmán Picado' },
  { id: 'stu-19', name: 'Karol Alfaro Monge' },
  { id: 'stu-20', name: 'Luis Diego Vega Chavarría' },
  { id: 'stu-21', name: 'Natalia Sequeira Bolaños' },
  { id: 'stu-22', name: 'Josué Elizondo Porras' },
  { id: 'stu-23', name: 'Adriana Miranda Duarte' },
  { id: 'stu-24', name: 'Mauricio Ovares Aguilar' },
  { id: 'stu-25', name: 'Vanessa Calderón Fernández' },
  { id: 'stu-26', name: 'Diego Umaña Rosales' },
  { id: 'stu-27', name: 'Paola Redondo Campos' },
  { id: 'stu-28', name: 'Sergio Blanco Sancho' },
  { id: 'stu-29', name: 'Katherine Pérez Granados' },
  { id: 'stu-30', name: 'Alonso Sibaja Cerdas' },
];

/** Cuántos ya estaban conectados cuando se abrió esta maqueta del lobby. */
export const LOBBY_BASELINE_CONNECTED = 8;
/** Total al que la animación de unión del lobby converge (de 30 matriculados). */
export const LOBBY_TARGET_CONNECTED = 18;

export interface SessionCompanyMember {
  studentId: string;
  name: string;
  isLeader: boolean;
}

export interface SessionCompany {
  id: string;
  name: string;
  /** Cédula jurídica con formato costarricense (3-101-XXXXXX). */
  legalId: string;
  archetype: BusinessArchetype;
  members: SessionCompanyMember[];
}

function membersOf(ids: string[]): SessionCompanyMember[] {
  return ids.map((id, i) => {
    const s = ROSTER.find((r) => r.id === id)!;
    return { studentId: s.id, name: s.name, isLeader: i === 0 };
  });
}

export const MOCK_COMPANIES: SessionCompany[] = [
  {
    id: 'emp-1',
    name: 'Ferretería Central CR S.A.',
    legalId: '3-101-745102',
    archetype: 'FERRETERIA',
    members: membersOf(['stu-01', 'stu-02', 'stu-03', 'stu-04', 'stu-05']),
  },
  {
    id: 'emp-2',
    name: 'Distribuidora del Valle S.A.',
    legalId: '3-101-812233',
    archetype: 'DISTRIBUIDORA_MAYORISTA',
    members: membersOf(['stu-06', 'stu-07', 'stu-08', 'stu-09', 'stu-10']),
  },
  {
    id: 'emp-3',
    name: 'Creativa Publicidad Tica S.A.',
    legalId: '3-101-698744',
    archetype: 'AGENCIA_PUBLICIDAD',
    members: membersOf(['stu-11', 'stu-12', 'stu-13', 'stu-14', 'stu-15']),
  },
  {
    id: 'emp-4',
    name: 'Contadores Asociados CR S.A.',
    legalId: '3-101-556190',
    archetype: 'BUFETE_CONTABLE',
    members: membersOf(['stu-16', 'stu-17', 'stu-18', 'stu-19', 'stu-20']),
  },
  {
    id: 'emp-5',
    name: 'Ferretería Los Pinos S.A.',
    legalId: '3-101-903671',
    archetype: 'FERRETERIA',
    members: membersOf(['stu-21', 'stu-22', 'stu-23', 'stu-24', 'stu-25']),
  },
  {
    id: 'emp-6',
    name: 'Mayorista Comercial Heredia S.A.',
    legalId: '3-101-467820',
    archetype: 'DISTRIBUIDORA_MAYORISTA',
    members: membersOf(['stu-26', 'stu-27', 'stu-28', 'stu-29', 'stu-30']),
  },
];

/**
 * Regla de negocio de la cadena de comercio, derivada de los arquetipos:
 * distribuidoras venden a ferreterías; bufetes y agencias venden servicios al
 * resto (menos a su propio arquetipo). Se usa tanto en la vista previa de
 * Grupos como para explicar el mapa de comercio de En curso.
 */
export function deriveSupplyChain(companies: SessionCompany[]): Array<{ fromId: string; toId: string; product: string }> {
  const edges: Array<{ fromId: string; toId: string; product: string }> = [];
  for (const seller of companies) {
    for (const buyer of companies) {
      if (seller.id === buyer.id) continue;
      if (seller.archetype === 'DISTRIBUIDORA_MAYORISTA' && buyer.archetype === 'FERRETERIA') {
        edges.push({ fromId: seller.id, toId: buyer.id, product: ARCHETYPE_PRODUCT.DISTRIBUIDORA_MAYORISTA });
      }
      if (seller.archetype === 'BUFETE_CONTABLE' && buyer.archetype !== 'BUFETE_CONTABLE') {
        edges.push({ fromId: seller.id, toId: buyer.id, product: ARCHETYPE_PRODUCT.BUFETE_CONTABLE });
      }
      if (seller.archetype === 'AGENCIA_PUBLICIDAD' && buyer.archetype !== 'AGENCIA_PUBLICIDAD') {
        edges.push({ fromId: seller.id, toId: buyer.id, product: ARCHETYPE_PRODUCT.AGENCIA_PUBLICIDAD });
      }
    }
  }
  return edges;
}

// ── Fase EN CURSO: KPIs por empresa ─────────────────────────────────────────

export interface CompanyLiveStats {
  companyId: string;
  invoicesIssued: number;
  journalEntries: number;
  /** ¿El balance de comprobación está cuadrado en este momento? */
  isBalanced: boolean;
  salesTotal: number;
  purchasesTotal: number;
  lastActivity: string;
}

export const MOCK_LIVE_STATS: CompanyLiveStats[] = [
  { companyId: 'emp-1', invoicesIssued: 47, journalEntries: 132, isBalanced: true,  salesTotal: 4850000, purchasesTotal: 2380000, lastActivity: 'hace 1 min' },
  { companyId: 'emp-2', invoicesIssued: 8,  journalEntries: 58,  isBalanced: true,  salesTotal: 2100500, purchasesTotal: 495000,  lastActivity: 'hace 3 min' },
  { companyId: 'emp-3', invoicesIssued: 9,  journalEntries: 41,  isBalanced: true,  salesTotal: 1468500, purchasesTotal: 150000,  lastActivity: 'hace 2 min' },
  { companyId: 'emp-4', invoicesIssued: 5,  journalEntries: 37,  isBalanced: true,  salesTotal: 955000,  purchasesTotal: 165000,  lastActivity: 'hace 5 min' },
  { companyId: 'emp-5', invoicesIssued: 52, journalEntries: 145, isBalanced: false, salesTotal: 5220000, purchasesTotal: 2464750, lastActivity: 'hace menos de 1 min' },
  { companyId: 'emp-6', invoicesIssued: 6,  journalEntries: 52,  isBalanced: true,  salesTotal: 1750750, purchasesTotal: 620000,  lastActivity: 'hace 4 min' },
];

// ── Fase EN CURSO: mapa de comercio (matriz vende → compra) ────────────────

export interface TradeFlow {
  fromCompanyId: string;
  toCompanyId: string;
  amount: number;
  invoicesCount: number;
  product: string;
}

export const MOCK_TRADES: TradeFlow[] = [
  { fromCompanyId: 'emp-2', toCompanyId: 'emp-1', amount: 1240000, invoicesCount: 5, product: ARCHETYPE_PRODUCT.DISTRIBUIDORA_MAYORISTA },
  { fromCompanyId: 'emp-2', toCompanyId: 'emp-5', amount: 860500,  invoicesCount: 3, product: ARCHETYPE_PRODUCT.DISTRIBUIDORA_MAYORISTA },
  { fromCompanyId: 'emp-6', toCompanyId: 'emp-1', amount: 640000,  invoicesCount: 2, product: ARCHETYPE_PRODUCT.DISTRIBUIDORA_MAYORISTA },
  { fromCompanyId: 'emp-6', toCompanyId: 'emp-5', amount: 1110750, invoicesCount: 4, product: ARCHETYPE_PRODUCT.DISTRIBUIDORA_MAYORISTA },
  { fromCompanyId: 'emp-4', toCompanyId: 'emp-1', amount: 180000,  invoicesCount: 1, product: ARCHETYPE_PRODUCT.BUFETE_CONTABLE },
  { fromCompanyId: 'emp-4', toCompanyId: 'emp-2', amount: 220000,  invoicesCount: 1, product: ARCHETYPE_PRODUCT.BUFETE_CONTABLE },
  { fromCompanyId: 'emp-4', toCompanyId: 'emp-3', amount: 150000,  invoicesCount: 1, product: ARCHETYPE_PRODUCT.BUFETE_CONTABLE },
  { fromCompanyId: 'emp-4', toCompanyId: 'emp-5', amount: 195000,  invoicesCount: 1, product: ARCHETYPE_PRODUCT.BUFETE_CONTABLE },
  { fromCompanyId: 'emp-4', toCompanyId: 'emp-6', amount: 210000,  invoicesCount: 1, product: ARCHETYPE_PRODUCT.BUFETE_CONTABLE },
  { fromCompanyId: 'emp-3', toCompanyId: 'emp-1', amount: 320000,  invoicesCount: 2, product: ARCHETYPE_PRODUCT.AGENCIA_PUBLICIDAD },
  { fromCompanyId: 'emp-3', toCompanyId: 'emp-2', amount: 275000,  invoicesCount: 2, product: ARCHETYPE_PRODUCT.AGENCIA_PUBLICIDAD },
  { fromCompanyId: 'emp-3', toCompanyId: 'emp-4', amount: 165000,  invoicesCount: 1, product: ARCHETYPE_PRODUCT.AGENCIA_PUBLICIDAD },
  { fromCompanyId: 'emp-3', toCompanyId: 'emp-5', amount: 298500,  invoicesCount: 2, product: ARCHETYPE_PRODUCT.AGENCIA_PUBLICIDAD },
  { fromCompanyId: 'emp-3', toCompanyId: 'emp-6', amount: 410000,  invoicesCount: 2, product: ARCHETYPE_PRODUCT.AGENCIA_PUBLICIDAD },
];

// ── Fase AUDITORÍA ───────────────────────────────────────────────────────────
//
// IMPORTANTE (doctrina NIA 240): el sistema detecta *diferencias* al cruzar
// las dos puntas de cada transacción. Una diferencia puede ser un error, un
// criterio contable distinto o algo que amerita revisión — el sistema no
// puede distinguirlos y NUNCA debe insinuar intención. El juicio es del
// docente. Por eso ningún texto de este archivo usa palabras como "fraude",
// "trampa" o "engaño"; se limita a describir el hecho detectado.

export type AuditCategory = 'INGRESOS' | 'GASTOS' | 'IVA' | 'INVENTARIO' | 'OTRO';
export type ReviewPriority = 'BAJA' | 'MEDIA' | 'ALTA';

export interface AuditFinding {
  id: string;
  auditedCompanyId: string;
  category: AuditCategory;
  /** Lenguaje neutral y descriptivo — nunca acusatorio. */
  description: string;
  amountDetected: number | null;
  /** Qué tan pronto conviene que el docente lo revise, no un juicio de culpa. */
  reviewPriority: ReviewPriority;
  /** ¿El equipo auditor también reportó esta misma diferencia? */
  reportedByAuditor: boolean;
}

/** Quién audita a quién (asignación cruzada, nadie se audita a sí mismo). */
export const AUDIT_ASSIGNMENTS: Record<string, string> = {
  'emp-1': 'emp-3',
  'emp-2': 'emp-4',
  'emp-3': 'emp-5',
  'emp-4': 'emp-6',
  'emp-5': 'emp-1',
  'emp-6': 'emp-2',
};

export const MOCK_AUDIT_FINDINGS: AuditFinding[] = [
  {
    id: 'find-1', auditedCompanyId: 'emp-1', category: 'IVA',
    description: 'El IVA acreditado por la compra a Distribuidora del Valle S.A. (₡148.800) no coincide con el IVA facturado por la contraparte (₡161.200).',
    amountDetected: 12400, reviewPriority: 'MEDIA', reportedByAuditor: true,
  },
  {
    id: 'find-2', auditedCompanyId: 'emp-1', category: 'GASTOS',
    description: 'El gasto por servicios de publicidad de Creativa Publicidad Tica S.A. coincide en monto, pero se registró en un periodo distinto al de la factura.',
    amountDetected: null, reviewPriority: 'BAJA', reportedByAuditor: false,
  },
  {
    id: 'find-3', auditedCompanyId: 'emp-2', category: 'INGRESOS',
    description: 'No se encontró registro de la venta de ₡860.500 a Ferretería Los Pinos S.A. del 11 de marzo en el diario de esta empresa, aunque la contraparte sí registró la compra.',
    amountDetected: 860500, reviewPriority: 'ALTA', reportedByAuditor: true,
  },
  {
    id: 'find-4', auditedCompanyId: 'emp-2', category: 'IVA',
    description: 'El IVA declarado en la venta a Ferretería Central CR S.A. (₡148.800) es menor al que resulta de aplicar la tarifa general sobre el monto facturado (₡161.200).',
    amountDetected: 12400, reviewPriority: 'MEDIA', reportedByAuditor: true,
  },
  // emp-3: sin diferencias detectadas — se muestra explícitamente como "limpia".
  {
    id: 'find-5', auditedCompanyId: 'emp-4', category: 'GASTOS',
    description: 'El gasto por la compra de mercadería a Mayorista Comercial Heredia S.A. (₡210.000) no tiene una factura electrónica asociada en el módulo de compras.',
    amountDetected: 210000, reviewPriority: 'MEDIA', reportedByAuditor: true,
  },
  {
    id: 'find-6', auditedCompanyId: 'emp-5', category: 'INVENTARIO',
    description: 'El costo de venta reportado para las unidades vendidas no es consistente con el método PEPS que la empresa declaró para ese producto.',
    amountDetected: null, reviewPriority: 'MEDIA', reportedByAuditor: false,
  },
  {
    id: 'find-7', auditedCompanyId: 'emp-5', category: 'IVA',
    description: 'El IVA acreditado por la compra a Mayorista Comercial Heredia S.A. (₡133.290) no coincide con el IVA facturado por la contraparte (₡144.398).',
    amountDetected: 11108, reviewPriority: 'BAJA', reportedByAuditor: true,
  },
  {
    id: 'find-8', auditedCompanyId: 'emp-5', category: 'OTRO',
    description: 'El balance de comprobación de esta empresa presenta una diferencia de ₡1.250 entre el total de débitos y créditos al cierre del periodo.',
    amountDetected: 1250, reviewPriority: 'BAJA', reportedByAuditor: true,
  },
  {
    id: 'find-9', auditedCompanyId: 'emp-6', category: 'INGRESOS',
    description: 'El monto de la venta a Ferretería Los Pinos S.A. registrado por esta empresa (₡1.110.750) no coincide con el monto de la compra registrada por la contraparte (₡1.175.000).',
    amountDetected: 64250, reviewPriority: 'ALTA', reportedByAuditor: true,
  },
  {
    id: 'find-10', auditedCompanyId: 'emp-6', category: 'GASTOS',
    description: 'El gasto por servicios contables (₡210.000) se registró sin la factura electrónica correspondiente adjunta.',
    amountDetected: null, reviewPriority: 'BAJA', reportedByAuditor: false,
  },
];

export interface AuditorSubmission {
  auditedCompanyId: string;
  auditorCompanyId: string;
  itemsReported: number;
  submittedAt: string;
  note: string;
}

export const MOCK_AUDITOR_SUBMISSIONS: AuditorSubmission[] = [
  { auditedCompanyId: 'emp-1', auditorCompanyId: 'emp-3', itemsReported: 1, submittedAt: '2026-07-17T15:42:00-06:00', note: 'Reportamos una diferencia de IVA en la compra a Distribuidora del Valle. El resto de las facturas cruzan correctamente.' },
  { auditedCompanyId: 'emp-2', auditorCompanyId: 'emp-4', itemsReported: 2, submittedAt: '2026-07-17T15:38:00-06:00', note: 'Encontramos una venta sin registrar en el diario y una diferencia de IVA. Ambas están documentadas con el detalle de las facturas cruzadas.' },
  { auditedCompanyId: 'emp-3', auditorCompanyId: 'emp-5', itemsReported: 0, submittedAt: '2026-07-17T15:50:00-06:00', note: 'Cruzamos las nueve facturas emitidas por esta empresa contra los registros de compra de cada contraparte; todas coinciden en monto, fecha e IVA.' },
  { auditedCompanyId: 'emp-4', auditorCompanyId: 'emp-6', itemsReported: 1, submittedAt: '2026-07-17T15:33:00-06:00', note: 'Detectamos un gasto sin respaldo de factura electrónica. El resto de los movimientos cruzan correctamente.' },
  { auditedCompanyId: 'emp-5', auditorCompanyId: 'emp-1', itemsReported: 2, submittedAt: '2026-07-17T15:47:00-06:00', note: 'Reportamos la diferencia de IVA y el descuadre del balance de comprobación. No detectamos el tema de costeo de inventario.' },
  { auditedCompanyId: 'emp-6', auditorCompanyId: 'emp-2', itemsReported: 1, submittedAt: '2026-07-17T15:29:00-06:00', note: 'Encontramos la diferencia en el monto de la venta a Ferretería Los Pinos. No revisamos a fondo el módulo de gastos.' },
];

// ── Fase RESULTADOS ──────────────────────────────────────────────────────────

export interface CompanyResult {
  companyId: string;
  /** Calidad de la contabilidad propia (0–100), a partir de las diferencias detectadas contra esta empresa. */
  accountingScore: number;
  /** Calidad del trabajo de auditoría hecho a otra empresa (0–100). */
  auditScore: number;
  combinedScore: number;
  rank: number;
}

export const MOCK_RESULTS: CompanyResult[] = [
  { companyId: 'emp-4', accountingScore: 90, auditScore: 96, combinedScore: 92.4, rank: 1 },
  { companyId: 'emp-3', accountingScore: 97, auditScore: 70, combinedScore: 86.2, rank: 2 },
  { companyId: 'emp-5', accountingScore: 81, auditScore: 92, combinedScore: 85.4, rank: 3 },
  { companyId: 'emp-6', accountingScore: 78, auditScore: 94, combinedScore: 84.4, rank: 4 },
  { companyId: 'emp-1', accountingScore: 88, auditScore: 78, combinedScore: 84.0, rank: 5 },
  { companyId: 'emp-2', accountingScore: 74, auditScore: 68, combinedScore: 71.6, rank: 6 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function companyById(id: string): SessionCompany | undefined {
  return MOCK_COMPANIES.find((c) => c.id === id);
}

export function companyName(id: string): string {
  return companyById(id)?.name ?? 'Empresa desconocida';
}
