-- phase29_user_tenant_constraint
--
-- INVARIANTE MULTI-TENANT a nivel de base de datos: todo usuario debe
-- pertenecer a una institución (universidad o colegio). La única excepción es
-- SUPERADMIN, que por diseño es global.
--
-- Un usuario "huérfano" (university_id NULL) era la raíz de varias fugas entre
-- instituciones: los chequeos de aislamiento no tenían con qué comparar y
-- terminaban concediendo acceso. Con esta restricción es imposible crearlo,
-- incluso por script o import directo.
--
-- Idempotente. NOT VALID evita que falle si hubiera filas heredadas
-- inconsistentes; se valida aparte y, si esa validación falla, la restricción
-- igual protege TODA inserción/actualización futura.

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_tenant_required"
    CHECK (role = 'SUPERADMIN' OR university_id IS NOT NULL)
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "users" VALIDATE CONSTRAINT "users_tenant_required";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'users_tenant_required no pudo validarse sobre filas existentes; sigue aplicando a nuevas filas.';
END $$;
