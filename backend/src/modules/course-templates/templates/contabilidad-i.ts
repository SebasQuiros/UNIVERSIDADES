// Plantilla de curso base: Contabilidad I.
// Currículo estándar de contabilidad (Costa Rica), NO específico de una
// universidad — es una base reutilizable y adaptable por cualquier institución.
// Contenido "listo para usar" definido en código (versionable). Se instancia
// en un Course real del profesor vía CourseTemplatesService.applyTemplate().
// Rúbricas: solo criterios auto-calificables por auto-grading.service.ts.
// Competencias: se referencian por `code` del catálogo global (phase7).

export interface TemplateRubric {
  criterion: string;
  description: string;
  expectedValue?: string;   // p.ej. "1.1.01:100000" para account_balance_*
  points: number;
}
export interface TemplateExercise {
  title: string;
  description: string;
  instructions: string;
  difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  type: 'FULL_CYCLE' | 'JOURNAL_ONLY' | 'INVOICING_ONLY' | 'INVENTORY_ONLY';
  competencyCodes: string[];   // del catálogo global: C1..C10
  rubrics: TemplateRubric[];
}
export interface CourseTemplate {
  key: string;
  code: string;
  name: string;
  description: string;
  exercises: TemplateExercise[];
}

// Códigos reales del plan de cuentas por defecto (accounts.service.ts):
//   Caja/Bancos = 1.1.01 · IVA por Pagar = 2.1.02 · Inventario = 1.1.03
export const CONTABILIDAD_I: CourseTemplate = {
  key: 'contabilidad-i',
  code: 'CONTA-I',
  name: 'Contabilidad I',
  description:
    'Curso fundamental: de la ecuación contable y la partida doble al ciclo contable ' +
    'completo de una empresa costarricense. Recorrido Constituir → Operar → Declarar → ' +
    'Cerrar → Analizar.',
  exercises: [
    {
      title: '1. Constitución y ecuación contable',
      description: 'Constituye tu empresa y registra el aporte inicial de capital.',
      instructions:
        'Crea tu empresa de servicios. Registra el asiento de apertura por el aporte de ' +
        'capital del socio (débito a Caja/Bancos, crédito a Capital Social). Verifica que ' +
        'se cumpla la ecuación contable: Activo = Pasivo + Patrimonio.',
      difficulty: 'BASIC',
      type: 'FULL_CYCLE',
      competencyCodes: ['C1'],
      rubrics: [
        { criterion: 'has_company',           description: 'Empresa constituida', points: 15 },
        { criterion: 'min_entries',           description: 'Al menos 1 asiento registrado', expectedValue: '1', points: 15 },
        { criterion: 'balanced_entries',      description: 'Los asientos cuadran (débito = crédito)', points: 40 },
        { criterion: 'account_balance_gte',   description: 'Caja/Bancos con saldo por el aporte', expectedValue: '1.1.01:1', points: 30 },
      ],
    },
    {
      title: '2. Registro de transacciones en el diario',
      description: 'Registra las operaciones del giro en el libro diario.',
      instructions:
        'Registra al menos 5 transacciones del mes: compra de mobiliario, pago de ' +
        'servicios, registro de un cliente y un producto/servicio. Todos los asientos deben ' +
        'cuadrar.',
      difficulty: 'BASIC',
      type: 'FULL_CYCLE',
      competencyCodes: ['C1'],
      rubrics: [
        { criterion: 'min_entries',      description: 'Al menos 5 asientos', expectedValue: '5', points: 30 },
        { criterion: 'balanced_entries', description: 'Todos los asientos cuadran', points: 40 },
        { criterion: 'min_clients',      description: 'Al menos 1 cliente registrado', expectedValue: '1', points: 15 },
        { criterion: 'min_products',     description: 'Al menos 1 producto/servicio', expectedValue: '1', points: 15 },
      ],
    },
    {
      title: '3. Ventas de servicios y cuentas por cobrar',
      description: 'Emite facturas de servicios a crédito y de contado.',
      instructions:
        'Registra al menos 2 clientes y emite 3 facturas de servicios (algunas a crédito, ' +
        'generando Cuentas por Cobrar). Verifica el registro contable de cada venta.',
      difficulty: 'BASIC',
      type: 'INVOICING_ONLY',
      competencyCodes: ['C1'],
      rubrics: [
        { criterion: 'has_issued_invoices', description: 'Se emitieron facturas', points: 20 },
        { criterion: 'min_invoices',        description: 'Al menos 3 facturas', expectedValue: '3', points: 30 },
        { criterion: 'balanced_entries',    description: 'Asientos de venta cuadrados', points: 30 },
        { criterion: 'min_clients',         description: 'Al menos 2 clientes', expectedValue: '2', points: 20 },
      ],
    },
    {
      title: '4. Compras y ventas con IVA 13%',
      description: 'Aplica el IVA en compras y ventas; reconoce el IVA por pagar.',
      instructions:
        'Emite al menos 5 facturas gravadas con IVA 13%. Registra el IVA débito fiscal en ' +
        'la cuenta IVA por Pagar (2.1.02). Este es el insumo de la declaración D-104.',
      difficulty: 'INTERMEDIATE',
      type: 'FULL_CYCLE',
      competencyCodes: ['C1', 'C5', 'C6'],
      rubrics: [
        { criterion: 'min_invoices',        description: 'Al menos 5 facturas con IVA', expectedValue: '5', points: 25 },
        { criterion: 'has_issued_invoices', description: 'Facturación electrónica emitida', points: 25 },
        { criterion: 'balanced_entries',    description: 'Asientos cuadrados', points: 25 },
        { criterion: 'account_balance_gte', description: 'IVA por Pagar con saldo (débito fiscal)', expectedValue: '2.1.02:1', points: 25 },
      ],
    },
    {
      title: '5. Compras de mercadería e inventario',
      description: 'Registra compras de mercadería y controla el inventario.',
      instructions:
        'Registra al menos 3 productos y sus compras de mercadería. El Inventario (1.1.03) ' +
        'debe reflejar saldo. Registra al menos 8 asientos en total.',
      difficulty: 'INTERMEDIATE',
      type: 'INVENTORY_ONLY',
      competencyCodes: ['C1', 'C4'],
      rubrics: [
        { criterion: 'min_products',        description: 'Al menos 3 productos', expectedValue: '3', points: 25 },
        { criterion: 'min_entries',         description: 'Al menos 8 asientos', expectedValue: '8', points: 25 },
        { criterion: 'balanced_entries',    description: 'Asientos cuadrados', points: 25 },
        { criterion: 'account_balance_gte', description: 'Inventario con saldo', expectedValue: '1.1.03:1', points: 25 },
      ],
    },
    {
      title: '6. Balance de comprobación',
      description: 'Mayoriza y comprueba la igualdad de saldos.',
      instructions:
        'Con al menos 10 asientos registrados, revisa el mayor y el balance de comprobación. ' +
        'La suma de débitos debe igualar la de créditos y el balance debe cuadrar.',
      difficulty: 'INTERMEDIATE',
      type: 'FULL_CYCLE',
      competencyCodes: ['C1', 'C2'],
      rubrics: [
        { criterion: 'min_entries',           description: 'Al menos 10 asientos', expectedValue: '10', points: 30 },
        { criterion: 'balanced_entries',      description: 'Todos los asientos cuadran', points: 40 },
        { criterion: 'balance_sheet_balanced',description: 'Balance de situación cuadrado', points: 30 },
      ],
    },
    {
      title: '7. Asientos de ajuste',
      description: 'Registra devengados, diferidos, depreciación e incobrables.',
      instructions:
        'Registra los asientos de ajuste del período (depreciación, gastos devengados, ' +
        'estimación de incobrables). Usa la palabra "ajuste" o referencia ADJ. Debes llegar ' +
        'a al menos 12 asientos.',
      difficulty: 'INTERMEDIATE',
      type: 'JOURNAL_ONLY',
      competencyCodes: ['C2'],
      rubrics: [
        { criterion: 'has_adjustment_entries', description: 'Asientos de ajuste registrados', points: 40 },
        { criterion: 'balanced_entries',       description: 'Asientos cuadrados', points: 30 },
        { criterion: 'min_entries',            description: 'Al menos 12 asientos', expectedValue: '12', points: 30 },
      ],
    },
    {
      title: '8. Estados financieros básicos',
      description: 'Prepara el Estado de Resultados y el Balance General.',
      instructions:
        'Genera el Estado de Resultados (debe dar utilidad) y el Balance General (debe ' +
        'cuadrar: Activo = Pasivo + Patrimonio).',
      difficulty: 'INTERMEDIATE',
      type: 'FULL_CYCLE',
      competencyCodes: ['C3'],
      rubrics: [
        { criterion: 'balance_sheet_balanced',    description: 'Balance General cuadrado', points: 40 },
        { criterion: 'income_statement_positive', description: 'Estado de Resultados con utilidad', points: 30 },
        { criterion: 'balanced_entries',          description: 'Asientos cuadrados', points: 30 },
      ],
    },
    {
      title: '9. Cierre contable',
      description: 'Cierra las cuentas de resultado y determina la utilidad del período.',
      instructions:
        'Registra los asientos de cierre (débito a ingresos, crédito a gastos, traslado a ' +
        'resultados). Tras el cierre, el Balance debe seguir cuadrado.',
      difficulty: 'ADVANCED',
      type: 'FULL_CYCLE',
      competencyCodes: ['C2', 'C3'],
      rubrics: [
        { criterion: 'has_closing_entries',    description: 'Asientos de cierre registrados', points: 40 },
        { criterion: 'balance_sheet_balanced', description: 'Balance cuadrado tras el cierre', points: 30 },
        { criterion: 'has_adjustment_entries', description: 'Ajustes previos registrados', points: 30 },
      ],
    },
    {
      title: '10. Ciclo contable completo (proyecto integrador)',
      description: 'Opera una empresa un mes completo: de la constitución al cierre fiscal.',
      instructions:
        'Proyecto integrador: constituye la empresa, opera un mes (facturación con IVA, ' +
        'compras, cobros y pagos), registra ajustes, prepara estados financieros y cierra el ' +
        'período. Emite al menos 8 facturas.',
      difficulty: 'ADVANCED',
      type: 'FULL_CYCLE',
      competencyCodes: ['C1', 'C2', 'C3', 'C5'],
      rubrics: [
        { criterion: 'has_company',               description: 'Empresa constituida', points: 10 },
        { criterion: 'min_invoices',              description: 'Al menos 8 facturas', expectedValue: '8', points: 15 },
        { criterion: 'balanced_entries',          description: 'Asientos cuadrados', points: 20 },
        { criterion: 'has_adjustment_entries',    description: 'Asientos de ajuste', points: 15 },
        { criterion: 'has_closing_entries',       description: 'Asientos de cierre', points: 15 },
        { criterion: 'balance_sheet_balanced',    description: 'Balance General cuadrado', points: 15 },
        { criterion: 'income_statement_positive', description: 'Resultado con utilidad', points: 10 },
      ],
    },
  ],
};

export const COURSE_TEMPLATES: CourseTemplate[] = [CONTABILIDAD_I];
