import {
  Injectable, NotFoundException, BadRequestException, ConflictException, Logger,
} from '@nestjs/common';
import { JournalEntryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ────────────────────────────────────────────────────────────────
 *  JournalApprovalService — workflow HYBRID
 *
 *  En modo HYBRID, BusinessEventsService crea asientos con
 *  status=PENDING. Este servicio implementa los dos finales:
 *
 *   confirmEntry  → status=CONFIRMED, isPending=false
 *                   (el asiento entra a saldos y reportes)
 *
 *   rejectEntry   → status=REJECTED, isPending=false
 *                   (queda visible para auditoría pero excluido de saldos;
 *                    el usuario es libre de crear uno manual reemplazo)
 *
 *  Reglas de negocio:
 *   · Solo asientos PENDING pueden confirmarse o rechazarse.
 *   · Un asiento ya CONFIRMED se "edita" vía el flujo normal de reversal,
 *     no aquí (los asientos confirmados son inmutables por diseño).
 *   · No se permite eliminar entradas — REJECTED preserva trazabilidad.
 * ────────────────────────────────────────────────────────────────
 */
@Injectable()
export class JournalApprovalService {
  private readonly logger = new Logger(JournalApprovalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Confirma un asiento PENDING. Lo deja CONFIRMED y empieza a contar
   * para saldos y reportes.
   */
  async confirmEntry(companyId: string, entryId: string, userId: string) {
    const entry = await this._getPendingEntry(companyId, entryId);

    const updated = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data:  {
        status:    JournalEntryStatus.CONFIRMED,
        isPending: false,
      },
      include: { lines: { include: { account: true } } },
    });

    this.logger.log(
      `[approve] entry #${updated.entryNumber} confirmado por user=${userId} ` +
      `(source=${updated.sourceType}/${updated.sourceId})`,
    );
    return updated;
  }

  /**
   * Rechaza un asiento PENDING. Lo deja REJECTED.
   * No borra: se conserva con sus líneas para auditoría.
   */
  async rejectEntry(companyId: string, entryId: string, userId: string, reason?: string) {
    const entry = await this._getPendingEntry(companyId, entryId);

    const updated = await this.prisma.journalEntry.update({
      where: { id: entry.id },
      data:  {
        status:      JournalEntryStatus.REJECTED,
        isPending:   false,
        // Aprovecho el campo `reference` para conservar el motivo.
        // Si reference ya tenía valor, lo prefijo.
        reference:   reason
          ? `[REJECTED: ${reason}] ${entry.reference ?? ''}`.trim()
          : entry.reference,
      },
      include: { lines: { include: { account: true } } },
    });

    this.logger.warn(
      `[approve] entry #${updated.entryNumber} RECHAZADO por user=${userId} ` +
      `(source=${updated.sourceType}/${updated.sourceId}) reason=${reason ?? 'n/a'}`,
    );
    return updated;
  }

  /**
   * Lista asientos pendientes — útil para badge / pantalla de revisión.
   */
  async findPending(companyId: string) {
    return this.prisma.journalEntry.findMany({
      where:   { companyId, status: JournalEntryStatus.PENDING },
      include: { lines: { include: { account: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── helper ─────────────────────────────────────────────────────

  private async _getPendingEntry(companyId: string, entryId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: entryId, companyId },
    });
    if (!entry) {
      throw new NotFoundException('Asiento no encontrado');
    }
    if (entry.status === JournalEntryStatus.CONFIRMED) {
      throw new ConflictException(
        'El asiento ya está confirmado. Para revertirlo usa el endpoint de reverse.',
      );
    }
    if (entry.status === JournalEntryStatus.REJECTED) {
      throw new ConflictException(
        'El asiento ya fue rechazado. No se puede modificar su estado.',
      );
    }
    return entry;
  }
}
