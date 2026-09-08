-- Planilla integral de Costa Rica.
--
-- La planilla anterior solo guardaba salario, CCSS, renta y aguinaldo. Una
-- planilla costarricense real lleva bastante mas: comisiones, las tres cuotas
-- obreras, los creditos familiares del impuesto sobre la renta, pension
-- alimenticia, ahorro y prestamo de asociacion solidarista, pagos no
-- salariales, la provision de vacaciones y la poliza de riesgos del trabajo.
--
-- Todas las columnas son nuevas y con valor por defecto, asi que las planillas
-- ya procesadas siguen leyendose sin tocarlas.

-- ── Empleado: situacion familiar y deducciones fijas ────────────────────────
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "tiene_conyuge"           BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cantidad_hijos"          INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pension_alimenticia"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tasa_ahorro_asociacion"  DECIMAL(6,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prestamo_asociacion"     DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Un numero de hijos negativo no significa nada y romperia el credito fiscal.
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_hijos_no_negativos";
ALTER TABLE "employees"
  ADD CONSTRAINT "employees_hijos_no_negativos" CHECK ("cantidad_hijos" >= 0);

-- ── Linea de planilla ──────────────────────────────────────────────────────
ALTER TABLE "payroll_lines"
  ADD COLUMN IF NOT EXISTS "comisiones"              DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pension_alimenticia"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ahorro_asociacion"       DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prestamo_asociacion"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "viaticos"                DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "regalos"                 DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_efectivo_a_pagar"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "provision_vacaciones"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "poliza_ins"              DECIMAL(15,2) NOT NULL DEFAULT 0;

-- ── Encabezado de la planilla ──────────────────────────────────────────────
ALTER TABLE "payrolls"
  ADD COLUMN IF NOT EXISTS "total_vacaciones"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_ins"            DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_no_salarial"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_efectivo"       DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_costo_patrono"  DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Para las planillas ya existentes: el efectivo era el neto, porque antes no
-- habia pagos no salariales que sumarle.
UPDATE "payrolls" SET "total_efectivo" = "total_net" WHERE "total_efectivo" = 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- Cuentas nuevas para TODAS las empresas que ya existen.
--
-- El asiento de planilla resuelve las cuentas por codigo y revienta si alguna
-- falta. Sin este bloque, cualquier empresa creada antes de hoy no podria
-- procesar planilla: el catalogo solo se siembra al crear la empresa.
-- ═══════════════════════════════════════════════════════════════════════════

-- Encabezados nuevos (nivel 3) que hacen falta como padres.
INSERT INTO "accounts" ("id","company_id","code","name","type","normal_balance","parent_id","level","is_header","is_active","created_at")
SELECT gen_random_uuid(), c."id", n."code", n."name", 'EXPENSE'::"AccountType", 'DEBIT'::"NormalBalance",
       (SELECT p."id" FROM "accounts" p WHERE p."company_id" = c."id" AND p."code" = '6.1'),
       3, true, true, NOW()
FROM "companies" c
CROSS JOIN (VALUES
  ('6.1.05', 'Riesgos del Trabajo y Otros'),
  ('6.1.06', 'Pagos No Salariales')
) AS n("code","name")
WHERE EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = '6.1')
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = n."code");

-- Pasivos laborales (nivel 4, cuelgan de 2.1.04).
INSERT INTO "accounts" ("id","company_id","code","name","type","normal_balance","parent_id","level","is_header","is_active","created_at")
SELECT gen_random_uuid(), c."id", n."code", n."name", 'LIABILITY'::"AccountType", 'CREDIT'::"NormalBalance",
       (SELECT p."id" FROM "accounts" p WHERE p."company_id" = c."id" AND p."code" = '2.1.04'),
       4, false, true, NOW()
FROM "companies" c
CROSS JOIN (VALUES
  ('2.1.04.05', 'CCSS Cuotas Obreras por Pagar'),
  ('2.1.04.06', 'Vacaciones por Pagar'),
  ('2.1.04.07', 'Pension Alimenticia por Pagar'),
  ('2.1.04.08', 'Ahorro Asociacion por Pagar'),
  ('2.1.04.09', 'Prestamos Asociacion por Pagar'),
  ('2.1.04.10', 'Poliza INS por Pagar')
) AS n("code","name")
WHERE EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = '2.1.04')
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = n."code");

-- Gastos de personal (nivel 4).
INSERT INTO "accounts" ("id","company_id","code","name","type","normal_balance","parent_id","level","is_header","is_active","created_at")
SELECT gen_random_uuid(), c."id", n."code", n."name", 'EXPENSE'::"AccountType", 'DEBIT'::"NormalBalance",
       (SELECT p."id" FROM "accounts" p WHERE p."company_id" = c."id" AND p."code" = n."parent"),
       4, false, true, NOW()
FROM "companies" c
CROSS JOIN (VALUES
  ('6.1.05.01', 'Poliza de Riesgos del Trabajo (INS)', '6.1.05'),
  ('6.1.06.01', 'Viaticos (No Salarial)',              '6.1.06'),
  ('6.1.06.02', 'Regalos y Atenciones (No Salarial)',  '6.1.06')
) AS n("code","name","parent")
WHERE EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = n."parent")
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = n."code");

-- La provision de vacaciones (6.1.04.01) ya existia en el catalogo, pero se
-- verifica por si alguna empresa quedo sin ella.
INSERT INTO "accounts" ("id","company_id","code","name","type","normal_balance","parent_id","level","is_header","is_active","created_at")
SELECT gen_random_uuid(), c."id", '6.1.04.01', 'Vacaciones - Provision', 'EXPENSE'::"AccountType", 'DEBIT'::"NormalBalance",
       (SELECT p."id" FROM "accounts" p WHERE p."company_id" = c."id" AND p."code" = '6.1.04'),
       4, false, true, NOW()
FROM "companies" c
WHERE EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = '6.1.04')
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = '6.1.04.01');
