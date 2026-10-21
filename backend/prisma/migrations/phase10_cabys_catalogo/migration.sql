-- Catalogo CABYS nacional, local.
--
-- Sin companyId a proposito: es el catalogo oficial del BCCR, el mismo para
-- todas las instituciones. Se llena con scripts/importar-cabys.ts.
CREATE TABLE IF NOT EXISTS "cabys_items" (
    "codigo"      VARCHAR(13) NOT NULL,
    "descripcion" TEXT        NOT NULL,
    "impuesto"    INTEGER     NOT NULL,
    "jerarquia"   TEXT        NOT NULL,
    "busqueda"    TEXT        NOT NULL,
    "version"     TEXT        NOT NULL DEFAULT '2025',
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabys_items_pkey" PRIMARY KEY ("codigo")
);

-- Las busquedas son LIKE '%palabra%', que no puede usar un indice B-tree.
-- Con ~20 500 filas el recorrido completo es de milisegundos, asi que el
-- indice simple alcanza; si algun dia estorba, el siguiente paso es pg_trgm.
CREATE INDEX IF NOT EXISTS "cabys_items_busqueda_idx" ON "cabys_items" ("busqueda");
