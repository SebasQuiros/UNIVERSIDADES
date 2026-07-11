# ContaSJ — Accounting Manifest

> **Contrato arquitectónico del motor contable.**
> Toda decisión técnica —código, esquema, endpoints, IA— debe respetar estos invariantes.
> Si una funcionalidad los viola, se replantea la funcionalidad, no el invariante.
>
> Estado: **F0 (cimientos)**. Cada invariante lleva su estado actual auditado (`enforced` / `partial` / `gap`)
> con evidencia `archivo:línea`. Los `gap`/`partial` son el backlog de F0.

---

## 0. Propósito

ContaSJ es un simulador contable-fiscal universitario donde **cada acción del estudiante nace de un evento de negocio** que cascadea efectos reales y **matemáticamente consistentes**. Este documento define las leyes que garantizan esa consistencia. Son el contrato que el `AccountingEngine`, el `BusinessEventsService`, el `FinancialStatementEngine`, el `Projection Engine` y el `PedagogicalEngine` deben cumplir siempre.

## 1. Principios rectores

1. **El Diario General es la única fuente de verdad financiera.** Todo saldo y todo estado financiero se derivan de `JournalEntry` + `JournalLine` (CONFIRMED, no reversados). Nada financiero se guarda como saldo autoritativo.
2. **Todo nace de un evento de negocio atómico.** Un evento y todos sus efectos (documento fuente, inventario, IVA, CxC/CxP, asiento, proyecciones) se confirman o revierten como una sola unidad.
3. **Las proyecciones son vistas derivadas, reconstruibles.** CxC, CxP, inventario, KPIs, `Product.stock`, `Invoice.balanceDue` optimizan lectura/UX; nunca son una verdad financiera competidora y deben reconciliar con su cuenta de control.
4. **Los asientos son inmutables; se corrige por reversión, no por edición.**
5. **Precisión determinista, verbalización por IA.** Los motores calculan y deciden qué es correcto; el LLM nunca calcula ni decide errores.

---

## 2. Invariantes

Notación de estado: **✅ enforced** · **🟡 partial** · **🔴 gap** (acción F0).

### A. Fuente de verdad

- **I-SoT-1 ✅ — Diario autoritativo.** Todos los saldos de cuenta y estados financieros se computan desde `JournalLine` con `entry.status = CONFIRMED` y `entry.isReversed = false`.
  *Evidencia:* `ledger.service.ts:24-37`, `reports.service.ts:28-89` (groupBy sobre `journalLine`, sin campo de saldo persistido).
- **I-SoT-2 ✅ — Cero saldos persistidos.** No existe campo `balance` en `Account`. `Saldo(cuenta) = Σ(debit|credit)` según `normalBalance`.
  *Evidencia:* `schema.prisma` (Account sin balance); `reports.service.ts:28-89`.
- **I-SoT-3 🟡 — Proyecciones reconciliables.** `AccountReceivable`/`AccountPayable`/`Product.stock`/`InventoryLot`/`Invoice.balanceDue` son proyecciones. Deben cumplir la **reconciliación control↔subledger** (I-SoT-4). Hoy se mantienen correctas por construcción, pero **falta la verificación automática** de reconciliación y el comando de rebuild (→ Projection Engine, §3).
  *Evidencia:* `ar-records.service.ts:100-122` (`AR.balance === Invoice.balanceDue`); `ap-records.service.ts:83-107`.
- **I-SoT-4 🟡 — Control = Σ subledger.** El saldo de cada **cuenta de control** en el Diario (CxC, CxP, Inventario) debe igualar la suma de su **subledger operativo** (Σ `Invoice.balanceDue` abiertas, Σ `InventoryLot.qtyRemaining × unitCost`). Es la regla clásica mayor-control ↔ auxiliar. **A blindar con un invariante verificable en F0.**

### B. Doble partida e integridad del asiento

- **I-DE-1 ✅ — Partida doble.** `Σdébitos = Σcréditos` por asiento, tolerancia `0.001` (Decimal.js). Pre-validación + re-validación **dentro** de la transacción.
  *Evidencia:* `journal.service.ts:154-165` y `:232-248`; tests `journal-validation.spec.ts`.
- **I-DE-2 ✅ — Líneas válidas.** ≥2 líneas; montos ≥ 0; no se aceptan líneas con débito y crédito ambos en cero.
  *Evidencia:* `journal.dto.ts:1-46`.
- **I-DE-3 ✅ (consecuencia) — Ecuación contable.** `Activo = Pasivo + Patrimonio` en todo momento, garantizado por I-DE-1. Se eleva a **test de invariante** del sistema (§5).

### C. Inmutabilidad y corrección por reversión

- **I-IM-1 ✅ — Asiento inmutable.** No hay API de `UPDATE`/`DELETE` de `JournalEntry`/`JournalLine` posteados. `journal.controller.ts` solo expone `GET`/`POST`/`PATCH(confirm|reject)`.
  *Evidencia:* `journal.controller.ts`; `journal-approval.service.ts:105-108`.
- **I-IM-2 ✅ — Corrección por reversión.** `reverseEntry` crea un asiento inverso (`source = REVERSAL`, débitos↔créditos) y marca el original `isReversed = true`.
  *Evidencia:* `journal.service.ts:265-329`.
- **I-IM-3 🔴 — Solo se revierte lo CONFIRMED.** `reverseEntry` **no valida** `status = CONFIRMED`: hoy permitiría revertir un `PENDING`/`REJECTED`, creando un asiento CONFIRMED que altera saldos y viola la semántica de estados.
  **Acción F0:** guardia `if (original.status !== CONFIRMED) throw BadRequest('Solo se revierten asientos confirmados')` en `journal.service.ts` (~L276).

### D. Semántica de estados

- **I-ST-1 ✅ — Solo CONFIRMED afecta.** `PENDING` (pre-generado en modo HYBRID) y `REJECTED` se excluyen de saldos y reportes; `isReversed = false` requerido.
  *Evidencia:* `ledger.service.ts:30-34`, `reports.service.ts:54`.
- **I-ST-2 ✅ — La transición no altera montos.** `confirm`/`reject` cambian estado, nunca líneas ni importes.

### E. Períodos contables

- **I-PE-1 ✅ — No se postea en período cerrado.** `validatePeriodOpen()` bloquea `CLOSED`/`LOCKED` antes de toda escritura contable.
  *Evidencia:* `periods.service.ts:469-481`; invocado en `journal.service.ts:90`, `invoices.service.ts:218`.
- **I-PE-2 🟡 — Cierre atómico y trazable.** El cierre genera sus asientos (`source = PERIOD_CLOSING`) dentro de `$transaction` ✅, pero **sin** `sourceType`/`sourceId` (trazabilidad débil, ver I-TR-1).
  *Evidencia:* `periods.service.ts:325-330`, `:414-446`.
- **I-PE-3 ✅ — LOCKED inmutable** salvo desbloqueo administrativo explícito.

### F. Numeración y secuencias

- **I-NUM-1 ✅ — Consecutivos race-free.** `INSERT … ON CONFLICT DO UPDATE SET last_number = last_number + 1`, dentro de la transacción, para asientos y facturas.
  *Evidencia:* `journal.service.ts:185-202`; `invoices.service.ts:132-147`; `periods.service.ts:414-421`.
- **I-NUM-2 ✅ — Unicidad.** `unique(companyId, entryNumber)`, `unique(companyId, consecutiveNumber)`; consecutivo de factura en formato Hacienda (20 dígitos).

### G. Trazabilidad

- **I-TR-1 🟡 — Todo asiento apunta a su origen.** `source` + `sourceType` + `sourceId` enlazan el asiento con el evento/documento. Cubierto para **venta/compra/cobro/pago**; **falta** en **nómina**, **cierre de período** y **depreciación**.
  *Evidencia OK:* `business-events.service.ts:127-259` (sale/purchase/collection/payment).
  *Gap:* `payroll.service.ts:234-246` (sourceType/sourceId null), `periods.service.ts:425-446` (null), depreciación no genera asiento (I-AT-4).
  **Acción F0:** poblar `sourceType`/`sourceId` en todos los generadores.
- **I-TR-2 ✅ — Idempotencia por fuente.** `unique(sourceType, sourceId)` evita duplicar el asiento de un mismo evento; cobros/pagos parciales usan `sourceId = ${docId}:${timestamp}`.

### H. Atomicidad y escritor único

- **I-AT-1 🟡 — Un evento, una transacción.** Ventas, compras, cobros, pagos, nómina y cierre están envueltos en `$transaction`. **Excepción:** `renta.createRetencion` crea la `Retencion` y su asiento **fuera** de transacción ("best-effort") → riesgo de asiento huérfano.
  *Evidencia:* `invoices.service.ts:394` ✅, `payroll.service.ts:159` ✅, `periods.service.ts:109` ✅; `renta.service.ts:312-396` 🔴.
  **Acción F0:** envolver renta/retención en `$transaction`.
- **I-AT-2 🔴 — Escritor único.** `BusinessEventsService.dispatch` debe ser el **único** que postea asientos automáticos. Hoy postean directo, saltándose el orquestador y el `RulesEngine`/`AccountingMode`:
  1. `payroll.service.ts:234-244`
  2. `renta.service.ts:358-392`
  3. `periods.service.ts:425-446` (cierre)
  (`journal.service.ts:205-229` = entrada **MANUAL** del usuario, excepción legítima.)
  **Acción F0:** enrutar por `BusinessEventsService` con eventos `PAYROLL_RUN`, `TAX_WITHHOLDING`, `PERIOD_CLOSED`, `DEPRECIATION_RUN` → `JournalService.createAutoEntry`.
- **I-AT-3 ✅ — Transacción heredada.** `createAutoEntry(tx, …)` recibe y respeta la `tx` del llamador, garantizando atomicidad con el documento fuente.
  *Evidencia:* `journal.service.ts:335-482`.
- **I-AT-4 🔴 — Depreciación sin asiento.** `fixed-assets.depreciate()` persiste `DepreciationRecord` pero **no genera asiento**; no hay evento `DEPRECIATION_RUN`.
  *Evidencia:* `fixed-assets.service.ts:49-92`.
  **Acción F0/F4:** emitir el asiento (Gasto por depreciación / Depreciación acumulada) vía orquestador.

### I. Derivación y point-in-time

- **I-DV-1 ✅ — Estados derivados en vivo.** Mayor, balance de comprobación, ER, ESF se computan desde `JournalLine` en cada request; sin materializar estados.
  *Evidencia:* `reports.service.ts:28-89`; `schema.prisma` (sin modelos de estados).
- **I-DV-2 🟡 — Point-in-time.** Los reportes aceptan `startDate`/`endDate`/`periodId`; el ESF acumula desde el inicio + `currentNetIncome` a la fecha. Falta una **API `asOfDate` limpia** (hoy hay que pasar `startDate='2000-01-01'`).
  *Evidencia:* `reports.service.ts:11-25`, `:128-147`.
  **Acción F1:** parámetro `asOfDate` de primera clase en `FinancialStatementEngine` para **todos** los estados/reportes.
- **I-DV-3 ⛳ (a introducir) — Caché = optimización invalidable.** Cualquier caché de cómputos derivados debe invalidarse por evento y jamás convertirse en fuente de verdad. Hoy **no hay caché** de reportes (`reports.service.ts` sin Redis/@Cacheable) — se agregará con esta regla al escalar.

### J. Moneda

- **I-CU-1 ✅ — Base CRC, Decimal.** Montos en `Decimal`; multimoneda vía `exchangeRate` capturado al registrar el documento; el asiento se postea en CRC.

---

## 3. Projection Engine (definición)

El **Projection Engine** reconstruye cualquier proyección (CxC, CxP, inventario, `Product.stock`, KPIs, subledgers) de forma **determinista** a partir de:

1. **El Diario General** — autoritativo para todo importe financiero (saldos de control CxC/CxP/Inventario, resultados).
2. **Los documentos fuente** — `Invoice`, `PurchaseInvoice`, `Payment`, `Payroll`, etc. (detalle operativo: vencimientos, cliente, referencia).
3. **Los metadatos operativos** — `InventoryLot` (FIFO: qué lote, `receivedAt`, `qtyRemaining`), `InventoryMovement`, necesarios para reconstruir el **contexto operacional** que el Diario no captura a nivel de detalle.

Reglas del engine:

- **PJ-1 — Reconstrucción determinista.** Dado el Diario + fuentes + metadatos, la proyección resultante es única y reproducible.
- **PJ-2 — Reconciliación obligatoria.** Tras reconstruir, **cuenta de control (Diario) = Σ subledger (proyección)**. Cualquier discrepancia es un defecto: gana el Diario y se regenera la proyección.
- **PJ-3 — Integridad contable + contexto operacional.** El engine preserva ambos: los importes cuadran con el Diario y el detalle operativo (lotes, vencimientos) queda intacto.
- **PJ-4 — Comando de rebuild.** `rebuildProjections(companyId)` reconstruible bajo demanda por empresa (migración/consistencia). Empresas nuevas nacen consistentes; existentes se reconstruyen cuando se solicite.

---

## 4. Estado actual vs. contrato — progreso F0/F1

| # | Invariante | Estado | Entregado en |
|---|---|---|---|
| I-IM-3 | Revertir solo CONFIRMED | ✅ | F0.1 — guardia de status en `reverseEntry` |
| I-AT-1 | Atomicidad renta | ✅ | F0.1 — `createRetencion` + asiento en `$transaction` |
| I-SoT-3/4 | Reconciliación control↔subledger | ✅ | F0.2 — `ProjectionEngine.reconcile` + `rebuildProjections` |
| V-1/V-2/V-5 | Invariantes verificables | ✅ | F0.2 — `AccountingEngine` + guard V-5 en `createAutoEntry` + 9 tests |
| V-6 | Testigo escritor legacy | ✅ | F0.2 — `warnLegacyDirectWrite` |
| I-DV-2 | Point-in-time `asOfDate` | ✅ | F1 — `asOfDate` en reportes y libro mayor |
| SALE_CREATED | Implementación de referencia | ✅ | F1 — emisión de factura vía `dispatch()` |
| I-AT-4 | Depreciación genera su asiento | ✅ | F4.2 — vía `createAutoEntry` (D Gasto / C Dep. Acum.); + fix netting contra-activo por tipo |
| I-TR-1 | Trazabilidad de todos los generadores | ✅ | F0.1 (renta) + F4.1 (nómina/cierre) + F4.2 (depreciación) |
| I-AT-2 | Escritor único (routing por `createAutoEntry`) | ✅ | **nómina** y **depreciación** postean vía `createAutoEntry` (V-1/V-5/período/idempotencia enforced). **Cierre** queda en su ruta especializada para evitar el ciclo Periods↔Journal (Journal ya depende de Periods): igual cumple balance validado + trazabilidad (F4.1) + período abierto por construcción + idempotencia. `renta` atómica+trazable (F0.1). |
| I-DV-3 | Caché invalidable | ⛳ | Cuando se introduzca caché |

**Ya sólido de base:** I-SoT-1/2, I-DE-1/2/3, I-IM-1/2, I-ST-1/2, I-PE-1/3, I-NUM-1/2, I-TR-2, I-AT-3, I-DV-1, I-CU-1.

---

## 5. Invariantes verificables (guards + tests)

El motor se blinda con checks ejecutables (unit + runtime asserts):

- **V-1** `∀ asiento: Σdébitos = Σcréditos` (tolerancia 0.001).
- **V-2** `Activo = Pasivo + Patrimonio` a cualquier `asOfDate`.
- **V-3** `Saldo cuenta control (Diario) = Σ subledger` (CxC = Σ facturas abiertas; CxP = Σ compras abiertas; Inventario = Σ lotes × costo).
- **V-4** `Product.stock = Σ InventoryLot.qtyRemaining` por producto.
- **V-5** Ningún asiento automático sin `sourceType` + `sourceId`.
- **V-6** Ninguna escritura de asiento fuera de `BusinessEventsService` (salvo entrada MANUAL).
- **V-7** `rebuildProjections(companyId)` deja el sistema idéntico a las proyecciones vivas (idempotencia).

Estos checks corren en CI y, en `NODE_ENV != production`, como asserts post-transacción del `AccountingEngine`.

---

## 6. Eventos de negocio (catálogo)

`SALE_CREATED` · `PURCHASE_CREATED` · `PAYMENT_RECEIVED` (cobro) · `PAYMENT_MADE` (pago) · `PAYROLL_RUN` · `DEPRECIATION_RUN` · `INVENTORY_ADJUSTED` · `TAX_WITHHOLDING` · `PERIOD_CLOSED` · (F5+) `LOAN_TAKEN`.

Cada uno: **valida → documento fuente → efectos de dominio (engines) → asiento (AccountingEngine + RulesEngine) → proyecciones → commit**; y en `async`: notificaciones, PDF/XML, Hacienda, PedagogicalEngine, KPIs, auditoría.

---

*Este manifiesto es de solo-avance: los invariantes se fortalecen, no se debilitan. Cambiarlo requiere una decisión explícita de arquitectura registrada aquí.*
