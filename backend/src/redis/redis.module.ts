import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { REDIS_CLIENT } from './redis.constants';
import { ReportesCache } from './reportes-cache.service';

export { REDIS_CLIENT } from './redis.constants';

const redisLogger = new Logger('RedisModule');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const client = createClient({
          url,
          socket: {
            connectTimeout: 3000,
            // Redis es OPCIONAL: si no está disponible, nos rendimos tras 5
            // intentos en vez de reintentar para siempre (evita spam de logs y
            // no bloquea nada). Cache/rate-limit caen a memoria.
            reconnectStrategy: (retries) =>
              retries >= 5 ? false : Math.min(retries * 300, 2000),
          },
          // Si el cliente está cerrado, los comandos fallan rápido (los
          // consumidores ya hacen try/catch) en vez de encolarse indefinidamente.
          disableOfflineQueue: true,
        });

        let warned = false;
        client.on('error', (err: Error) => {
          if (!warned) {
            redisLogger.warn(
              `Redis no disponible — cache y rate-limit usarán memoria: ${err.message}`,
            );
            warned = true;
          }
        });

        // CLAVE: NO usar `await`. Conectar en segundo plano para NO bloquear el
        // arranque de la app cuando Redis no existe (modo Docker-free).
        client
          .connect()
          .then(() => redisLogger.log('✓ Conectado a Redis'))
          .catch(() => {
            /* ya avisado por el handler de error; la app sigue sin Redis */
          });

        return client;
      },
      inject: [ConfigService],
    },
    ReportesCache,
  ],
  exports: [REDIS_CLIENT, ReportesCache],
})
export class RedisModule {}
