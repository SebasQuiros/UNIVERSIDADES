-- FASE 2b — Sesión de Aula (escrita a mano, estilo del repo — ver phase14).
-- 5 tablas nuevas + 2 enums. Aditivo puro: no toca ninguna tabla existente.
--
--   class_sessions                   — máquina de estados 1:1 sobre exercises
--   class_session_participants       — roster del lobby (companyId NULL hasta asignación)
--   class_session_companies          — empresa GROUP + arquetipo + snapshot congelado
--   class_session_audit_assignments  — derangement auditor↔auditado
--   class_session_audit_findings     — hallazgos del estudiante auditor

-- ── Enums ──
CREATE TYPE "ClassSessionStatus" AS ENUM ('DRAFT', 'LOBBY', 'EN_CURSO', 'TRIBUTACION', 'AUDITORIA', 'CALIFICACION', 'FINALIZADA', 'CANCELADA');
CREATE TYPE "ClassSessionArchetype" AS ENUM ('FERRETERIA', 'AGENCIA_PUBLICIDAD', 'BUFETE_CONTABLE', 'DISTRIBUIDOR');

-- ── class_sessions ──
CREATE TABLE IF NOT EXISTS "class_sessions" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "exercise_id"     UUID NOT NULL,
  "teacher_id"      UUID NOT NULL,
  "code"            VARCHAR(6) NOT NULL,
  "status"          "ClassSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "min_group_size"  INTEGER NOT NULL DEFAULT 3,
  "max_group_size"  INTEGER NOT NULL DEFAULT 6,
  "settings"        JSONB NOT NULL DEFAULT '{}',
  "started_at"      TIMESTAMP(3),
  "closed_ops_at"   TIMESTAMP(3),
  "snapshot_at"     TIMESTAMP(3),
  "audit_closed_at" TIMESTAMP(3),
  "finalized_at"    TIMESTAMP(3),
  "cancelled_at"    TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_sessions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_sessions_teacher_id_fkey"  FOREIGN KEY ("teacher_id")  REFERENCES "users"("id")     ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "class_sessions_exercise_id_key" ON "class_sessions"("exercise_id");
CREATE UNIQUE INDEX IF NOT EXISTS "class_sessions_code_key"        ON "class_sessions"("code");
CREATE INDEX IF NOT EXISTS "class_sessions_teacher_id_idx"         ON "class_sessions"("teacher_id");
CREATE INDEX IF NOT EXISTS "class_sessions_status_idx"             ON "class_sessions"("status");

-- ── class_session_participants ──
-- companyId queda NULL hasta que el profesor asigna al estudiante a un grupo.
CREATE TABLE IF NOT EXISTS "class_session_participants" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_session_id" UUID NOT NULL,
  "student_id"       UUID NOT NULL,
  "company_id"       UUID,
  "joined_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_ping_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "class_session_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_session_participants_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_session_participants_student_id_fkey"       FOREIGN KEY ("student_id")       REFERENCES "users"("id")          ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_session_participants_company_id_fkey"       FOREIGN KEY ("company_id")       REFERENCES "companies"("id")      ON DELETE SET NULL ON UPDATE CASCADE
);

-- idempotencia del join: un estudiante solo puede unirse una vez a la misma sesión
CREATE UNIQUE INDEX IF NOT EXISTS "class_session_participants_class_session_id_student_id_key" ON "class_session_participants"("class_session_id", "student_id");
CREATE INDEX IF NOT EXISTS "class_session_participants_class_session_id_idx" ON "class_session_participants"("class_session_id");
CREATE INDEX IF NOT EXISTS "class_session_participants_company_id_idx"      ON "class_session_participants"("company_id");

-- ── class_session_companies ──
-- La Company GROUP ya existe (creada por company-memberships); acá se cuelga
-- el arquetipo y el snapshot inmutable de EEFF/declaraciones (llenado UNA vez
-- en publish-snapshot, nunca sobreescrito) + resultado del oráculo + notas.
CREATE TABLE IF NOT EXISTS "class_session_companies" (
  "id"                         UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_session_id"           UUID NOT NULL,
  "company_id"                 UUID NOT NULL,
  "archetype"                  "ClassSessionArchetype" NOT NULL,
  "snapshot_trial_balance"     JSONB,
  "snapshot_balance_sheet"     JSONB,
  "snapshot_income_statement"  JSONB,
  "snapshot_tax_declarations"  JSONB,
  "snapshot_published_at"      TIMESTAMP(3),
  "oracle_discrepancies"       JSONB,
  "accounting_score"           DECIMAL(5,2),
  "audit_score"                DECIMAL(5,2),
  "created_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "class_session_companies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_session_companies_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_session_companies_company_id_fkey"       FOREIGN KEY ("company_id")       REFERENCES "companies"("id")     ON DELETE CASCADE ON UPDATE CASCADE
);

-- una Company solo puede tener UNA fila de sesión (y esta unicidad es la que
-- permite que auditor/auditee de la tabla siguiente referencien company_id)
CREATE UNIQUE INDEX IF NOT EXISTS "class_session_companies_company_id_key" ON "class_session_companies"("company_id");
CREATE INDEX IF NOT EXISTS "class_session_companies_class_session_id_idx" ON "class_session_companies"("class_session_id");

-- ── class_session_audit_assignments ──
-- Derangement: cada empresa audita EXACTAMENTE a otra y es auditada por
-- EXACTAMENTE otra. Las FK de auditor/auditee apuntan a la columna
-- UNIQUE company_id de class_session_companies (no a su id).
CREATE TABLE IF NOT EXISTS "class_session_audit_assignments" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_session_id"    UUID NOT NULL,
  "auditor_company_id"  UUID NOT NULL,
  "auditee_company_id"  UUID NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "class_session_audit_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_session_audit_assignments_class_session_id_fkey"   FOREIGN KEY ("class_session_id")   REFERENCES "class_sessions"("id")                     ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_session_audit_assignments_auditor_company_id_fkey" FOREIGN KEY ("auditor_company_id") REFERENCES "class_session_companies"("company_id")    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_session_audit_assignments_auditee_company_id_fkey" FOREIGN KEY ("auditee_company_id") REFERENCES "class_session_companies"("company_id")    ON DELETE CASCADE ON UPDATE CASCADE
);

-- cada empresa audita a UNA (auditor_company_id único) y es auditada por UNA (auditee_company_id único)
CREATE UNIQUE INDEX IF NOT EXISTS "class_session_audit_assignments_auditor_company_id_key" ON "class_session_audit_assignments"("auditor_company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "class_session_audit_assignments_auditee_company_id_key" ON "class_session_audit_assignments"("auditee_company_id");
CREATE INDEX IF NOT EXISTS "class_session_audit_assignments_class_session_id_idx"          ON "class_session_audit_assignments"("class_session_id");

-- ── class_session_audit_findings ──
-- Hallazgo del estudiante auditor. matched=NULL hasta que el oráculo evalúa
-- (en la transición grade), luego true/false + match_detail.
CREATE TABLE IF NOT EXISTS "class_session_audit_findings" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "assignment_id"   UUID NOT NULL,
  "created_by"      UUID NOT NULL,
  "section"         TEXT NOT NULL,
  "account_code"    TEXT,
  "description"     TEXT NOT NULL,
  "claimed_amount"  DECIMAL(15,2),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "matched"         BOOLEAN,
  "match_detail"    TEXT,

  CONSTRAINT "class_session_audit_findings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_session_audit_findings_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "class_session_audit_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_session_audit_findings_created_by_fkey"    FOREIGN KEY ("created_by")    REFERENCES "users"("id")                          ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "class_session_audit_findings_assignment_id_idx" ON "class_session_audit_findings"("assignment_id");
