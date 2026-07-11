-- F2.2 (Modo Empresarial): enlace de la compra inter-company a la factura del
-- vendedor, para sincronizar inventario al aceptar la propuesta. Las propuestas
-- pendientes son PurchaseInvoice con is_accepted=false + source_invoice_id set.

ALTER TABLE "purchase_invoices"
  ADD COLUMN IF NOT EXISTS "source_invoice_id" UUID;
