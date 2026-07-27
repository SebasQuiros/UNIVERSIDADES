-- phase26_session_config
-- Spec Multiempresa cap. 3: config de economía de la sesión (cierre comercial,
-- capital de referencia, moneda). Aditivo e idempotente. NO afecta contabilidad.

ALTER TABLE "class_sessions" ADD COLUMN IF NOT EXISTS "commercial_close_at" TIMESTAMP(3);
ALTER TABLE "class_sessions" ADD COLUMN IF NOT EXISTS "initial_capital" DECIMAL(14,2);
ALTER TABLE "class_sessions" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'CRC';
