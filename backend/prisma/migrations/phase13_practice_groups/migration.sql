-- Multiempresa en modo práctica (Espacio Contador): grupos + comercio entre
-- empresas de práctica reusando ProcurementOrder (con practice_group_id).

CREATE TABLE IF NOT EXISTS "practice_groups" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       TEXT NOT NULL,
  "code"       TEXT NOT NULL UNIQUE,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "practice_group_members" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id"   UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "joined_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practice_group_members_group_company_uniq" UNIQUE ("group_id", "company_id"),
  CONSTRAINT "practice_group_members_group_fk" FOREIGN KEY ("group_id") REFERENCES "practice_groups"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "practice_group_members_group_idx"   ON "practice_group_members"("group_id");
CREATE INDEX IF NOT EXISTS "practice_group_members_company_idx" ON "practice_group_members"("company_id");

ALTER TABLE "procurement_orders" ALTER COLUMN "exercise_id" DROP NOT NULL;
ALTER TABLE "procurement_orders" ADD COLUMN IF NOT EXISTS "practice_group_id" UUID;
CREATE INDEX IF NOT EXISTS "procurement_orders_practice_group_id_idx" ON "procurement_orders"("practice_group_id");
