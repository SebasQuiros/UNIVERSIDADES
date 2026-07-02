# Curso base — Contabilidad I

> Currículo **estándar de contabilidad (Costa Rica)**, reutilizable y adaptable por
> cualquier universidad — NO específico de una institución. Curso fundamental.
> Recorrido pedagógico alineado a **Constituir → Operar → Declarar → Cerrar →
> Analizar**. Cada ejercicio mapea a competencias del catálogo base y usa
> **solo rúbricas auto-calificables** por el motor actual.
>
> *(La estructura de temas se validó tomando como una de varias referencias planes
> de estudio reales de universidades costarricenses, pero el contenido es genérico.)*

## Criterios de rúbrica disponibles (auto-calificables)
`has_company` · `has_issued_invoices` · `min_invoices:N` · `min_entries:N` ·
`min_clients:N` · `min_products:N` · `time_spent_min:N` · `balanced_entries` ·
`balance_sheet_balanced` · `income_statement_positive` · `has_adjustment_entries` ·
`has_closing_entries` · `account_balance_gte|lte|eq:"CODIGO:MONTO"`

## Competencias que cubre el curso
- **C1** Registro contable · **C2** Ciclo contable y cierre · **C3** Estados financieros
- Introducción a **C4** Costos e inventarios · **C5** Obligaciones tributarias · **C6** Facturación electrónica

## Progresión (10 ejercicios)

| # | Ejercicio | Dificultad | Etapa | Comp. | Rúbricas (criterio → pts) |
|---|-----------|:----------:|-------|-------|----------------------------|
| 1 | **Constitución y ecuación contable** | Básico | Constituir | C1 | has_company 15 · min_entries:1 15 · balanced_entries 40 · account_balance_gte caja 30 |
| 2 | **Registro de transacciones en el diario** | Básico | Operar | C1 | min_entries:5 30 · balanced_entries 40 · min_clients:1 15 · min_products:1 15 |
| 3 | **Ventas de servicios y cuentas por cobrar** | Básico | Operar | C1 | has_issued_invoices 20 · min_invoices:3 30 · balanced_entries 30 · min_clients:2 20 |
| 4 | **Compras y ventas con IVA 13%** | Intermedio | Declarar | C1·C5·C6 | min_invoices:5 25 · has_issued_invoices 25 · balanced_entries 25 · account_balance_gte IVA débito 25 |
| 5 | **Compras de mercadería e inventario** | Intermedio | Operar | C1·C4 | min_products:3 25 · min_entries:8 25 · balanced_entries 25 · account_balance_gte inventario 25 |
| 6 | **Balance de comprobación** | Intermedio | Operar | C1·C2 | min_entries:10 30 · balanced_entries 40 · balance_sheet_balanced 30 |
| 7 | **Asientos de ajuste** | Intermedio | Cerrar | C2 | has_adjustment_entries 40 · balanced_entries 30 · min_entries:12 30 |
| 8 | **Estados financieros básicos** | Intermedio | Analizar | C3 | balance_sheet_balanced 40 · income_statement_positive 30 · balanced_entries 30 |
| 9 | **Cierre contable** | Avanzado | Cerrar | C2·C3 | has_closing_entries 40 · balance_sheet_balanced 30 · has_adjustment_entries 30 |
| 10 | **Ciclo contable completo (capstone)** | Avanzado | Todas | C1·C2·C3·C5 | has_company 10 · min_invoices:8 15 · balanced_entries 20 · has_adjustment_entries 15 · has_closing_entries 15 · balance_sheet_balanced 15 · income_statement_positive 10 |

*Cada ejercicio suma 100 pts (maxScore). Los `account_balance_*` usan el código real del
plan de cuentas sembrado (caja, IVA por pagar, inventario) al momento de crear el seed.*

## Matriz de cobertura de competencias
| Comp. | Ejercicios que la evidencian |
|-------|------------------------------|
| C1 Registro | 1, 2, 3, 4, 5, 6, 10 |
| C2 Ciclo y cierre | 6, 7, 9, 10 |
| C3 Estados financieros | 8, 9, 10 |
| C4 Costos e inventarios | 5 |
| C5 Obligaciones tributarias | 4, 10 |
| C6 Facturación electrónica | 4 |

## Notas de diseño
- Cada ejercicio incluirá **enunciado + instrucciones** (escenario de una empresa tica
  concreta) además de las rúbricas.
- El seed creará: 1 `Course` "Contabilidad I (COFI-122)", 10 `Exercise` publicados con
  sus `ExerciseRubric`, y los vínculos `ExerciseCompetency`.
- Será una **plantilla activable**: al clonarla a un curso real del profesor se copian
  ejercicios y rúbricas (sin arrastrar intentos de estudiantes).

## Pendiente de validación
1. ¿La progresión y dificultad son correctas para Contabilidad I de la UTN?
2. ¿Faltan/sobran temas? (p.ej. depreciación, incobrables, conciliación bancaria — hoy
   depreciación/incobrables entran en el E7 de ajustes).
3. ¿10 ejercicios está bien, o prefieres 6–8 más densos?
