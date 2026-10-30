-- Multiempresa: la persona docente define el tipo de negocio y el escenario
-- con el que arrancan TODAS las empresas del aula.
--
-- El tipo era un enum cerrado de cuatro (ferreteria, agencia, bufete,
-- distribuidor). Una clase de panaderia no es ninguna de las cuatro.
ALTER TABLE "class_sessions"
  ADD COLUMN IF NOT EXISTS "tipo_negocio"      TEXT,
  ADD COLUMN IF NOT EXISTS "escenario_inicial" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- El arquetipo deja de ser obligatorio. Se conserva para las aulas ya creadas
-- y porque la fase de auditoria todavia lo usa para rotular.
ALTER TABLE "class_session_companies"
  ALTER COLUMN "archetype" DROP NOT NULL;
