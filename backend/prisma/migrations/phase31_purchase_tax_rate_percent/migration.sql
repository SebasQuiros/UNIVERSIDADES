-- phase31_purchase_tax_rate_percent
--
-- Unifica la convención de la tasa de impuesto. Todo el sistema guarda el
-- porcentaje (13, 8, 4, 2, 1, 0) salvo purchase_invoices, que guardaba la
-- fracción (0.13). Esa asimetría obligaba a convertir a mano en cada lectura
-- y, peor, la columna DECIMAL(5,4) tiene tope 9.9999: escribir el valor
-- natural 13 desbordaba.
--
-- El ORDEN importa: primero se ensancha la columna, después se multiplica.
-- Al revés, 0.13 * 100 no cabe en DECIMAL(5,4) y la migración falla.
--
-- Idempotente: solo convierte si la columna sigue en la escala vieja.

DO $$
DECLARE
  escala_actual INT;
BEGIN
  SELECT numeric_scale INTO escala_actual
  FROM information_schema.columns
  WHERE table_name = 'purchase_invoices' AND column_name = 'tax_rate';

  IF escala_actual = 4 THEN
    -- 1. Ensanchar para que quepa el porcentaje.
    ALTER TABLE "purchase_invoices" ALTER COLUMN "tax_rate" TYPE DECIMAL(5,2);

    -- 2. Convertir fracción → porcentaje (0.13 → 13.00).
    UPDATE "purchase_invoices" SET "tax_rate" = "tax_rate" * 100;

    -- 3. Alinear el valor por defecto.
    ALTER TABLE "purchase_invoices" ALTER COLUMN "tax_rate" SET DEFAULT 13;
  END IF;
END $$;
