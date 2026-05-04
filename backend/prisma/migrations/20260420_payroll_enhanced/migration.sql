-- ================================================================
--  Migration: 20260420_payroll_enhanced
--  Enhance Employee model and replace Payroll with Payroll+PayrollLine
--  Costa Rica CCSS 2026 rates support
-- ================================================================

-- Step 1: Drop old payrolls table (recreate with new schema)
DROP TABLE IF EXISTS "payrolls" CASCADE;

-- Step 2: Alter employees table — add new columns
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "attempt_id"  UUID,
  ADD COLUMN IF NOT EXISTS "department"  TEXT,
  ADD COLUMN IF NOT EXISTS "salary_type" TEXT NOT NULL DEFAULT 'MENSUAL',
  ADD COLUMN IF NOT EXISTS "end_date"    DATE;

-- Step 3: Create new payrolls table (period-level aggregate)
CREATE TABLE "payrolls" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id"       UUID         NOT NULL,
  "attempt_id"       UUID,
  "period"           TEXT         NOT NULL,
  "period_type"      TEXT         NOT NULL DEFAULT 'MENSUAL',
  "total_gross"      DECIMAL(15,2) NOT NULL,
  "total_net"        DECIMAL(15,2) NOT NULL,
  "total_patrono"    DECIMAL(15,2) NOT NULL,
  "total_trabajador" DECIMAL(15,2) NOT NULL,
  "total_aguinaldo"  DECIMAL(15,2) NOT NULL,
  "total_renta"      DECIMAL(15,2) NOT NULL DEFAULT 0,
  "journal_entry_id" UUID,
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payrolls_company_id_period_key" UNIQUE ("company_id", "period"),
  CONSTRAINT "payrolls_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
);

CREATE INDEX "payrolls_company_id_idx" ON "payrolls"("company_id");

-- Step 4: Create payroll_lines table (per-employee breakdown)
CREATE TABLE "payroll_lines" (
  "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
  "payroll_id"         UUID          NOT NULL,
  "employee_id"        UUID          NOT NULL,

  -- Ingresos
  "salary_gross"       DECIMAL(15,2) NOT NULL,
  "overtime"           DECIMAL(15,2) NOT NULL DEFAULT 0,
  "bonus"              DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_gross"        DECIMAL(15,2) NOT NULL,

  -- Deducciones trabajador
  "ccss_worker"        DECIMAL(15,2) NOT NULL,
  "renta_deduccion"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "other_deductions"   DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_deductions"   DECIMAL(15,2) NOT NULL,
  "net_salary"         DECIMAL(15,2) NOT NULL,

  -- Cargas patronales
  "ccss_patrono"       DECIMAL(15,2) NOT NULL,
  "aguinaldo"          DECIMAL(15,2) NOT NULL,
  "total_employer_cost" DECIMAL(15,2) NOT NULL,

  -- Breakdown JSON
  "breakdown"          JSONB         NOT NULL DEFAULT '{}',

  CONSTRAINT "payroll_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payroll_lines_payroll_id_fkey"
    FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE,
  CONSTRAINT "payroll_lines_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
);

CREATE INDEX "payroll_lines_payroll_id_idx"   ON "payroll_lines"("payroll_id");
CREATE INDEX "payroll_lines_employee_id_idx"  ON "payroll_lines"("employee_id");
