-- phase20_invoice_pdf_backup
--
-- Respaldo del PDF de factura en la BD (mismo patrón que la columna `xml`,
-- que ya guarda el contenido completo ahí). El archivo en disco de Railway
-- se pierde en cada redeploy (contenedor efímero, sin volumen persistente) —
-- esto permite regenerarlo desde la BD cuando el archivo local ya no existe.
-- Aditivo, idempotente.

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "pdf_data" BYTEA;
