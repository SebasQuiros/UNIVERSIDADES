import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const compression  = require('compression');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helmet       = require('helmet');

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.use(compression());
  app.use(cookieParser());

  // Quita X-Powered-By: Express — no debe filtrar el stack del servidor.
  // Express lo agrega antes de helmet, así que hay que desactivarlo a nivel adaptador.
  (app.getHttpAdapter().getInstance() as any).disable('x-powered-by');

  // ── Security headers ───────────────────────────────────────────────────────
  // CSP explícita en producción. El backend solo sirve API JSON + Swagger UI;
  // por seguridad bloqueamos scripts inline excepto los que necesita Swagger.
  // Para el frontend Next.js, nginx ya aplica su propio CSP en producción.
  const isProd = process.env.NODE_ENV === 'production';
  app.use(helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'", "'unsafe-inline'"],   // Swagger UI bundle requiere inline
            styleSrc:    ["'self'", "'unsafe-inline'"],   // Swagger UI usa <style> inline
            imgSrc:      ["'self'", 'data:', 'blob:'],
            fontSrc:     ["'self'", 'data:'],
            connectSrc:  ["'self'"],
            frameAncestors: ["'none'"],                   // bloquea framing
            objectSrc:   ["'none'"],
            baseUri:     ["'self'"],
            formAction:  ["'self'"],
            upgradeInsecureRequests: [],
            // Report-only: el browser nos manda violaciones a este endpoint
            // sin bloquear (útil para detectar inyecciones en producción).
            reportUri:   ['/api/v1/security/csp-report'],
          },
        }
      : false, // dev: relajado para Swagger UI + hot reload
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    crossOriginEmbedderPolicy: isProd ? { policy: 'require-corp' } : false,
    // Headers explícitos siempre presentes:
    referrerPolicy:        { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions:   true,                          // X-Content-Type-Options: nosniff
    frameguard:            { action: 'deny' },            // X-Frame-Options: DENY
    xPoweredBy:            false,                         // oculta "X-Powered-By: Express"
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  }));

  // Permissions-Policy: deshabilita features del browser que no usamos.
  // Mitiga superficie de ataque en caso de XSS.
  app.use((_req: any, res: any, next: any) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    );
    next();
  });

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',').map(o => o.trim());

  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    methods:     'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,X-Requested-With',
  });

  app.useGlobalPipes(new ValidationPipe({
    transform:             true,
    whitelist:             true,
    forbidNonWhitelisted:  true,              // reject unknown fields globally
    transformOptions:      { enableImplicitConversion: true },
  }));

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api/v1');

  // ── Swagger / OpenAPI ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SJQA GROUP — API')
      .setDescription('API de la plataforma educativa de contabilidad y facturación electrónica costarricense')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('auth',            'Autenticación y OAuth')
      .addTag('users',           'Gestión de usuarios')
      .addTag('universities',    'Universidades')
      .addTag('courses',         'Cursos y matrículas')
      .addTag('exercises',       'Ejercicios académicos')
      .addTag('attempts',        'Intentos de ejercicios')
      .addTag('companies',       'Empresas virtuales')
      .addTag('invoices',        'Facturación electrónica')
      .addTag('journal',         'Diario contable')
      .addTag('ledger',          'Mayor general')
      .addTag('reports',         'Estados financieros')
      .addTag('tax-declarations','Declaraciones tributarias')
      .addTag('grading',         'Calificación')
      .addTag('tracking',        'Seguimiento de actividad')
      .addTag('notifications',   'Notificaciones')
      .addTag('ai',              'Asistente IA')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`📚 Swagger UI → http://0.0.0.0:${process.env.PORT || 3001}/api/docs`);
  }

  // ── Startup sanity checks ──────────────────────────────────────────────────
  if (!process.env.CORS_ORIGIN) {
    logger.warn('⚠️  CORS_ORIGIN no configurado — usando fallback http://localhost:3000');
  }
  if (!process.env.REDIS_URL) {
    logger.warn('⚠️  REDIS_URL no configurado — usando fallback redis://localhost:6379 (rate limiting no persistirá entre reinicios)');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('⚠️  ANTHROPIC_API_KEY no configurado — el asistente IA estará deshabilitado');
  }
  if (!process.env.SMTP_HOST) {
    logger.warn('⚠️  SMTP_HOST no configurado — los correos de bienvenida no se enviarán');
  }

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 SJQA GROUP Backend → http://0.0.0.0:${port}/api/v1`);
  logger.log(`📦 Entorno: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
