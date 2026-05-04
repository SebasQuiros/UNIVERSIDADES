import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const redisLogger = new Logger('RedisModule');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const client = createClient({ url });
        client.on('error', (err: Error) => {
          redisLogger.warn(`Redis connection error — rate limiting will use in-memory storage: ${err.message}`);
        });
        try {
          await client.connect();
          redisLogger.log('✓ Conectado a Redis');
        } catch (err: any) {
          redisLogger.warn(`Redis no disponible (${err.message}) — el sistema continuará sin persistencia de sesión`);
        }
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
