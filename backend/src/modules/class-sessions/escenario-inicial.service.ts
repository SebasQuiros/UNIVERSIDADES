import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';

/**
 * Escenario con el que arranca cada empresa del aula.
 *
 * Es UNO SOLO para toda la sesión a propósito. Si cada grupo partiera de un
 * capital o un inventario distinto, la nota terminaría midiendo la suerte del
 * reparto en vez del trabajo. Todas salen de la misma línea.
 */
export interface EscenarioInicial {
  /** Capital aportado por los socios, en colones. */
  capital?: number;
  /** Cuánto de ese capital queda en caja; el resto entra al banco. */
  enCaja?: number;
  /** Inventario de arranque. */
  productos?: Array<{
    nombre: string;
    cabysCode?: string;
    precio: number;
    costo: number;
    stock: number;
    iva?: number;
  }>;
}

const CAPITAL_SOCIAL = '3.1.01.01';
const CAJA           = '1.1.01.01';
const BANCO          = '1.1.01.02';
const INVENTARIO     = '1.1.03.01';
/** CABYS genérico, por si la profe no especifica uno. Servicios n.c.p. */
const CABYS_POR_DEFECTO = '8999000000000';

@Injectable()
export class EscenarioInicialService {
  private readonly logger = new Logger(EscenarioInicialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  /** Valida lo que manda la profe antes de guardarlo. */
  validar(e: EscenarioInicial): EscenarioInicial {
    const capital = Number(e.capital ?? 0);
    const enCaja  = Number(e.enCaja ?? 0);
    if (capital < 0) throw new BadRequestException('El capital no puede ser negativo.');
    if (enCaja < 0)  throw new BadRequestException('El efectivo en caja no puede ser negativo.');
    if (enCaja > capital) {
      throw new BadRequestException(
        'El efectivo en caja no puede superar al capital aportado.',
      );
    }

    const productos = (e.productos ?? []).map((p, i) => {
      const nombre = String(p.nombre ?? '').trim();
      if (nombre.length < 2) {
        throw new BadRequestException(`Producto ${i + 1}: falta el nombre.`);
      }
      const precio = Number(p.precio ?? 0);
      const costo  = Number(p.costo ?? 0);
      const stock  = Number(p.stock ?? 0);
      if (precio < 0 || costo < 0 || stock < 0) {
        throw new BadRequestException(`Producto "${nombre}": no se admiten números negativos.`);
      }
      const iva = Number(p.iva ?? 13);
      if (![0, 1, 2, 4, 8, 13].includes(iva)) {
        throw new BadRequestException(`Producto "${nombre}": IVA ${iva}% no es una tarifa válida en CR.`);
      }
      const cabys = String(p.cabysCode ?? '').trim();
      if (cabys && !/^\d{13}$/.test(cabys)) {
        throw new BadRequestException(`Producto "${nombre}": el código CABYS debe tener 13 dígitos.`);
      }
      return { nombre, cabysCode: cabys || CABYS_POR_DEFECTO, precio, costo, stock, iva };
    });

    return { capital, enCaja, productos };
  }

  /**
   * Siembra el escenario en una empresa.
   *
   * Idempotente: si la empresa ya tiene el asiento de apertura, no hace nada.
   * Importa porque la siembra corre al crear el grupo y también al arrancar la
   * sesión, y sembrar dos veces duplicaría el capital.
   */
  async sembrar(companyId: string, escenario: EscenarioInicial, userId: string): Promise<void> {
    const e = this.validar(escenario ?? {});
    const capital = e.capital ?? 0;
    const productos = e.productos ?? [];
    if (capital <= 0 && !productos.length) return;   // nada que sembrar

    const yaSembrada = await this.prisma.journalEntry.findFirst({
      where:  { companyId, source: 'OPENING_BALANCE' },
      select: { id: true },
    });
    if (yaSembrada) {
      this.logger.log(`La empresa ${companyId} ya tenía apertura; no se vuelve a sembrar.`);
      return;
    }

    const enCaja   = Math.min(e.enCaja ?? 0, capital);
    const enBanco  = capital - enCaja;
    const valorInv = productos.reduce((s, p) => s + p.costo * p.stock, 0);

    await this.prisma.$transaction(async (tx) => {
      // ── Productos ──
      for (const p of productos) {
        await (tx as any).product.create({
          data: {
            companyId,
            name:      p.nombre,
            cabysCode: p.cabysCode,
            price:     p.precio,
            cost:      p.costo,
            taxRate:   p.iva,
            stock:     p.stock,
            unit:      'UNI',
            isService: false,
          },
        });
      }

      // ── Asiento de apertura ──
      //
      // El inventario entra como aporte en especie: suma al activo y al
      // capital. Si no se contara así, el asiento no cuadraría y la empresa
      // arrancaría con la ecuación contable rota — que es lo primero que el
      // estudiante va a revisar.
      const lineas: Array<{ accountCode: string; debit: number; credit: number; description?: string }> = [];
      if (enCaja > 0)   lineas.push({ accountCode: CAJA,       debit: enCaja,   credit: 0, description: 'Efectivo en caja' });
      if (enBanco > 0)  lineas.push({ accountCode: BANCO,      debit: enBanco,  credit: 0, description: 'Depósito en banco' });
      if (valorInv > 0) lineas.push({ accountCode: INVENTARIO, debit: valorInv, credit: 0, description: 'Inventario de arranque' });

      const total = enCaja + enBanco + valorInv;
      if (total > 0) {
        lineas.push({ accountCode: CAPITAL_SOCIAL, debit: 0, credit: total, description: 'Aporte de los socios' });
        await this.journal.createAutoEntry(
          companyId,
          'Constitución de la empresa — aporte inicial',
          new Date(),
          lineas,
          userId,
          'OPENING_BALANCE' as any,
          tx as any,
          undefined,
          undefined,
          'class_session_seed',
          companyId,
        );
      }
    });

    this.logger.log(
      `Empresa ${companyId} sembrada: capital ₡${capital}, ${productos.length} productos, inventario ₡${valorInv}.`,
    );
  }
}
