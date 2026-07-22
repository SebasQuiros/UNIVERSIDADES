-- phase18_taxdecl_company_scope
--
-- Ancla las declaraciones tributarias a una empresa (company_id) para que el
-- snapshot de auditoría de la Sesión de Aula NO mezcle declaraciones de otras
-- empresas del mismo estudiante (práctica, ejercicios individuales).
--   · NULL  → flujo histórico del portal general (anclado solo a user_id).
--   · valor → declaración de esa empresa (p.ej. la empresa GROUP del grupo).
-- ON DELETE SET NULL: si se borra la empresa, la declaración persiste sin empresa
-- (no bloquea el cascade de borrado del ejercicio).

ALTER TABLE "tax_declarations"
  ADD COLUMN IF NOT EXISTS "company_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_declarations_company_id_fkey'
  ) THEN
    ALTER TABLE "tax_declarations"
      ADD CONSTRAINT "tax_declarations_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tax_declarations_company_id_idx"
  ON "tax_declarations"("company_id");
