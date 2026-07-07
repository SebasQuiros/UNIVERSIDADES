import { Global, Module } from '@nestjs/common';
import { SupabaseAdminService } from './supabase-admin.service';

/**
 * Módulo global: expone `SupabaseAdminService` a toda la app (identidad en
 * Supabase Auth). Al ser @Global, cualquier service puede inyectarlo sin
 * importar este módulo explícitamente.
 */
@Global()
@Module({
  providers: [SupabaseAdminService],
  exports: [SupabaseAdminService],
})
export class SupabaseModule {}
