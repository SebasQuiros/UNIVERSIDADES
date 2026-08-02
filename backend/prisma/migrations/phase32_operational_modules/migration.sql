-- phase32_operational_modules
--
-- Respaldo en base para los 6 modulos del menu que existian solo como
-- pantalla en blanco: bodegas, atributos de producto, listas de precios,
-- facturas y pagos recurrentes, y remisiones.
--
-- Ninguno genera asientos por si solo: son catalogos y programaciones que
-- alimentan a los modulos que si contabilizan.
--
-- Aditiva e idempotente: no toca ninguna tabla existente.

DO $$ BEGIN
  CREATE TYPE "RecurrenceFrequency" AS ENUM
    ('WEEKLY','BIWEEKLY','MONTHLY','BIMONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryNoteStatus" AS ENUM
    ('DRAFT','DISPATCHED','DELIVERED','INVOICED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "warehouses" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID         NOT NULL,
  "name"       TEXT         NOT NULL,
  "code"       TEXT,
  "location"   TEXT,
  "is_default" BOOLEAN      NOT NULL DEFAULT false,
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warehouses_company_fk" FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "warehouses_company_idx" ON "warehouses"("company_id");

CREATE TABLE IF NOT EXISTS "product_attributes" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID         NOT NULL,
  "name"       TEXT         NOT NULL,
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_attributes_company_fk" FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "product_attributes_company_idx" ON "product_attributes"("company_id");

CREATE TABLE IF NOT EXISTS "product_attribute_values" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "attribute_id" UUID         NOT NULL,
  "value"        TEXT         NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_attribute_values_attr_fk" FOREIGN KEY ("attribute_id")
    REFERENCES "product_attributes"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_attribute_values_uniq"
  ON "product_attribute_values"("attribute_id", "value");
CREATE INDEX IF NOT EXISTS "product_attribute_values_attr_idx"
  ON "product_attribute_values"("attribute_id");

CREATE TABLE IF NOT EXISTS "price_lists" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID         NOT NULL,
  "name"       TEXT         NOT NULL,
  "currency"   TEXT         NOT NULL DEFAULT 'CRC',
  "is_default" BOOLEAN      NOT NULL DEFAULT false,
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "price_lists_company_fk" FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "price_lists_company_idx" ON "price_lists"("company_id");

CREATE TABLE IF NOT EXISTS "price_list_items" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "price_list_id" UUID          NOT NULL,
  "product_id"    UUID          NOT NULL,
  "price"         DECIMAL(15,2) NOT NULL,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "price_list_items_list_fk" FOREIGN KEY ("price_list_id")
    REFERENCES "price_lists"("id") ON DELETE CASCADE,
  CONSTRAINT "price_list_items_product_fk" FOREIGN KEY ("product_id")
    REFERENCES "products"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "price_list_items_uniq"
  ON "price_list_items"("price_list_id", "product_id");
CREATE INDEX IF NOT EXISTS "price_list_items_list_idx"    ON "price_list_items"("price_list_id");
CREATE INDEX IF NOT EXISTS "price_list_items_product_idx" ON "price_list_items"("product_id");

CREATE TABLE IF NOT EXISTS "recurring_invoices" (
  "id"          UUID                  NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID                  NOT NULL,
  "client_id"   UUID                  NOT NULL,
  "description" TEXT,
  "amount"      DECIMAL(15,2)         NOT NULL,
  "tax_rate"    DECIMAL(5,2)          NOT NULL DEFAULT 13,
  "frequency"   "RecurrenceFrequency" NOT NULL,
  "next_run_at" TIMESTAMP(3)          NOT NULL,
  "last_run_at" TIMESTAMP(3),
  "times_run"   INTEGER               NOT NULL DEFAULT 0,
  "is_active"   BOOLEAN               NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recurring_invoices_company_fk" FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "recurring_invoices_client_fk" FOREIGN KEY ("client_id")
    REFERENCES "clients"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "recurring_invoices_company_idx" ON "recurring_invoices"("company_id");
CREATE INDEX IF NOT EXISTS "recurring_invoices_next_idx"    ON "recurring_invoices"("next_run_at");

CREATE TABLE IF NOT EXISTS "recurring_payments" (
  "id"            UUID                  NOT NULL DEFAULT gen_random_uuid(),
  "company_id"    UUID                  NOT NULL,
  "supplier_name" TEXT                  NOT NULL,
  "description"   TEXT,
  "amount"        DECIMAL(15,2)         NOT NULL,
  "tax_rate"      DECIMAL(5,2)          NOT NULL DEFAULT 13,
  "frequency"     "RecurrenceFrequency" NOT NULL,
  "next_run_at"   TIMESTAMP(3)          NOT NULL,
  "last_run_at"   TIMESTAMP(3),
  "times_run"     INTEGER               NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN               NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recurring_payments_company_fk" FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "recurring_payments_company_idx" ON "recurring_payments"("company_id");
CREATE INDEX IF NOT EXISTS "recurring_payments_next_idx"    ON "recurring_payments"("next_run_at");

CREATE TABLE IF NOT EXISTS "delivery_notes" (
  "id"         UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID                 NOT NULL,
  "client_id"  UUID                 NOT NULL,
  "number"     TEXT                 NOT NULL,
  "date"       TIMESTAMP(3)         NOT NULL,
  "status"     "DeliveryNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "notes"      TEXT,
  "invoice_id" UUID,
  "created_at" TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_notes_company_fk" FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "delivery_notes_client_fk" FOREIGN KEY ("client_id")
    REFERENCES "clients"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_notes_number_uniq"
  ON "delivery_notes"("company_id", "number");
CREATE INDEX IF NOT EXISTS "delivery_notes_company_idx" ON "delivery_notes"("company_id");

CREATE TABLE IF NOT EXISTS "delivery_note_lines" (
  "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
  "delivery_note_id" UUID          NOT NULL,
  "product_id"       UUID          NOT NULL,
  "description"      TEXT          NOT NULL,
  "quantity"         DECIMAL(15,3) NOT NULL,
  "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_note_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_note_lines_note_fk" FOREIGN KEY ("delivery_note_id")
    REFERENCES "delivery_notes"("id") ON DELETE CASCADE,
  CONSTRAINT "delivery_note_lines_product_fk" FOREIGN KEY ("product_id")
    REFERENCES "products"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "delivery_note_lines_note_idx"
  ON "delivery_note_lines"("delivery_note_id");
