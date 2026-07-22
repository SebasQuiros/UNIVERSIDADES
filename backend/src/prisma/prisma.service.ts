import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
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
