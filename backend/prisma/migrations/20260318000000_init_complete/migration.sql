-- ================================================================
--  CONTAFÁCIL SQ — Migración inicial completa
--  Una sola migración con todas las tablas en orden correcto
--  Fases 1, 2, 3 y 4
-- ================================================================

-- Enums
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'TEACHER', 'STUDENT');
CREATE TYPE "OAuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'MICROSOFT');
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'CANCELLED');
CREATE TYPE "InvoiceType" AS ENUM ('FE', 'NC', 'ND', 'TE');
CREATE TYPE "SaleCondition" AS ENUM ('CASH', 'CREDIT', 'CONSIGNMENT', 'APART', 'LEASE', 'OTHER');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'CHECK', 'TRANSFER', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REVERSED');
CREATE TYPE "PeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');
CREATE TYPE "JournalSource" AS ENUM ('MANUAL', 'AUTO_INVOICE', 'AUTO_PAYMENT', 'AUTO_PURCHASE', 'ADJUSTMENT', 'PERIOD_CLOSING', 'OPENING_BALANCE', 'REVERSAL');
CREATE TYPE "MovementType" AS ENUM ('SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN', 'INITIAL_STOCK');
CREATE TYPE "ExerciseStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'GRADED');
CREATE TYPE "ExerciseDifficulty" AS ENUM ('BASIC', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "ExerciseType" AS ENUM ('FULL_CYCLE', 'JOURNAL_ONLY', 'INVOICING_ONLY', 'INVENTORY_ONLY');
CREATE TYPE "TrackingEvent" AS ENUM ('EXERCISE_OPENED', 'EXERCISE_RESUMED', 'INVOICE_CREATED', 'INVOICE_ISSUED', 'JOURNAL_ENTRY_SAVED', 'REPORT_VIEWED', 'EXERCISE_SUBMITTED', 'CLIENT_CREATED', 'PRODUCT_CREATED');
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'EXERCISE_ASSIGNED', 'EXERCISE_DUE', 'GRADED', 'SYSTEM');

-- ── Plans ─────────────────────────────────────────────────────
CREATE TABLE "plans" (
    "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"         TEXT NOT NULL,
    "max_students" INTEGER NOT NULL DEFAULT 50,
    "max_courses"  INTEGER NOT NULL DEFAULT 5,
    "price_usd"    DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "features"     JSONB NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Universities ──────────────────────────────────────────────
CREATE TABLE "universities" (
    "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"         TEXT NOT NULL,
    "short_name"   TEXT,
    "country"      TEXT NOT NULL DEFAULT 'Costa Rica',
    "website"      TEXT,
    "logo_url"     TEXT,
    "plan_id"      UUID REFERENCES "plans"("id"),
    "max_students" INTEGER NOT NULL DEFAULT 50,
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "settings"     JSONB NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE "users" (
    "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"                 TEXT NOT NULL,
    "email"                TEXT NOT NULL UNIQUE,
    "password_hash"        TEXT,
    "role"                 "Role" NOT NULL DEFAULT 'STUDENT',
    "university_id"        UUID REFERENCES "universities"("id"),
    "avatar_url"           TEXT,
    "oauth_provider"       "OAuthProvider" NOT NULL DEFAULT 'LOCAL',
    "oauth_id"             TEXT,
    "is_active"            BOOLEAN NOT NULL DEFAULT true,
    "email_verified"       BOOLEAN NOT NULL DEFAULT false,
    "reset_token"          TEXT,
    "reset_token_expires"  TIMESTAMPTZ,
    "last_login"           TIMESTAMPTZ,
    "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("oauth_provider", "oauth_id")
);
CREATE INDEX "idx_users_email" ON "users"("email");
CREATE INDEX "idx_users_university_id" ON "users"("university_id");
CREATE INDEX "idx_users_role" ON "users"("role");

-- ── Sessions ──────────────────────────────────────────────────
CREATE TABLE "sessions" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"       UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "token"         TEXT NOT NULL UNIQUE,
    "refresh_token" TEXT NOT NULL UNIQUE,
    "ip_address"    TEXT,
    "user_agent"    TEXT,
    "device_info"   TEXT,
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "expires_at"    TIMESTAMPTZ NOT NULL,
    "last_used_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "revoked_at"    TIMESTAMPTZ,
    "revoked_by"    UUID,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_sessions_user_id"       ON "sessions"("user_id");
CREATE INDEX "idx_sessions_token"         ON "sessions"("token");
CREATE INDEX "idx_sessions_refresh_token" ON "sessions"("refresh_token");

-- ── Courses ───────────────────────────────────────────────────
CREATE TABLE "courses" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "university_id" UUID NOT NULL REFERENCES "universities"("id"),
    "teacher_id"    UUID NOT NULL REFERENCES "users"("id"),
    "name"          TEXT NOT NULL,
    "description"   TEXT,
    "code"          TEXT,
    "period"        TEXT,
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_courses_university_id" ON "courses"("university_id");
CREATE INDEX "idx_courses_teacher_id"    ON "courses"("teacher_id");

-- ── Enrollments ───────────────────────────────────────────────
CREATE TABLE "enrollments" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "course_id"   UUID NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
    "student_id"  UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("course_id", "student_id")
);
CREATE INDEX "idx_enrollments_course_id"  ON "enrollments"("course_id");
CREATE INDEX "idx_enrollments_student_id" ON "enrollments"("student_id");

-- ── Exercises ─────────────────────────────────────────────────
CREATE TABLE "exercises" (
    "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "course_id"    UUID NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
    "teacher_id"   UUID NOT NULL REFERENCES "users"("id"),
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "instructions" TEXT,
    "difficulty"   "ExerciseDifficulty" NOT NULL DEFAULT 'BASIC',
    "type"         "ExerciseType" NOT NULL DEFAULT 'FULL_CYCLE',
    "max_score"    DECIMAL(5,2) NOT NULL DEFAULT 100,
    "due_date"     TIMESTAMPTZ,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "settings"     JSONB NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_exercises_course_id"  ON "exercises"("course_id");
CREATE INDEX "idx_exercises_teacher_id" ON "exercises"("teacher_id");

-- ── Exercise Rubrics ──────────────────────────────────────────
CREATE TABLE "exercise_rubrics" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "exercise_id"    UUID NOT NULL REFERENCES "exercises"("id") ON DELETE CASCADE,
    "criterion"      TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "expected_value" TEXT,
    "points"         DECIMAL(5,2) NOT NULL,
    "order"          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "idx_exercise_rubrics_exercise_id" ON "exercise_rubrics"("exercise_id");

-- ── Exercise Attempts ─────────────────────────────────────────
CREATE TABLE "exercise_attempts" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "exercise_id" UUID NOT NULL REFERENCES "exercises"("id") ON DELETE CASCADE,
    "student_id"  UUID NOT NULL REFERENCES "users"("id"),
    "status"      "ExerciseStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "score"       DECIMAL(5,2),
    "max_score"   DECIMAL(5,2) NOT NULL DEFAULT 100,
    "feedback"    TEXT,
    "graded_by"   UUID REFERENCES "users"("id"),
    "graded_at"   TIMESTAMPTZ,
    "started_at"  TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("exercise_id", "student_id")
);
CREATE INDEX "idx_exercise_attempts_exercise_id" ON "exercise_attempts"("exercise_id");
CREATE INDEX "idx_exercise_attempts_student_id"  ON "exercise_attempts"("student_id");

-- ── Activity Tracking ─────────────────────────────────────────
CREATE TABLE "activity_tracking" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL REFERENCES "exercise_attempts"("id") ON DELETE CASCADE,
    "student_id" UUID NOT NULL REFERENCES "users"("id"),
    "event"      "TrackingEvent" NOT NULL,
    "metadata"   JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_activity_tracking_attempt_id" ON "activity_tracking"("attempt_id");

-- ── Session Tracking ──────────────────────────────────────────
CREATE TABLE "session_tracking" (
    "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "attempt_id"       UUID NOT NULL REFERENCES "exercise_attempts"("id") ON DELETE CASCADE,
    "student_id"       UUID NOT NULL REFERENCES "users"("id"),
    "started_at"       TIMESTAMPTZ NOT NULL,
    "ended_at"         TIMESTAMPTZ,
    "duration_seconds" INTEGER,
    "last_ping_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_session_tracking_attempt_id" ON "session_tracking"("attempt_id");

-- ── Student Progress ──────────────────────────────────────────
CREATE TABLE "student_progress" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "attempt_id"     UUID NOT NULL UNIQUE REFERENCES "exercise_attempts"("id") ON DELETE CASCADE,
    "student_id"     UUID NOT NULL,
    "exercise_id"    UUID NOT NULL,
    "company_id"     UUID,
    "progress_pct"   DECIMAL(5,2) NOT NULL DEFAULT 0,
    "invoices_count" INTEGER NOT NULL DEFAULT 0,
    "entries_count"  INTEGER NOT NULL DEFAULT 0,
    "clients_count"  INTEGER NOT NULL DEFAULT 0,
    "products_count" INTEGER NOT NULL DEFAULT 0,
    "time_spent_min" INTEGER NOT NULL DEFAULT 0,
    "last_activity"  TIMESTAMPTZ,
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_student_progress_student_id"  ON "student_progress"("student_id");
CREATE INDEX "idx_student_progress_exercise_id" ON "student_progress"("exercise_id");

-- ── Companies ─────────────────────────────────────────────────
CREATE TABLE "companies" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "attempt_id"        UUID NOT NULL UNIQUE REFERENCES "exercise_attempts"("id") ON DELETE CASCADE,
    "student_id"        UUID NOT NULL REFERENCES "users"("id"),
    "name"              TEXT NOT NULL,
    "legal_id"          TEXT NOT NULL,
    "legal_id_type"     TEXT NOT NULL DEFAULT '02',
    "economic_activity" TEXT NOT NULL DEFAULT '510101',
    "address"           TEXT,
    "phone"             TEXT,
    "email"             TEXT,
    "currency"          TEXT NOT NULL DEFAULT 'CRC',
    "fiscal_period_start" TIMESTAMPTZ,
    "fiscal_period_end"   TIMESTAMPTZ,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_companies_student_id" ON "companies"("student_id");

-- ── Accounting Periods ────────────────────────────────────────
CREATE TABLE "accounting_periods" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "name"       TEXT NOT NULL,
    "type"       "PeriodType" NOT NULL DEFAULT 'MONTHLY',
    "start_date" DATE NOT NULL,
    "end_date"   DATE NOT NULL,
    "status"     "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at"  TIMESTAMPTZ,
    "closed_by"  UUID,
    "notes"      TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("company_id", "start_date", "end_date")
);
CREATE INDEX "idx_accounting_periods_company_id" ON "accounting_periods"("company_id");
CREATE INDEX "idx_accounting_periods_status"     ON "accounting_periods"("status");

-- ── Accounts ──────────────────────────────────────────────────
CREATE TABLE "accounts" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"     UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "code"           TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "type"           "AccountType" NOT NULL,
    "sub_type"       TEXT,
    "parent_id"      UUID REFERENCES "accounts"("id"),
    "level"          INTEGER NOT NULL DEFAULT 1,
    "is_header"      BOOLEAN NOT NULL DEFAULT false,
    "normal_balance" "NormalBalance" NOT NULL,
    "description"    TEXT,
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("company_id", "code")
);
CREATE INDEX "idx_accounts_company_id" ON "accounts"("company_id");
CREATE INDEX "idx_accounts_parent_id"  ON "accounts"("parent_id");
CREATE INDEX "idx_accounts_type"       ON "accounts"("type");

-- ── Journal Entries ───────────────────────────────────────────
CREATE TABLE "journal_entries" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"     UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "invoice_id"     UUID,
    "payment_id"     UUID,
    "entry_number"   INTEGER NOT NULL,
    "description"    TEXT NOT NULL,
    "entry_date"     DATE NOT NULL,
    "reference"      TEXT,
    "source"         "JournalSource" NOT NULL DEFAULT 'MANUAL',
    "is_reversed"    BOOLEAN NOT NULL DEFAULT false,
    "reversed_by"    UUID,
    "created_by"     UUID NOT NULL REFERENCES "users"("id"),
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("company_id", "entry_number")
);
CREATE INDEX "idx_journal_entries_company_id"  ON "journal_entries"("company_id");
CREATE INDEX "idx_journal_entries_entry_date"  ON "journal_entries"("company_id", "entry_date" DESC);
CREATE INDEX "idx_journal_entries_is_reversed" ON "journal_entries"("company_id", "is_reversed");
CREATE INDEX "idx_journal_entries_invoice_id"  ON "journal_entries"("invoice_id");

-- ── Journal Lines ─────────────────────────────────────────────
CREATE TABLE "journal_lines" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "entry_id"    UUID NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
    "account_id"  UUID NOT NULL REFERENCES "accounts"("id"),
    "company_id"  UUID NOT NULL REFERENCES "companies"("id"),
    "debit"       DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    "credit"      DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    "description" TEXT,
    CONSTRAINT "chk_not_both_sides" CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX "idx_journal_lines_entry_id"        ON "journal_lines"("entry_id");
CREATE INDEX "idx_journal_lines_account_id"      ON "journal_lines"("account_id");
CREATE INDEX "idx_journal_lines_company_account" ON "journal_lines"("company_id", "account_id");
CREATE INDEX "idx_journal_lines_account_entry"   ON "journal_lines"("account_id", "entry_id");

-- ── Journal Sequences ─────────────────────────────────────────
CREATE TABLE "journal_sequences" (
    "company_id"  UUID PRIMARY KEY REFERENCES "companies"("id") ON DELETE CASCADE,
    "last_number" INTEGER NOT NULL DEFAULT 0
);

-- ── Clients ───────────────────────────────────────────────────
CREATE TABLE "clients" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"     UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "name"           TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "id_type"        TEXT NOT NULL DEFAULT '01',
    "email"          TEXT,
    "phone"          TEXT,
    "address"        TEXT,
    "credit_days"    INTEGER NOT NULL DEFAULT 0,
    "credit_limit"   DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_clients_company_id" ON "clients"("company_id");

-- ── Suppliers ─────────────────────────────────────────────────
CREATE TABLE "suppliers" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"     UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "name"           TEXT NOT NULL,
    "identification" TEXT,
    "id_type"        TEXT,
    "email"          TEXT,
    "phone"          TEXT,
    "address"        TEXT,
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_suppliers_company_id" ON "suppliers"("company_id");

-- ── Product Categories ────────────────────────────────────────
CREATE TABLE "product_categories" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Products ──────────────────────────────────────────────────
CREATE TABLE "products" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"  UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "category_id" UUID REFERENCES "product_categories"("id"),
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "sku"         TEXT,
    "cabys_code"  TEXT,
    "price"       DECIMAL(15,2) NOT NULL,
    "cost"        DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_rate"    DECIMAL(5,2) NOT NULL DEFAULT 13,
    "stock"       DECIMAL(15,3) NOT NULL DEFAULT 0,
    "min_stock"   DECIMAL(15,3) NOT NULL DEFAULT 0,
    "unit"        TEXT NOT NULL DEFAULT 'Unid',
    "is_service"  BOOLEAN NOT NULL DEFAULT false,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_products_company_id"  ON "products"("company_id");
CREATE INDEX "idx_products_cabys_code"  ON "products"("cabys_code");

-- ── Inventory Movements ───────────────────────────────────────
CREATE TABLE "inventory_movements" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "product_id"     UUID NOT NULL REFERENCES "products"("id"),
    "company_id"     UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "type"           "MovementType" NOT NULL,
    "quantity"       DECIMAL(15,3) NOT NULL,
    "unit_cost"      DECIMAL(15,2),
    "reference_id"   UUID,
    "reference_type" TEXT,
    "balance_after"  DECIMAL(15,3) NOT NULL,
    "notes"          TEXT,
    "created_by"     UUID NOT NULL REFERENCES "users"("id"),
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_inventory_movements_product_id"  ON "inventory_movements"("product_id");
CREATE INDEX "idx_inventory_movements_company_id"  ON "inventory_movements"("company_id");

-- ── Invoices ──────────────────────────────────────────────────
CREATE TABLE "invoices" (
    "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"            UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "client_id"             UUID REFERENCES "clients"("id"),
    "client_name"           TEXT NOT NULL,
    "client_identification" TEXT NOT NULL,
    "consecutive_number"    TEXT NOT NULL,
    "clave"                 TEXT,
    "type"                  "InvoiceType" NOT NULL DEFAULT 'FE',
    "sale_condition"        "SaleCondition" NOT NULL DEFAULT 'CASH',
    "payment_method"        "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "currency"              TEXT NOT NULL DEFAULT 'CRC',
    "exchange_rate"         DECIMAL(10,4) NOT NULL DEFAULT 1,
    "status"                "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "hacienda_status"       TEXT NOT NULL DEFAULT 'PENDING',
    "subtotal"              DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount"              DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax"                   DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total"                 DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paid_amount"           DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance_due"           DECIMAL(15,2) NOT NULL DEFAULT 0,
    "xml"                   TEXT,
    "pdf_url"               TEXT,
    "hacienda_response"     JSONB,
    "hacienda_message"      TEXT,
    "notes"                 TEXT,
    "issue_date"            TIMESTAMPTZ NOT NULL,
    "issued_at"             TIMESTAMPTZ,
    "created_by_id"         UUID NOT NULL REFERENCES "users"("id"),
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("company_id", "consecutive_number")
);
CREATE INDEX "idx_invoices_company_id"      ON "invoices"("company_id");
CREATE INDEX "idx_invoices_client_id"       ON "invoices"("client_id");
CREATE INDEX "idx_invoices_status"          ON "invoices"("status");
CREATE INDEX "idx_invoices_hacienda_status" ON "invoices"("hacienda_status");

-- ── Invoice Items ─────────────────────────────────────────────
CREATE TABLE "invoice_items" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoice_id"  UUID NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
    "product_id"  UUID REFERENCES "products"("id"),
    "line_no"     INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity"    DECIMAL(15,3) NOT NULL,
    "unit"        TEXT NOT NULL DEFAULT 'Unid',
    "unit_price"  DECIMAL(15,2) NOT NULL,
    "discount"    DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_rate"    DECIMAL(5,2) NOT NULL,
    "tax_amount"  DECIMAL(15,2) NOT NULL,
    "subtotal"    DECIMAL(15,2) NOT NULL,
    "total"       DECIMAL(15,2) NOT NULL,
    "cabys_code"  TEXT
);
CREATE INDEX "idx_invoice_items_invoice_id" ON "invoice_items"("invoice_id");

-- ── Electronic Documents ──────────────────────────────────────
CREATE TABLE "electronic_documents" (
    "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoice_id"   UUID NOT NULL UNIQUE REFERENCES "invoices"("id") ON DELETE CASCADE,
    "clave"        TEXT NOT NULL,
    "consecutive"  TEXT NOT NULL,
    "xml_content"  TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'PENDING',
    "hacienda_msg" TEXT,
    "qr_data"      TEXT,
    "validated_at" TIMESTAMPTZ,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payments ──────────────────────────────────────────────────
CREATE TABLE "payments" (
    "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"   UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "client_id"    UUID NOT NULL REFERENCES "clients"("id"),
    "amount"       DECIMAL(15,2) NOT NULL,
    "currency"     TEXT NOT NULL DEFAULT 'CRC',
    "exchange_rate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "amount_crc"   DECIMAL(15,2) NOT NULL,
    "method"       "PaymentMethod" NOT NULL,
    "reference"    TEXT,
    "status"       "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes"        TEXT,
    "paid_at"      TIMESTAMPTZ NOT NULL,
    "created_by"   UUID NOT NULL REFERENCES "users"("id"),
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_payments_company_id" ON "payments"("company_id");
CREATE INDEX "idx_payments_client_id"  ON "payments"("client_id");

-- ── Invoice Payments ──────────────────────────────────────────
CREATE TABLE "invoice_payments" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
    "payment_id" UUID NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
    "amount"     DECIMAL(15,2) NOT NULL,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("invoice_id", "payment_id")
);
CREATE INDEX "idx_invoice_payments_invoice_id" ON "invoice_payments"("invoice_id");
CREATE INDEX "idx_invoice_payments_payment_id" ON "invoice_payments"("payment_id");

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE "notifications" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "title"      TEXT NOT NULL,
    "body"       TEXT,
    "type"       "NotificationType" NOT NULL DEFAULT 'INFO',
    "is_read"    BOOLEAN NOT NULL DEFAULT false,
    "link"       TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_notifications_user_id" ON "notifications"("user_id", "is_read");

-- ── Activity Log ──────────────────────────────────────────────
CREATE TABLE "activity_log" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"    UUID NOT NULL REFERENCES "users"("id"),
    "company_id" UUID REFERENCES "companies"("id"),
    "action"     TEXT NOT NULL,
    "entity"     TEXT,
    "entity_id"  UUID,
    "ip_address" TEXT,
    "details"    JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_activity_log_user_id"    ON "activity_log"("user_id");
CREATE INDEX "idx_activity_log_company_id" ON "activity_log"("company_id");
CREATE INDEX "idx_activity_log_created_at" ON "activity_log"("created_at" DESC);
