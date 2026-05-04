import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ────────────────────────────────────────────────────────────────
 *  AccountingMode
 *
 *  MANUAL    → no se generan asientos automáticos (estudiante registra a mano)
 *  AUTOMATIC → todo evento de negocio genera su asiento (default)
 *  HYBRID    → se generan asientos pero quedan flag isPending=true
 *              hasta que el estudiante los confirme.
 * ────────────────────────────────────────────────────────────────
 *
 *  Fase 2 — el resolver consume `ExerciseConfig.autoJournal`:
 *    - autoJournal=false → MANUAL
 *    - autoJournal=true  → AUTOMATIC (a menos que `settings.accountingMode`
 *      legacy lo fuerce a HYBRID)
 *
 *  Soporta INDIVIDUAL (via attempt.exercise) y GROUP (via exerciseId directo).
 */
export type AccountingMode = 'MANUAL' | 'AUTOMATIC' | 'HYBRID';

const VALID_MODES: AccountingMode[] = ['MANUAL', 'AUTOMATIC', 'HYBRID'];
const DEFAULT_MODE: AccountingMode = 'AUTOMATIC';

@Injectable()
export class AccountingModeResolver {
  constructor(private readonly prisma: PrismaService) {}

  async forCompany(companyId: string): Promise<AccountingMode> {
    const company = await this.prisma.company.findUnique({
      where:  { id: companyId },
      select: {
        exerciseId: true,
        attempt: {
          select: {
            exercise: {
              select: { id: true, settings: true, config: { select: { autoJournal: true } } },
            },
          },
        },
        exercise: {
          select: { id: true, settings: true, config: { select: { autoJournal: true } } },
        },
      },
    });
    if (!company) return DEFAULT_MODE;

    // ExerciseConfig manda — si está autoJournal=false, fuerza MANUAL.
    const config =
      company.exercise?.config
      ?? company.attempt?.exercise?.config
      ?? null;
    if (config && config.autoJournal === false) return 'MANUAL';

    // Legacy: campo settings.accountingMode permite forzar HYBRID.
    const settings =
      (company.exercise?.settings ?? company.attempt?.exercise?.settings ?? null) as
      | { accountingMode?: string }
      | null;
    const raw = settings?.accountingMode;
    if (raw && VALID_MODES.includes(raw as AccountingMode)) {
      return raw as AccountingMode;
    }

    return DEFAULT_MODE;
  }

  /**
   * Versión cruda devolviendo todo el ExerciseConfig — útil cuando un caller
   * quiere chequear varios toggles (autoAR, autoAP, autoInventory) sin hacer
   * 4 viajes a la BD.
   */
  async resolveConfig(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where:  { id: companyId },
      select: {
        attempt:  { select: { exercise: { select: { config: true, settings: true } } } },
        exercise: { select: { config: true, settings: true } },
      },
    });
    const config =
      company?.exercise?.config
      ?? company?.attempt?.exercise?.config
      ?? null;
    return {
      mode: await this.forCompany(companyId),
      config,
    };
  }
}
