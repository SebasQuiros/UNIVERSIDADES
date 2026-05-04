-- ================================================================
--  PHASE 1 — Exercise Config Engine + Multi-company foundations
--  Aditivo y backwards-compatible. Companies existentes quedan en
--  modo INDIVIDUAL con isCompanyEnabled=true (preserva comportamiento).
-- ================================================================

-- ── 1. ENUMS NUEVOS ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "CompanyMode" AS ENUM ('INDIVIDUAL', 'GROUP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 2. EXERCISE_CONFIGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "exercise_configs" (
  "id"                                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  "exercise_id"                          UUID         NOT NULL,
  "company_mode"                         "CompanyMode" NOT NULL DEFAULT 'INDIVIDUAL',
  "auto_journal"                         BOOLEAN      NOT NULL DEFAULT true,
  "auto_ledger"                          BOOLEAN      NOT NULL DEFAULT true,
  "auto_trial_balance"                   BOOLEAN      NOT NULL DEFAULT true,
  "auto_ar"                              BOOLEAN      NOT NULL DEFAULT true,
  "auto_ap"                              BOOLEAN      NOT NULL DEFAULT true,
  "auto_inventory"                       BOOLEAN      NOT NULL DEFAULT false,
  "auto_inter_company"                   BOOLEAN      NOT NULL DEFAULT false,
  "created_at"                           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exercise_configs_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "exercise_configs_exercise_id_key" UNIQUE      ("exercise_id"),
  CONSTRAINT "exercise_configs_exercise_id_fk"  FOREIGN KEY ("exercise_id")
    REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── 3. COMPANY_MEMBERSHIPS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "company_memberships" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID         NOT NULL,
  "user_id"    UUID         NOT NULL,
  "role"       "CompanyRole" NOT NULL DEFAULT 'MEMBER',
  "joined_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_memberships_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "company_memberships_company_user_key"   UNIQUE      ("company_id", "user_id"),
  CONSTRAINT "company_memberships_company_id_fk"      FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "company_memberships_user_id_fk"         FOREIGN KEY ("user_id")
    REFERENCES "users"("id")     ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "company_memberships_user_id_idx"    ON "company_memberships"("user_id");
CREATE INDEX IF NOT EXISTS "company_memberships_company_id_idx" ON "company_memberships"("company_id");

-- ── 4. COMPANIES — columnas nuevas + relax de NOT NULL ─────────
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "exercise_id"        UUID,
  ADD COLUMN IF NOT EXISTS "mode"               "CompanyMode" NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN IF NOT EXISTS "is_company_enabled" BOOLEAN       NOT NULL DEFAULT true;

-- attempt_id pasa de NOT NULL → NULL (ahora opcional para modo GROUP)
ALTER TABLE "companies" ALTER COLUMN "attempt_id" DROP NOT NULL;

-- student_id pasa de NOT NULL → NULL (ahora opcional para modo GROUP)
ALTER TABLE "companies" ALTER COLUMN "student_id" DROP NOT NULL;

-- FK exercise_id → exercises (con cascade igual que attempt_id)
DO $$ BEGIN
  ALTER TABLE "companies"
    ADD CONSTRAINT "companies_exercise_id_fk"
    FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "companies_exercise_id_idx"        ON "companies"("exercise_id");
CREATE INDEX IF NOT EXISTS "companies_mode_idx"                ON "companies"("mode");
CREATE INDEX IF NOT EXISTS "companies_is_company_enabled_idx"  ON "companies"("is_company_enabled");

-- ── 5. EXERCISES — índice en isPublished ───────────────────────
CREATE INDEX IF NOT EXISTS "exercises_is_published_idx" ON "exercises"("is_published");

-- ── 6. BACKFILL ────────────────────────────────────────────────
-- Companies existentes: copiar exercise_id desde el attempt asociado.
UPDATE "companies" c
   SET "exercise_id" = a."exercise_id"
  FROM "exercise_attempts" a
 WHERE c."attempt_id" = a."id"
   AND c."exercise_id" IS NULL;

-- Cada Exercise existente recibe ExerciseConfig con defaults.
INSERT INTO "exercise_configs" ("id", "exercise_id", "created_at", "updated_at")
SELECT gen_random_uuid(), e."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "exercises" e
 WHERE NOT EXISTS (
   SELECT 1 FROM "exercise_configs" ec WHERE ec."exercise_id" = e."id"
 );

-- ── 7. SANITY CHECKS (no cambian nada, solo validan) ──────────
-- Ningún Company INDIVIDUAL puede tener attempt_id NULL
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM "companies"
   WHERE "mode" = 'INDIVIDUAL' AND ("attempt_id" IS NULL OR "student_id" IS NULL);
  IF bad_count > 0 THEN
    RAISE WARNING 'Backfill: % companies INDIVIDUAL sin attempt_id/student_id (revisar)', bad_count;
  END IF;
END $$;
