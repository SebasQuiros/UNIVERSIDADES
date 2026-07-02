# ContaSJ — Replanteamiento estratégico (alineado a UTN)

> **Visión.** ContaSJ NO compite con SAP/Alegra en el mercado empresarial. Su objetivo
> es ser **el mejor simulador contable y fiscal universitario de Costa Rica**, para
> carreras de Contabilidad, Finanzas y Administración. El núcleo sigue siendo un ERP
> completo, pero **toda decisión de producto responde primero a la experiencia
> educativa**. El producto es **multi-universidad**: nada de cara al usuario debe
> indicar que es "para" una institución específica. Comprador principal:
> **Coordinador / Decano de carrera**.
>
> **Nota sobre la UTN.** Los planes de estudio de la UTN (COFI B10-2025, CP L02-2024,
> acreditados SINAES) se usan **solo como una de varias referencias** para diseñar un
> currículo contable estándar y sólido. NO son el alcance del producto ni deben
> aparecer como marca en la interfaz.
>
> **Filtro de prioridad.** Una feature es prioritaria solo si: ¿mejora el aprendizaje?
> ¿facilita el trabajo del profesor? ¿genera evidencia para SINAES? ¿hace la simulación
> más realista? Si no, no es prioritaria. No agregar features por ser técnicamente
> interesantes; primero consolidar la experiencia educativa sobre lo que ya existe.
>
> **Estado.** ✅ Prioridad 1 (Modelo de Competencias) — implementada: modelo `Competency`
> + `ExerciseCompetency` + ancla opcional en rúbricas + catálogo base de 10 competencias
> (migración `phase7_competencies`) + módulo API `competencies`.

## 1. La promesa (frase de venta al decano)

> *"Tus estudiantes operan una empresa costarricense real —facturan en Hacienda v4.3,
> declaran en TRIBU-CR, cierran libros bajo NIIF PYMES— y la plataforma califica sola
> y te entrega la evidencia de competencias por curso y por cohorte para SINAES.
> Menos horas calificando, mejores egresados, datos para la acreditación."*

Tres pilares:
- **A. Realismo Costa Rica** — Hacienda v4.3, TRIBU-CR (D-101/103/104/115), IVA 13%, NIIF PYMES.
- **B. Aprender haciendo, evaluado solo** — escenario → operar → declarar → cerrar → calificación automática con rúbricas.
- **C. Evidencia de competencias** — dashboard institucional + reporte de acreditación por competencia/cohorte.

## 2. Mapeo carrera UTN → plataforma

Nivel de cobertura: 🟢 el simulador **ES** el curso · 🟡 apoyo práctico fuerte · 🔵 casos/apoyo parcial.

### Diplomado (Niveles 1–6, plan B10)
| Curso | Cob. | Cómo lo cubre la plataforma |
|-------|:----:|------------------------------|
| COFI-121 Herramientas análisis y presentación info contable | 🟡 | Reportes, exportación Excel, dashboards |
| COFI-122 **Contabilidad I** | 🟢 | Registro, doble partida, diario, mayor |
| COFI-221 **Contabilidad II** | 🟢 | Ciclo contable, ajustes, hoja de trabajo |
| COFI-321 **Contabilidad III** | 🟢 | Activos, pasivos, cuentas por cobrar/pagar |
| COFI-322 Finanzas I | 🟡 | Ratios, análisis de EEFF, gerente financiero IA |
| COFI-323 Derecho Comercial y Tributario | 🔵 | Contexto tributario, obligaciones |
| COFI-421 **Contabilidad IV** | 🟢 | Activos fijos, depreciación, nómina |
| COFI-422 Finanzas II | 🟡 | Análisis financiero avanzado |
| COFI-423 **Contabilidad de Costos I** | 🟢 | Inventario FIFO, COGS, movimientos |
| COFI-521 **Contabilidad V** | 🟢 | Cierre, estados financieros completos |
| COFI-522 Finanzas III | 🟡 | Proyección, valoración |
| COFI-523 **Contabilidad de Costos II** | 🟢 | Costeo, órdenes, procesos |
| COFI-524 Presupuesto | 🟡 | Presupuesto vs real, variaciones |
| COFI-525 **Trámites y Procedimientos Tributarios** | 🟢 | TRIBU-CR: D-104/101/103/115, IVA, facturación electrónica |
| COFI-621 Elementos de Auditoría I | 🔵 | Rastro de auditoría, pruebas sobre libros |
| COFI-622 Finanzas IV | 🟡 | Finanzas de largo plazo |

### Bachillerato (Niveles 7–10, plan B10)
| Curso | Cob. | Cómo lo cubre |
|-------|:----:|----------------|
| COFI-721 Elementos de Auditoría II | 🔵 | Papeles de trabajo, evidencia |
| COFI-722 **Análisis Fiscal y Tributario** | 🟢 | Casos fiscales, declaraciones, conciliación fiscal |
| COFI-723 Análisis de Datos para toma de decisiones | 🟡 | Dashboards, KPIs, indicadores macro |
| COFI-824 **Normativa Contable PYMES** | 🟢 | NIIF para PYMES aplicada a la empresa simulada |
| COFI-921 Finanzas Avanzadas | 🟡 | Instrumentos, valoración |
| COFI-922 Gestión de Riesgos | 🔵 | Eventos económicos, escenarios de riesgo |
| COFI-923 Finanzas Corporativas | 🟡 | Estructura de capital, decisiones |
| COFI-1022 Formulación y Evaluación de Proyectos | 🟡 | Flujos, VAN/TIR sobre datos de la empresa |

### Licenciatura (Niveles 11–13, plan L02 — Contaduría Pública)
| Curso | Cob. | Cómo lo cubre |
|-------|:----:|----------------|
| CP-1122 Normativa Contable | 🟡 | NIIF plenas, casos |
| CP-1123 **Auditoría Tributaria** | 🟢 | Revisión de declaraciones, hallazgos, ajustes |
| CP-1221 Análisis de Riesgos e Instrumentos Financieros | 🟡 | Riesgo, instrumentos |
| CP-1223 Tópicos Avanzados de Contabilidad | 🟡 | Casos complejos |
| CP-1322 Auditoría de Gestión | 🔵 | Indicadores, control |
| CP-1323 Auditoría Forense | 🔵 | Detección de irregularidades en libros |
| CPEL-22 NIC SP | 🔵 | Sector público (extensión futura) |

**Resumen de cobertura:** ~12 cursos 🟢 núcleo + ~11 🟡 apoyo fuerte + ~7 🔵 casos ≈
**30 cursos de la carrera** apoyados por una sola plataforma.

## 3. Marco de competencias (la capa que firma el cheque)

Competencias que la plataforma **puede evidenciar con datos reales** (rúbricas + tracking existentes):

1. **Registro contable** (doble partida, diario, mayor) — Conta I–II
2. **Ciclo contable y cierre** (ajustes, hoja de trabajo, cierre) — Conta III–V
3. **Estados financieros** bajo NIIF/PYMES — Conta IV–V, Normativa PYMES
4. **Costos e inventarios** (FIFO, COGS, costeo) — Costos I–II
5. **Obligaciones tributarias CR** (IVA/Renta, D-104/101/103/115) — Trámites, Análisis Fiscal, Auditoría Tributaria
6. **Facturación electrónica** Hacienda v4.3 — Trámites, operación
7. **Análisis financiero** (liquidez, rentabilidad, endeudamiento) — Finanzas I–IV
8. **Presupuesto y proyección** — Presupuesto, Proyectos
9. **Análisis de datos para decisiones** — Análisis de Datos
10. **Control interno / auditoría** (evidencia, hallazgos) — Auditoría I–II, Auditoría Tributaria/Forense

## 4. Roadmap (todo, secuenciado para el comprador = decano)

### Fase 1 — Fundación de competencias + contenido llave en mano
- Modelo `Competency` + puente `ExerciseRubric ↔ Competency` (reutiliza rúbricas).
- Catálogo de cursos UTN precargado (mapa del §2) como plantillas activables 1-clic.
- **Curso semilla completo: Contabilidad I (COFI-122)** — 8–12 ejercicios listos.
- Recorrido del estudiante pulido: Constituir → Operar → Declarar → Cerrar → Resultado.

### Fase 2 — Analítica institucional / evidencia SINAES
- **Portal del Coordinador**: adopción por curso, dominio por competencia por cohorte, alumnos en riesgo.
- **Reporte de acreditación** exportable (PDF/Excel) por competencia y curso.

### Fase 3 — Rediseño tipo producto
- Landing + demo mode sin login (cuenta A/B/C en 5 min).
- Sistema de diseño unificado (tokens/componentes) en los 4 portales.

### Fase 4 — Consolidar y robustecer
- Fusionar módulos que se pisan (`accounting` vs `journal/ledger`; `business` vs `companies`).
- Pruebas del núcleo contable (doble partida, cierres, declaraciones).
- Migración Neon→Railway (cold-start) para demo rápida.

## 5. Primer paso ejecutable
**Modelo de Competencias + curso semilla Contabilidad I (COFI-122).** Desbloquea a la vez
el recorrido (Fase 1) y la analítica (Fase 2): sin contenido, el dashboard del decano sale vacío.
