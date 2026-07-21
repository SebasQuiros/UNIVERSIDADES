-- Índice cubriente para el predicado de reportes (company + status + reversed + fecha)
CREATE INDEX IF NOT EXISTS "journal_entries_company_status_reversed_date_idx" ON "journal_entries" ("company_id", "status", "is_reversed", "entry_date");
