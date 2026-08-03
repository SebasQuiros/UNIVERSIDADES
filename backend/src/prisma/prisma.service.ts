import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Tamaño del pool de conexiones.
 *
 * Prisma, si no se le dice nada, usa (núcleos × 2 + 1). En un contenedor eso
 * suele dar ~9-21 conexiones, y el camino de reportes gasta varias a la vez
 * por estudiante: con un grupo entero mirando el balance el pool se agota y
 * los demás reciben "Timed out fetching a new connection from the connection
 * pool" — un 500 que no se parece en nada a su causa.
 *
 * Se fija explícitamente y se puede subir por variable de entorno sin tocar
 * código. Va contra el pooler de Supabase en modo transacción, que multiplexa:
 * estas no son conexiones directas a Postgres.
 *
 * Si la URL ya trae `connection_limit`, manda la URL y esto no hace nada.
 */
function conUrlDePool(url: string | undefined): string | undefined {
  if (!url || url.includes('connection_limit=')) return url;
  const limite  = process.env.DB_CONNECTION_LIMIT ?? '30';
  const espera  = process.env.DB_POOL_TIMEOUT     ?? '20';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=${limite}&pool_timeout=${espera}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: { db: { url: conUrlDePool(process.env.DATABASE_URL) } },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
      // Timeout de transacciones interactivas ampliado: el pooler de Supabase
      // (us-east-2) suma latencia por round-trip y operaciones pesadas como
      // emitir factura (asiento + inventario FIFO + COGS + espejo inter-company)
      // superaban el default de 5s → "Transaction already closed" (500).
      // 15s da margen amplio sin dejar conexiones colgadas de más.
      transactionOptions: { maxWait: 10000, timeout: 15000 },
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✓ Conectado a PostgreSQL via Prisma');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Desconectado de PostgreSQL');
  }
}
