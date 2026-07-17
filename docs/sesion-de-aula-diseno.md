# Sesión de Aula — Documento de diseño (Fase 1)

> Dinámica de aula en vivo, tipo Kahoot, organizada por el profesor: los estudiantes se unen
> con un código, el profesor arma grupos y le asigna a cada uno un arquetipo de negocio
> (ferretería, agencia de publicidad, bufete contable, distribuidor). Las empresas **comercian
> entre sí**, tributan al cierre y luego **se auditan mutuamente** buscando discrepancias en los
> estados financieros. El sistema —que generó las dos puntas de cada transacción B2B— calcula las
> diferencias reales y con eso califica contabilidad + auditoría. Gana el mejor puntaje combinado.
> La dinámica vive hasta que el profesor la finaliza.
>
> **Estado:** diseño (Fase 1). No hay código de backend ni migraciones aplicadas. La maqueta de
> frontend existe con datos falsos para validar el flujo antes de construir.

---

## 1. Hallazgo central: ~70% ya está construido

La revisión del sistema (backend, schema, frontend) arrojó que el comercio entre empresas —el
corazón de la idea— **ya existe y funciona**. No hay que inventarlo, hay que **orquestarlo**.

| Pieza de la dinámica | Estado hoy | Dónde vive |
|---|---|---|
| Grupos de N estudiantes = 1 empresa | **Existe** | `Company.mode = GROUP` + `CompanyMembership`; el profe los crea desde `GroupsPanel.tsx` |
| Comercio B2B (venta de A → compra espejo en B, con factura, FIFO, asiento y CxP) | **Existe** | `inter-company.service.ts` |
| Tres modos de comercio (CONTABLE / EMPRESARIAL / ERP) | **Existe** | `ExerciseConfig.commercialMode` |
| Buzón de propuestas (B acepta/rechaza) | **Existe** | `purchase-proposals.controller.ts` |
| Panel del profesor en vivo (polling 5s) | **Existe** | `profesor/ejercicios/[id]/live/` |
| Cierre de período, D-101/103/104/115, estados financieros | **Existe** | `periods`, `tax-declarations`, `reports` |
| Código de unión de 6 caracteres | **Existe el patrón** | `PracticeGroup.code` |
| **Lobby tipo Kahoot** (código proyectado, alumnos entrando en vivo) | **NO existe** | — |
| **Capa de auditoría entre estudiantes** (snapshot + hallazgos + oráculo) | **NO existe** | — |

El comercio B2B está **apagado por defecto** (`autoTransactionsBetweenCompanies = false`), lo que
probablemente explica por qué el equipo no sabía que ya estaba.

**Lo genuinamente nuevo son dos cosas:** el *lobby* de unión y **toda la capa de auditoría**, que
hoy no existe y que el `CompanyOwnerGuard` bloquea deliberadamente (una empresa no puede ver los
libros de otra).

---

## 2. El diferenciador real: cruce de comprobantes, no "un juego"

La plataforma **genera las dos puntas de cada transacción B2B**: cuando la ferretería le factura al
bufete, el sistema crea la venta en la ferretería y espeja la compra en el bufete. Es decir, **el
sistema conoce la verdad de campo**. Si la ferretería omite ese ingreso en su D-104, es demostrable
cruzando contra la compra registrada del bufete.

Esto no es una mecánica inventada: es análogo al **cruce de información** que hace Hacienda. La
revisión fiscal precisó el encuadre correcto (importante para que el ejercicio enseñe algo real):

- **No es exactamente la D-151.** La D-151 es una declaración informativa *autodeclarada, anual y
  agregada* — le da a Hacienda dos declaraciones que podrían ser ambas falsas. Nuestro espejo no da
  declaraciones: da **el hecho**. Además la D-151 está en vía de extinción, precisamente porque la
  **factura electrónica** ya le da a Hacienda cada comprobante en tiempo real.
- **El instrumento correcto es el cruce de comprobantes electrónicos**: ventas declaradas en D-104
  vs. XML aceptados. Y la mejor analogía pedagógica de la fase de auditoría no es la D-151, sino la
  **circularización de saldos (NIA 505)** — vigente, universal, y que la plataforma puede ejecutar
  sola. Recomendación fiscal: **no** llamar a esto "D-151" en la UI; llamarlo *cruce de
  comprobantes*.

**Regla de doctrina que atraviesa toda la UI:** el sistema detecta **diferencias**, nunca "fraude"
ni "trampa". Una diferencia puede ser fraude, error, criterio contable distinto o incluso un bug de
la plataforma — indistinguibles para el software (NIA 240). El juicio lo pone el profesor. La UI
usa "discrepancia", "diferencia sin explicar", "requiere revisión del docente".

---

## 3. Decisiones de producto (confirmadas por el usuario)

1. **Visibilidad en auditoría = paquete de EEFF congelado.** Al cerrar el período se publica un
   snapshot inmutable y firmado (hash SHA-256) por empresa. El auditor lee *eso*, nunca los libros
   vivos. **El `CompanyOwnerGuard` no se toca ni se amplía.** Es realista (un auditor recibe los
   estados, no las llaves del sistema) y es evidencia a prueba de manipulación posterior.
2. **Ganador = mixto:** calidad contable/tributaria propia + calidad de la auditoría que hiciste a
   otra empresa (aciertos contra el oráculo, penalizando falsos positivos).
3. **Oráculo automático:** el sistema calcula las discrepancias reales y contra eso califica los
   hallazgos del estudiante.

---

## 4. Arquitectura propuesta

Un módulo nuevo `class-sessions` que **orquesta sobre `Exercise`**, no lo reemplaza. La sesión es
una máquina de estados colgada 1:1 del ejercicio (`exerciseId @unique`). Así hereda gratis rúbricas,
competencias, calificación, el panel en vivo y el motor contable entero.

### Máquina de estados

```
DRAFT → LOBBY → EN_CURSO → TRIBUTACIÓN → AUDITORÍA → CALIFICACIÓN → FINALIZADA
                                                                    (irreversible)
   cualquier estado no terminal → CANCELADA
```

- **LOBBY** — código proyectado; los alumnos se unen. Aún sin empresa.
- **GRUPOS** (dentro de LOBBY) — el profe arma los `Company(mode=GROUP)` y les asigna arquetipo.
- **EN_CURSO** — comercio B2B con el motor `inter-company` existente. Se bloquea `ExerciseConfig`.
- **TRIBUTACIÓN** — cada equipo cierra su período y presenta declaraciones.
- **AUDITORÍA** — `publish-snapshot` (irreversible) congela los EEFF, calcula el oráculo y asigna
  quién audita a quién. Los estudiantes reportan hallazgos.
- **CALIFICACIÓN** — el oráculo contrasta hallazgos vs. discrepancias reales; se calcula el score.
- **FINALIZADA** — todo a solo lectura.

### Tiempo real: polling, no WebSockets

No hay WebSockets en ninguno de los 41 módulos. El único precedente de "vivo" es polling +
heartbeat (`live` + `ping`). El paralelismo con Kahoot es superficial (código + lobby); no hay
carrera de milisegundos. **Se sigue el precedente (polling)**, con dos resguardos: intervalos
diferenciados por fase (3-5s en lobby, 8-10s luego) y cache Redis de ~2s en el endpoint `live`,
porque el `ThrottlerGuard` es **por IP** y un aula con NAT compartido puede rozar el techo.

### Aislamiento — el punto más delicado

Toda la capa de auditoría cruza la frontera entre empresas, así que se diseña con cuidado extremo:

- Un **guard nuevo y propio** (`AuditAssignmentGuard`), que **no extiende ni llama** al
  `CompanyOwnerGuard`. Resuelve la empresa auditada *exclusivamente* desde la asignación de
  auditoría — **nunca** desde un `companyId` del cliente (por eso la ruta del snapshot no lleva
  `:companyId`).
- El servicio que sirve el snapshot **no tiene inyectado** acceso a `Invoice`/`JournalEntry`/
  `Client`: estructuralmente no puede filtrar libros vivos aunque hubiera un bug.
- Ningún modelo de auditoría tiene una FK hacia los libros de la empresa auditada; las referencias
  "hacia adentro" del snapshot son texto, no relaciones Prisma.

### Modelo de datos (resumen)

10 tablas nuevas, todas aditivas (cero impacto en datos existentes): `ClassSession` +
`ClassSessionParticipant` (máquina de estados y roster del lobby), `BusinessArchetype` +
`SupplyLink` + `ArchetypeProduct` (catálogo de negocios y cadena de suministro), `FinancialSnapshot`
(EEFF congelados con hash), `AuditAssignment` + `AuditFinding` (quién audita a quién y qué reporta),
`OracleDiscrepancy` (las diferencias reales calculadas), `ClassSessionResult` (leaderboard). Dinero
siempre `Decimal(15,2)`. Detalle completo en los documentos de los agentes (db-prisma, backend).

Un arreglo de datos incluido: hoy `Company.legalId` **no es único**, y el match B2B por cédula
elige una empresa arbitrariamente si hay duplicados. Se propone `@@unique([exerciseId, legalId])`
(no rompe nada porque `exerciseId` es NULL en las empresas individuales existentes) en una migración
separada con su backfill.

---

## 5. 🔴 Bloqueos verificados que Fase 2 debe resolver primero

La revisión fiscal encontró dos defectos **preexistentes** que socavan la premisa. Ambos
verificados directamente en el código:

1. **El espejo B2B traga los errores en silencio.** `invoices.service.ts:530` corre la réplica
   fuera de la transacción principal, con un `catch` que solo hace `logger.warn`. Si falla, la
   empresa A tiene la venta y la B **no tiene la compra**, sin aviso. El oráculo entonces dictaminaría
   *"B omitió una compra"* y **B no hizo nada malo**. Peor: si el estudiante corrige a mano, genera
   un documento sin el enlace de origen y se autoincrimina con la regla de mayor severidad. **Hay
   que hacer el espejo confiable (o al menos observable) antes de construir el oráculo encima.**

2. **El D-101 (renta) no se puede calcular en modo GROUP.** `renta.service.ts:70` lanza
   `ForbiddenException` para `Company.mode === 'GROUP'` — que es justamente el modo en que operan
   los grupos. Además `Retencion.attemptId` y `PartialPayment.attemptId` son no-nulos y las empresas
   GROUP tienen `attemptId = NULL`. **La renta grupal es trabajo de backend nuevo, no un ajuste.**

Otros hallazgos fiscales a resolver antes de que el oráculo sea confiable: el umbral PYME
contradictorio (afecta el cálculo de renta y podría reportar una inconsistencia de la plataforma
como "fraude" del estudiante); comparar **bases** y no **impuestos** al cruzar (los impuestos
redondeados por línea producen falsos positivos garantizados); y varios `round()` que operan sobre
`number` en vez de `Decimal`. Detalle en el documento del agente fiscal.

Además, el motor de calificación por rúbricas es hoy **100% por-estudiante** (`ExerciseAttempt`), y
las empresas GROUP no tienen attempt — hay que extraer un evaluador reusable por empresa.

---

## 6. Puntos ciegos del oráculo (para que la UI sea honesta)

El cruce verifica **consistencia**, jamás **sustancia**. Casos donde el oráculo es ciego y el
profesor debe juzgar a mano (la UI debe decirlo, no fingir certeza):

- **Colusión bilateral:** si A y B se ponen de acuerdo, el espejo cuadra y el cruce pasa. Es el
  límite del método — y, apropiadamente, *esa* es la lección.
- **Proveedores externos** (fuera del universo de empresas): sin espejo no hay nada que cruzar. Por
  eso conviene un **universo cerrado** de proveedores para el ejercicio.
- **Intención:** el oráculo ve una diferencia; si es fraude, error o criterio, no lo puede decir.
- **Ventas sin factura** (la evasión #1 real): estructuralmente insimulable salvo sembrando
  depósitos bancarios sin comprobante — que además es exactamente la técnica real de Hacienda.

Diseño anti-exploit de la calificación: **presupuesto de auditoría** (fichas finitas para pedir
evidencia y para reportar). Sin presupuesto, el alumno reporta todo y gana por fuerza bruta; con
presupuesto, tiene que **priorizar por riesgo** — que es justo lo que se quiere enseñar. Todo
hallazgo exige evidencia citada, y las omisiones solo penalizan si son materiales (NIA 320/450).

---

## 7. Decisiones abiertas para el profesor / equipo

- **Encuadre fiscal del cruce:** confirmar que se nombra "cruce de comprobantes" y no "D-151", y la
  versión de factura electrónica vigente (el repo asume v4.3; conviene verificar si aplica v4.4).
- **Umbral PYME:** cuál decreto es el vigente (deuda preexistente, ya señalada).
- **Algoritmo de asignación de auditorías:** aleatorio / round-robin / manual, y si se prohíben
  auditorías recíprocas (A audita a B y B a A = incentivo a la colusión en la calificación).
- **Pesos del score mixto** (contabilidad vs. auditoría) — parametrizable por sesión.

---

## 8. Documentos fuente (Fase 1)

Los tres análisis de detalle producidos por los agentes viven en el scratchpad de la sesión:
`diseno-datos.md` (db-prisma), `diseno-oraculo.md` (fiscal-contable), `diseno-api.md` (backend).
Este documento los consolida para revisión del equipo.
