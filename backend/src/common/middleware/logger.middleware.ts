import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const ms = Date.now() - start;

      // Redact sensitive routes
      const isSensitive = originalUrl.includes('/auth/');
      const logUrl = isSensitive ? originalUrl.split('?')[0] : originalUrl;

      const color =
        statusCode >= 500 ? '\x1b[31m' :
        statusCode >= 400 ? '\x1b[33m' :
        statusCode >= 300 ? '\x1b[36m' : '\x1b[32m';

      this.logger.log(
        `${color}${method} ${logUrl} ${statusCode}\x1b[0m +${ms}ms`,
      );
    });

    next();
  }
}
