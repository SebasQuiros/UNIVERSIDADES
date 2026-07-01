-- Phase 7: Competencias (evidencia para acreditación SINAES).
-- Catálogo de competencias + vínculo con ejercicios y (opcional) rúbricas.
-- Todo es aditivo/opcional: el contenido existente sigue funcionando.

-- Enum CompetencyArea
DO $$ BEGIN
  CREATE TYPE "CompetencyArea" AS ENUM ('CONTABLE','TRIBUTARIO','FINANCIERO','COSTOS','AUDITORIA','DATOS','GESTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla: competencies
CREATE TABLE IF NOT EXISTS "competencies" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "university_id" UUID,
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "area"          "CompetencyArea" NOT NULL DEFAULT 'CONTABLE',
  "level"         INTEGER,
  "order"         INTEGER NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "competencies_university_id_code_key" ON "competencies"("university_id","code");
CREATE INDEX IF NOT EXISTS "competencies_university_id_idx" ON "competencies"("university_id");
CREATE INDEX IF NOT EXISTS "competencies_area_idx" ON "competencies"("area");

DO $$ BEGIN
  ALTER TABLE "competencies"
    ADD CONSTRAINT "competencies_university_id_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla puente: exercise_competencies
CREATE TABLE IF NOT EXISTS "exercise_competencies" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "exercise_id"   UUID NOT NULL,
  "competency_id" UUID NOT NULL,
  "weight"        DECIMAL(5,2) NOT NULL DEFAULT 1,
  CONSTRAINT "exercise_competencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exercise_competencies_exercise_id_competency_id_key" ON "exercise_competencies"("exercise_id","competency_id");
CREATE INDEX IF NOT EXISTS "exercise_competencies_exercise_id_idx" ON "exercise_competencies"("exercise_id");
CREATE INDEX IF NOT EXISTS "exercise_competencies_competency_id_idx" ON "exercise_competencies"("competency_id");

DO $$ BEGIN
  ALTER TABLE "exercise_competencies"
    ADD CONSTRAINT "exercise_competencies_exercise_id_fkey"
    FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "exercise_competencies"
    ADD CONSTRAINT "exercise_competencies_competency_id_fkey"
    FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Columna opcional en exercise_rubrics: ancla de competencia (grano fino)
ALTER TABLE "exercise_rubrics"
  ADD COLUMN IF NOT EXISTS "competency_id" UUID;

CREATE INDEX IF NOT EXISTS "exercise_rubrics_competency_id_idx" ON "exercise_rubrics"("competency_id");

DO $$ BEGIN
  ALTER TABLE "exercise_rubrics"
    ADD CONSTRAINT "exercise_rubrics_competency_id_fkey"
    FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Catálogo base de competencias (plantilla global, university_id = NULL) ──
-- Idempotente: inserta cada competencia solo si su code global aún no existe.
INSERT INTO "competencies" ("id","university_id","code","name","description","area","level","order","is_active","updated_at")
SELECT gen_random_uuid(), NULL, v.code, v.name, v.description, v.area::"CompetencyArea", v.level, v.ord, TRUE, CURRENT_TIMESTAMP
FROM (VALUES
  ('C1',  'Registro contable',                'Registrar transacciones bajo el principio de partida doble (diario y mayor).',              'CONTABLE',   1, 1),
  ('C2',  'Ciclo contable y cierre',          'Ejecutar ajustes, hoja de trabajo y cierre del período contable.',                          'CONTABLE',   1, 2),
  ('C3',  'Estados financieros',              'Preparar e interpretar estados financieros bajo NIIF / NIIF para PYMES.',                   'CONTABLE',   2, 3),
  ('C4',  'Costos e inventarios',             'Valorar inventarios (FIFO) y determinar el costo de ventas.',                               'COSTOS',     1, 4),
  ('C5',  'Obligaciones tributarias CR',      'Determinar y declarar IVA y renta (D-104, D-101, D-103, D-115) según normativa de Hacienda.','TRIBUTARIO', 1, 5),
  ('C6',  'Facturación electrónica',          'Emitir comprobantes electrónicos conforme a Hacienda v4.3.',                                'TRIBUTARIO', 1, 6),
  ('C7',  'Análisis financiero',              'Calcular e interpretar razones de liquidez, rentabilidad y endeudamiento.',                 'FINANCIERO', 2, 7),
  ('C8',  'Presupuesto y proyección',         'Elaborar presupuestos y proyecciones y analizar variaciones vs. real.',                     'FINANCIERO', 2, 8),
  ('C9',  'Análisis de datos para decisiones','Usar indicadores y tableros para apoyar la toma de decisiones.',                            'DATOS',      2, 9),
  ('C10', 'Control interno y auditoría',      'Aplicar procedimientos de control y evidencia de auditoría sobre los libros.',              'AUDITORIA',  3, 10)
) AS v(code, name, description, area, level, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM "competencies" c WHERE c."university_id" IS NULL AND c."code" = v.code
);
