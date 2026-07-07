-- Fase 8 — Migración a Supabase Auth
-- Enlaza cada usuario de la app con su identidad en Supabase Auth (auth.users.id = JWT sub).
ALTER TABLE "users" ADD COLUMN "auth_id" TEXT;
CREATE UNIQUE INDEX "users_auth_id_key" ON "users"("auth_id");
