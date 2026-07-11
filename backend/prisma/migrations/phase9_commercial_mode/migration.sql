-- F2: Motor de Simulación Comercial — modo de interacción entre empresas.
-- CONTABLE (compra espejo automática) | EMPRESARIAL (propuesta que B acepta) |
-- ERP_COMPLETO (cotización→OC→recepción→factura→pago). String validado por DTO.

ALTER TABLE "exercise_configs"
  ADD COLUMN IF NOT EXISTS "commercial_mode" TEXT NOT NULL DEFAULT 'CONTABLE';
