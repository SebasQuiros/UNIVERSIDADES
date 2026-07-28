import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Bitácora de acciones de negocio (spec Multiempresa ch3.24/4.11).
 * Registra QUIÉN hizo QUÉ, CUÁNDO y sobre QUÉ documento, por empresa.
 *
 * Regla de oro: escribir en la bitácora NUNCA debe tumbar la operación de
 * negocio. Todos los métodos son best-effort (tragan el error y lo loguean).
 */
@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Registra una acción. No lanza nunca. */
  async log(args: {
    userId: string;
    companyId?: string | null;
    action: string;               // 'INVOICE_ISSUED', 'JOURNAL_ENTRY_CREATED', ...
    entity?: string | null;       // 'Invoice', 'JournalEntry', ...
    entityId?: string | null;
    details?: Record<string, any>;
  }): Promise<void> {
    try {
      if (!args.userId) return;   // el modelo exige autor
      await this.prisma.activityLog.create({
        data: {
          userId:    args.userId,
          companyId: args.companyId ?? null,
          action:    args.action,
          entity:    args.entity ?? null,
          entityId:  args.entityId ?? null,
          details:   (args.details ?? {}) as any,
        },
      });
    } catch (e: any) {
      this.logger.warn(`No se pudo registrar en bitácora (${args.action}): ${e?.message}`);
    }
  }

  /** Bitácora de una empresa, para la UI (más reciente primero). */
  async forCompany(companyId: string, limit = 100) {
    const rows = await this.prisma.activityLog.findMany({
      where:   { companyId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take:    Math.min(limit, 300),
    });
    return rows.map((r) => ({
      id:        r.id,
      action:    r.action,
      entity:    r.entity,
      entityId:  r.entityId,
      details:   r.details,
      createdAt: r.createdAt,
      userId:    r.userId,
      userName:  r.user?.name ?? null,
    }));
  }
}
