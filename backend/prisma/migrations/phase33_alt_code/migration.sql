-- phase33_alt_code
--
-- Codigo alterno de cuenta ("codigo del profesor").
--
-- El plan de estudios de la carrera numera las cuentas con TRES DIGITOS
-- (103 Caja Chica, 110 Inventario de Mercaderias, 400 Ventas...), mientras que
-- el motor contable resuelve por el codigo jerarquico (1.1.01.01, 1.1.03.01,
-- 4.1.01.01). Renumerar romperia facturacion, compras, cobros, nomina,
-- depreciacion e inventario: todo lo automatico.
--
-- Esta columna guarda el codigo del curso EN PARALELO, para mostrarlo al lado
-- del codigo del sistema. Nullable a proposito: una empresa sin plan asignado
-- simplemente no lo muestra.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "alt_code" TEXT;

-- Se busca por el codigo del profesor en el catalogo y al escoger cuenta en
-- un asiento. Parcial: la mayoria de filas puede quedar en NULL.
CREATE INDEX IF NOT EXISTS "accounts_company_alt_code_idx"
  ON "accounts" ("company_id", "alt_code")
  WHERE "alt_code" IS NOT NULL;
