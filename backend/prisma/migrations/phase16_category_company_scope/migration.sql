-- Scope multi-tenant de categorías de producto.
-- La tabla era GLOBAL (sin company_id): cualquier empresa veía/renombraba/borraba
-- categorías de otras. Verificado vacía (0 filas, 0 productos con categoría) antes
-- de endurecer, por eso el NOT NULL entra directo sin backfill.
ALTER TABLE "product_categories" ADD COLUMN "company_id" UUID NOT NULL;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "product_categories_company_id_idx" ON "product_categories"("company_id");
-- Unicidad del nombre POR empresa (el service además chequea case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_company_id_name_key" ON "product_categories"("company_id", "name");
