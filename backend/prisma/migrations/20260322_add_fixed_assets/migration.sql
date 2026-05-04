-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'SUM_OF_DIGITS', 'DOUBLE_DECLINING');

-- CreateTable fixed_assets
CREATE TABLE "fixed_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "acquisition_date" DATE NOT NULL,
    "acquisition_cost" DECIMAL(15,2) NOT NULL,
    "salvage_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "useful_life_years" INTEGER NOT NULL,
    "depreciation_method" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "accumulated_depreciation" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "book_value" DECIMAL(15,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable depreciation_records
CREATE TABLE "depreciation_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "book_value_after" DECIMAL(15,2) NOT NULL,
    "journal_entry_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "depreciation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable employees
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "position" TEXT,
    "salary" DECIMAL(15,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable payrolls
CREATE TABLE "payrolls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "gross_salary" DECIMAL(15,2) NOT NULL,
    "deduct_ccss" DECIMAL(15,2) NOT NULL,
    "deduct_income_tax" DECIMAL(15,2) NOT NULL,
    "total_deductions" DECIMAL(15,2) NOT NULL,
    "net_salary" DECIMAL(15,2) NOT NULL,
    "employer_ccss" DECIMAL(15,2) NOT NULL,
    "total_cost" DECIMAL(15,2) NOT NULL,
    "journal_entry_id" UUID,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "depreciation_records" ADD CONSTRAINT "depreciation_records_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");

-- CreateIndex
CREATE INDEX "fixed_assets_company_id_idx" ON "fixed_assets"("company_id");
CREATE UNIQUE INDEX "depreciation_records_asset_id_period_key" ON "depreciation_records"("asset_id", "period");
CREATE INDEX "depreciation_records_asset_id_idx" ON "depreciation_records"("asset_id");
CREATE INDEX "depreciation_records_company_id_idx" ON "depreciation_records"("company_id");
CREATE INDEX "employees_company_id_idx" ON "employees"("company_id");
CREATE UNIQUE INDEX "payrolls_employee_id_period_key" ON "payrolls"("employee_id", "period");
CREATE INDEX "payrolls_company_id_idx" ON "payrolls"("company_id");
CREATE INDEX "payrolls_employee_id_idx" ON "payrolls"("employee_id");
