import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BulkReadInterceptor } from './common/interceptors/bulk-read.interceptor';
import { CompanyEnabledGuard } from './common/guards/company-enabled.guard';
import { SupabaseModule }       from './common/supabase/supabase.module';
import { PrismaModule }         from './prisma/prisma.module';
import { ActivityLogModule }    from './common/activity/activity-log.module';
import { HealthModule }         from './modules/health/health.module';
import { AuthModule }           from './modules/auth/auth.module';
import { UsersModule }          from './modules/users/users.module';
import { PeriodsModule }        from './modules/periods/periods.module';
import { AccountsModule }       from './modules/accounts/accounts.module';
import { JournalModule }        from './modules/journal/journal.module';
import { LedgerModule }         from './modules/ledger/ledger.module';
import { ReportsModule }        from './modules/reports/reports.module';
import { CompaniesModule }      from './modules/companies/companies.module';
import { ClientsModule }        from './modules/clients/clients.module';
import { SuppliersModule }      from './modules/suppliers/suppliers.module';
import { BankModule }           from './modules/bank/bank.module';
import { ProductsModule }       from './modules/products/products.module';
import { InvoicesModule }       from './modules/invoices/invoices.module';
import { CreditNotesModule }    from './modules/credit-notes/credit-notes.module';
import { QuotesModule }         from './modules/quotes/quotes.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { InventoryAdjustmentsModule } from './modules/inventory-adjustments/inventory-adjustments.module';
import { UniversitiesModule }   from './modules/universities/universities.module';
import { CoursesModule }        from './modules/courses/courses.module';
import { ExercisesModule }      from './modules/exercises/exercises.module';
import { ExerciseConfigModule } from './modules/exercise-config/exercise-config.module';
import { CompanyMembershipsModule } from './modules/company-memberships/company-memberships.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InterCompanyModule } from './modules/inter-company/inter-company.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { PracticeGroupsModule } from './modules/practice-groups/practice-groups.module';
import { AttemptsModule }       from './modules/attempts/attempts.module';
import { TrackingModule }       from './modules/tracking/tracking.module';
import { GradingModule }        from './modules/grading/grading.module';
import { ClassSessionsModule }  from './modules/class-sessions/class-sessions.module';
import { NegotiationsModule }   from './modules/negotiations/negotiations.module';
import { TransfersModule }      from './modules/transfers/transfers.module';
import { NotificationsModule }  from './modules/notifications/notifications.module';
import { FixedAssetsModule }    from './modules/fixed-assets/fixed-assets.module';
import { PayrollModule }        from './modules/payroll/payroll.module';
import { AiModule }             from './modules/ai/ai.module';
import { TaxDeclarationsModule }  from './modules/tax-declarations/tax-declarations.module';
import { PurchaseInvoicesModule } from './modules/purchase-invoices/purchase-invoices.module';
import { HaciendaModule }         from './modules/hacienda/hacienda.module';
import { OnboardingModule }      from './modules/onboarding/onboarding.module';
import { SuperadminModule }       from './modules/superadmin/superadmin.module';
import { BankReconciliationModule }  from './modules/bank-reconciliation/bank-reconciliation.module';
import { AccountsReceivableModule }  from './modules/accounts-receivable/accounts-receivable.module';
import { AccountsPayableModule }     from './modules/accounts-payable/accounts-payable.module';
import { SecurityModule }            from './modules/security/security.module';
import { MacroModule }               from './modules/macro/macro.module';
import { CompetenciesModule }        from './modules/competencies/competencies.module';
import { CourseTemplatesModule }     from './modules/course-templates/course-templates.module';
import { PedagogyModule }            from './modules/pedagogy/pedagogy.module';
import { SimulatorModule }           from './modules/simulator/simulator.module';
import { AccountingEngineModule }    from './modules/accounting-engine/accounting-engine.module';
import { RedisModule }               from './redis/redis.module';
import { LoggerMiddleware }     from './common/middleware/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    RedisModule,
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 40  }, // 40 req/s por IP
      { name: 'medium', ttl: 60000, limit: 500 }, // 500 req/min por IP
    ]),
    PrismaModule,
    ActivityLogModule,       // Bitácora de acciones (global)
    HealthModule,              // /api/v1/health (público, SELECT 1) — keep-warm de Neon
    // Identidad en Supabase Auth (global) — SupabaseAdminService disponible en toda la app
    SupabaseModule,
    // Phase 2 — Auth
    AuthModule,
    UsersModule,
    // Phase 3 — Accounting Engine
    PeriodsModule,
    AccountsModule,
    JournalModule,
    LedgerModule,
    ReportsModule,
    // Phase 4 — Billing
    CompaniesModule,
    ClientsModule,
    SuppliersModule,
    ProductsModule,
    InvoicesModule,
    CreditNotesModule,         // Phase 17 — Notas de crédito y débito (event-driven)
    QuotesModule,              // Phase 19 — Cotizaciones/presupuestos (pre-venta, sin asiento)
    PurchaseOrdersModule,      // Phase 19 — Órdenes de compra a proveedor + recepción (sin asiento)
    InventoryAdjustmentsModule, // Phase 19 — Ajustes manuales de inventario (event-driven)
    BankModule,
    // Phase 5 — Academic System
    UniversitiesModule,
    CoursesModule,
    ExercisesModule,
    ExerciseConfigModule,      // Fase 1 — Config Engine (toggles auto/manual + companyMode)
    CompanyMembershipsModule,  // Fase 1 — Group companies + memberships + isCompanyEnabled
    InventoryModule,           // Fase 2 — Inventory FIFO + COGS
    InterCompanyModule,        // Fase 4 — Mirror sale → purchase entre companies del mismo exercise
    ProcurementModule,         // F2.3 — Modo ERP Completo: máquina de estados de órdenes de aprovisionamiento
    PracticeGroupsModule,      // Multiempresa en modo práctica (Espacio Contador): grupos + comercio entre empresas de práctica
    AttemptsModule,
    TrackingModule,
    GradingModule,
    ClassSessionsModule,       // "Sesión de Aula" — Kahoot-like sobre Exercise + GROUP companies
    NegotiationsModule,        // Motor de negociación empresarial (Multiempresa cap. 6)
    TransfersModule,           // Transferencias de dinero entre empresas (asiento en ambos lados)
    NotificationsModule,
    // Phase 6 — New Features
    FixedAssetsModule,
    PayrollModule,
    AiModule,
    // Phase 7 — Tax Declarations Practice
    TaxDeclarationsModule,
    // Phase 8 — Purchase Invoices (IVA Crédito Fiscal D-104)
    PurchaseInvoicesModule,
    // Phase 9 — Hacienda API Integration (CABYS + BCCR exchange rate)
    HaciendaModule,
    // Phase 10 — Public University Onboarding
    OnboardingModule,
    // Phase 11 — Super Admin Panel
    SuperadminModule,
    // Phase 12 — Bank Reconciliation
    BankReconciliationModule,
    AccountingEngineModule,    // Motor: invariantes verificables + ProjectionEngine (Accounting Manifest)
    // Phase 13 — AR/AP
    AccountsReceivableModule,
    AccountsPayableModule,
    // Security monitoring (CSP reports, etc.)
    SecurityModule,
    // Indicadores macroeconómicos CR (tipo de cambio, TBP, inflación)
    MacroModule,
    // Competencias (evidencia para acreditación SINAES)
    CompetenciesModule,
    // Plantillas de curso base (contenido listo para usar, multi-universidad)
    CourseTemplatesModule,
    // F3 — Motor pedagógico + perfil de aprendizaje + tutor IA (profe socrático)
    PedagogyModule,
    // F5 — Economía simulada + Simulador financiero (macro real como contexto)
    SimulatorModule,
  ],
  providers: [
    { provide: APP_GUARD,        useClass: ThrottlerGuard },
    // Fase 1 — bloquea rutas /companies/:companyId/* si la company tiene
    // isCompanyEnabled=false (excepto staff: TEACHER/ADMIN/SUPERADMIN).
    { provide: APP_GUARD,        useClass: CompanyEnabledGuard },
    { provide: APP_INTERCEPTOR,  useClass: BulkReadInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      // Express 5 (NestJS 11) ya no acepta el comodín suelto `*`: exige un
      // parámetro con nombre. Nest lo auto-convertía con un warning en cada
      // arranque, pero esa muleta no es permanente.
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
