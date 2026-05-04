-- DropForeignKey
ALTER TABLE "accounting_periods" DROP CONSTRAINT "accounting_periods_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "activity_log" DROP CONSTRAINT "activity_log_company_id_fkey";

-- DropForeignKey
ALTER TABLE "activity_log" DROP CONSTRAINT "activity_log_user_id_fkey";

-- DropForeignKey
ALTER TABLE "activity_tracking" DROP CONSTRAINT "activity_tracking_attempt_id_fkey";

-- DropForeignKey
ALTER TABLE "activity_tracking" DROP CONSTRAINT "activity_tracking_student_id_fkey";

-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT "clients_company_id_fkey";

-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "companies_attempt_id_fkey";

-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "companies_student_id_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_university_id_fkey";

-- DropForeignKey
ALTER TABLE "electronic_documents" DROP CONSTRAINT "electronic_documents_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_course_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_student_id_fkey";

-- DropForeignKey
ALTER TABLE "exercise_attempts" DROP CONSTRAINT "exercise_attempts_exercise_id_fkey";

-- DropForeignKey
ALTER TABLE "exercise_attempts" DROP CONSTRAINT "exercise_attempts_graded_by_fkey";

-- DropForeignKey
ALTER TABLE "exercise_attempts" DROP CONSTRAINT "exercise_attempts_student_id_fkey";

-- DropForeignKey
ALTER TABLE "exercise_rubrics" DROP CONSTRAINT "exercise_rubrics_exercise_id_fkey";

-- DropForeignKey
ALTER TABLE "exercises" DROP CONSTRAINT "exercises_course_id_fkey";

-- DropForeignKey
ALTER TABLE "exercises" DROP CONSTRAINT "exercises_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_company_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_created_by_fkey";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_product_id_fkey";

-- DropForeignKey
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "invoice_payments" DROP CONSTRAINT "invoice_payments_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "invoice_payments" DROP CONSTRAINT "invoice_payments_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_client_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_company_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_company_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_created_by_fkey";

-- DropForeignKey
ALTER TABLE "journal_lines" DROP CONSTRAINT "journal_lines_account_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_lines" DROP CONSTRAINT "journal_lines_company_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_lines" DROP CONSTRAINT "journal_lines_entry_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_sequences" DROP CONSTRAINT "journal_sequences_company_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_client_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_company_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_created_by_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_company_id_fkey";

-- DropForeignKey
ALTER TABLE "session_tracking" DROP CONSTRAINT "session_tracking_attempt_id_fkey";

-- DropForeignKey
ALTER TABLE "session_tracking" DROP CONSTRAINT "session_tracking_student_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "student_progress" DROP CONSTRAINT "student_progress_attempt_id_fkey";

-- DropForeignKey
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_company_id_fkey";

-- DropForeignKey
ALTER TABLE "universities" DROP CONSTRAINT "universities_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_university_id_fkey";

-- DropIndex
DROP INDEX "idx_journal_entries_entry_date";

-- DropIndex
DROP INDEX "idx_journal_entries_is_reversed";

-- AlterTable
ALTER TABLE "accounting_periods" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "start_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "end_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "closed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "activity_log" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "activity_tracking" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "fiscal_period_start" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "fiscal_period_end" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "electronic_documents" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "validated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "enrollments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "enrolled_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "exercise_attempts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "graded_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "submitted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "exercise_rubrics" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exercises" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "due_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inventory_movements" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "invoice_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invoice_payments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "applied_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "issue_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "issued_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "journal_entries" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "journal_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "paid_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "plans" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "product_categories" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "session_tracking" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "ended_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_ping_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_used_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_progress" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "last_activity" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "universities" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "reset_token_expires" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_login" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_transactions_company_id_idx" ON "bank_transactions"("company_id");

-- CreateIndex
CREATE INDEX "activity_tracking_student_id_idx" ON "activity_tracking"("student_id");

-- CreateIndex
CREATE INDEX "journal_entries_entry_date_idx" ON "journal_entries"("entry_date");

-- CreateIndex
CREATE INDEX "session_tracking_student_id_idx" ON "session_tracking"("student_id");

-- AddForeignKey
ALTER TABLE "universities" ADD CONSTRAINT "universities_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_rubrics" ADD CONSTRAINT "exercise_rubrics_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_tracking" ADD CONSTRAINT "activity_tracking_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exercise_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_tracking" ADD CONSTRAINT "session_tracking_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exercise_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_tracking" ADD CONSTRAINT "session_tracking_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exercise_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exercise_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_sequences" ADD CONSTRAINT "journal_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_documents" ADD CONSTRAINT "electronic_documents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_accounting_periods_company_id" RENAME TO "accounting_periods_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_accounting_periods_status" RENAME TO "accounting_periods_status_idx";

-- RenameIndex
ALTER INDEX "idx_accounts_company_id" RENAME TO "accounts_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_accounts_parent_id" RENAME TO "accounts_parent_id_idx";

-- RenameIndex
ALTER INDEX "idx_accounts_type" RENAME TO "accounts_type_idx";

-- RenameIndex
ALTER INDEX "idx_activity_log_company_id" RENAME TO "activity_log_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_activity_log_created_at" RENAME TO "activity_log_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_activity_log_user_id" RENAME TO "activity_log_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_activity_tracking_attempt_id" RENAME TO "activity_tracking_attempt_id_idx";

-- RenameIndex
ALTER INDEX "idx_clients_company_id" RENAME TO "clients_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_companies_student_id" RENAME TO "companies_student_id_idx";

-- RenameIndex
ALTER INDEX "idx_courses_teacher_id" RENAME TO "courses_teacher_id_idx";

-- RenameIndex
ALTER INDEX "idx_courses_university_id" RENAME TO "courses_university_id_idx";

-- RenameIndex
ALTER INDEX "idx_enrollments_course_id" RENAME TO "enrollments_course_id_idx";

-- RenameIndex
ALTER INDEX "idx_enrollments_student_id" RENAME TO "enrollments_student_id_idx";

-- RenameIndex
ALTER INDEX "idx_exercise_attempts_exercise_id" RENAME TO "exercise_attempts_exercise_id_idx";

-- RenameIndex
ALTER INDEX "idx_exercise_attempts_student_id" RENAME TO "exercise_attempts_student_id_idx";

-- RenameIndex
ALTER INDEX "idx_exercise_rubrics_exercise_id" RENAME TO "exercise_rubrics_exercise_id_idx";

-- RenameIndex
ALTER INDEX "idx_exercises_course_id" RENAME TO "exercises_course_id_idx";

-- RenameIndex
ALTER INDEX "idx_exercises_teacher_id" RENAME TO "exercises_teacher_id_idx";

-- RenameIndex
ALTER INDEX "idx_inventory_movements_company_id" RENAME TO "inventory_movements_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_inventory_movements_product_id" RENAME TO "inventory_movements_product_id_idx";

-- RenameIndex
ALTER INDEX "idx_invoice_items_invoice_id" RENAME TO "invoice_items_invoice_id_idx";

-- RenameIndex
ALTER INDEX "idx_invoice_payments_invoice_id" RENAME TO "invoice_payments_invoice_id_idx";

-- RenameIndex
ALTER INDEX "idx_invoice_payments_payment_id" RENAME TO "invoice_payments_payment_id_idx";

-- RenameIndex
ALTER INDEX "idx_invoices_client_id" RENAME TO "invoices_client_id_idx";

-- RenameIndex
ALTER INDEX "idx_invoices_company_id" RENAME TO "invoices_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_invoices_hacienda_status" RENAME TO "invoices_hacienda_status_idx";

-- RenameIndex
ALTER INDEX "idx_invoices_status" RENAME TO "invoices_status_idx";

-- RenameIndex
ALTER INDEX "idx_journal_entries_company_id" RENAME TO "journal_entries_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_journal_entries_invoice_id" RENAME TO "journal_entries_invoice_id_idx";

-- RenameIndex
ALTER INDEX "idx_journal_lines_account_entry" RENAME TO "journal_lines_account_id_entry_id_idx";

-- RenameIndex
ALTER INDEX "idx_journal_lines_account_id" RENAME TO "journal_lines_account_id_idx";

-- RenameIndex
ALTER INDEX "idx_journal_lines_company_account" RENAME TO "journal_lines_company_id_account_id_idx";

-- RenameIndex
ALTER INDEX "idx_journal_lines_entry_id" RENAME TO "journal_lines_entry_id_idx";

-- RenameIndex
ALTER INDEX "idx_notifications_user_id" RENAME TO "notifications_user_id_is_read_idx";

-- RenameIndex
ALTER INDEX "idx_payments_client_id" RENAME TO "payments_client_id_idx";

-- RenameIndex
ALTER INDEX "idx_payments_company_id" RENAME TO "payments_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_products_cabys_code" RENAME TO "products_cabys_code_idx";

-- RenameIndex
ALTER INDEX "idx_products_company_id" RENAME TO "products_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_session_tracking_attempt_id" RENAME TO "session_tracking_attempt_id_idx";

-- RenameIndex
ALTER INDEX "idx_sessions_refresh_token" RENAME TO "sessions_refresh_token_idx";

-- RenameIndex
ALTER INDEX "idx_sessions_token" RENAME TO "sessions_token_idx";

-- RenameIndex
ALTER INDEX "idx_sessions_user_id" RENAME TO "sessions_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_student_progress_exercise_id" RENAME TO "student_progress_exercise_id_idx";

-- RenameIndex
ALTER INDEX "idx_student_progress_student_id" RENAME TO "student_progress_student_id_idx";

-- RenameIndex
ALTER INDEX "idx_suppliers_company_id" RENAME TO "suppliers_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_users_email" RENAME TO "users_email_idx";

-- RenameIndex
ALTER INDEX "idx_users_role" RENAME TO "users_role_idx";

-- RenameIndex
ALTER INDEX "idx_users_university_id" RENAME TO "users_university_id_idx";
