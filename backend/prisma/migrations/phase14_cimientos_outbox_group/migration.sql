-- FASE 2a — Cimientos de la Sesión de Aula (escrita a mano, estilo del repo).
--   (A) Outbox del espejo inter-company: estado durable del reflejo venta→compra,
--       para no confundir una falla de plataforma con una omisión del estudiante.
--   (B) Tributación en modo GROUP: attempt_id opcional en retenciones y
--       partial_payments (el anclaje fiscal es company_id, la persona jurídica).

-- ── (A) Outbox del espejo inter-company ──
CREATE TYPE "MirrorStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'DONE', 'FAILED');

CREATE TABLE IF NOT EXISTS "inter_company_mirrors" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_invoice_id"   UUID NOT NULL,
  "seller_company_id"   UUID NOT NULL,
  "buyer_company_id"    UUID,
  "status"              "MirrorStatus" NOT NULL DEFAULT 'PENDING',
  "reason"              TEXT,
  "attempts"            INTEGER NOT NULL DEFAULT 0,
  "last_error"          TEXT,
  "last_attempt_at"     TIMESTAMP(3),
  "purchase_invoice_id" UUID,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- idempotencia: un espejo por factura fuente
CREATE UNIQUE INDEX IF NOT EXISTS "inter_company_mirrors_source_invoice_id_key" ON "inter_company_mirrors"("source_invoice_id");
CREATE INDEX IF NOT EXISTS "inter_company_mirrors_seller_company_id_idx" ON "inter_company_mirrors"("seller_company_id");
CREATE INDEX IF NOT EXISTS "inter_company_mirrors_buyer_company_id_idx"  ON "inter_company_mirrors"("buyer_company_id");
CREATE INDEX IF NOT EXISTS "inter_company_mirrors_status_idx"            ON "inter_company_mirrors"("status");

-- idempotencia del espejo en la compra generada: una factura fuente → a lo sumo
-- una PurchaseInvoice (los NULL son distintos en Postgres; las compras normales
-- del estudiante tienen source_invoice_id NULL y no colisionan).
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_invoices_source_invoice_id_key" ON "purchase_invoices"("source_invoice_id");

-- ── (B) Tributación GROUP: anclar por company_id; attempt_id opcional ──
ALTER TABLE "retenciones"      ALTER COLUMN "attempt_id" DROP NOT NULL;
ALTER TABLE "partial_payments" ALTER COLUMN "attempt_id" DROP NOT NULL;
