-- ================================================================
--  PHASE 5 — Índices de performance.
--
--  Tablas high-write con queries frecuentes por (companyId, createdAt DESC)
--  o (entryDate, isReversed). Sin estos índices, listados de "últimos N"
--  hacen seq scan completo + sort.
--
--  Todos los índices son IF NOT EXISTS → idempotente, seguro re-aplicar.
-- ================================================================

-- ── INVOICES — listado por empresa ordenado por fecha emisión ─
CREATE INDEX IF NOT EXISTS "invoices_company_id_issue_date_idx"
  ON "invoices"("company_id", "issue_date" DESC);

-- ── INVOICES — filtro por status (pendientes, emitidas) ───────
CREATE INDEX IF NOT EXISTS "invoices_company_id_status_issue_date_idx"
  ON "invoices"("company_id", "status", "issue_date" DESC);

-- ── JOURNAL_ENTRIES — listado de últimos asientos ─────────────
CREATE INDEX IF NOT EXISTS "journal_entries_company_id_entry_date_idx"
  ON "journal_entries"("company_id", "entry_date" DESC);

-- ── JOURNAL_ENTRIES — para filtros del libro mayor ────────────
CREATE INDEX IF NOT EXISTS "journal_entries_company_id_is_reversed_entry_date_idx"
  ON "journal_entries"("company_id", "is_reversed", "entry_date");

-- ── PURCHASE_INVOICES — listado por empresa ordenado por fecha
CREATE INDEX IF NOT EXISTS "purchase_invoices_company_id_date_idx"
  ON "purchase_invoices"("company_id", "date" DESC);

-- ── EXERCISE_ATTEMPTS — created_at para "últimos intentos" ────
CREATE INDEX IF NOT EXISTS "exercise_attempts_student_id_created_at_idx"
  ON "exercise_attempts"("student_id", "created_at" DESC);

-- ── ACTIVITY_LOGS / SESSION_TRACKING / NOTIFICATIONS si existen
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='activity_logs') THEN
    CREATE INDEX IF NOT EXISTS "activity_logs_company_id_created_at_idx"
      ON "activity_logs"("company_id", "created_at" DESC);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='notifications') THEN
    CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx"
      ON "notifications"("user_id", "created_at" DESC);
  END IF;
END $$;

-- ── INVENTORY_MOVEMENTS — kardex por producto ordenado por fecha
CREATE INDEX IF NOT EXISTS "inventory_movements_company_id_product_id_created_at_idx"
  ON "inventory_movements"("company_id", "product_id", "created_at" DESC);
