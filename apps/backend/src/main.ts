import { API_PREFIX } from '@finance/contracts';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { writeFileSync } from 'node:fs';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { LoggingInterceptor } from './common/logging.interceptor';
import type { EnvConfig } from './config/env';
import { parseCorsOrigins } from './config/env';

/** Strip the leading slash: Nest wants `api/v1`, the contract exposes `/api/v1`. */
const GLOBAL_PREFIX = API_PREFIX.replace(/^\//, '');

export function buildOpenApiDocument(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('My Finance App API')
    .setDescription(
      [
        'API do gerenciador financeiro pessoal (V1).',
        '',
        '- Todas as rotas ficam sob `/api/v1`.',
        '- Toda listagem retorna o envelope `{ data, meta }` — nunca um array puro.',
        '- Datas civis (`date`, `realDate`, `buyDate`, `deadline`) usam `YYYY-MM-DD` sem fuso.',
        '- Valores monetários são números JSON com 2 casas decimais.',
        '- Erros seguem sempre `{ statusCode, error, message, details?, timestamp, path, requestId }`.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addCookieAuth('refresh_token', { type: 'apiKey', in: 'cookie' }, 'refresh-cookie')
    .addServer(API_PREFIX)
    .build();
  return SwaggerModule.createDocument(app, config);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<EnvConfig, true>);
  const logger = new Logger('Bootstrap');

  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const origins = parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true }));
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 600,
  });

  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: ['health/live', 'health/ready'] });

  if (config.get('ENABLE_SWAGGER', { infer: true })) {
    const document = buildOpenApiDocument(app);
    SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    if (process.env.OPENAPI_OUT) {
      writeFileSync(process.env.OPENAPI_OUT, JSON.stringify(document, null, 2));
      logger.log(`OpenAPI document written to ${process.env.OPENAPI_OUT}`);
    }
  }

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  logger.log(`API on http://localhost:${port}${API_PREFIX} (timezone ${config.get('APP_TIMEZONE', { infer: true })})`);
  logger.log(`Liveness: http://localhost:${port}/health/live`);
}

// Ignored when the module is imported by tooling (e.g. the OpenAPI dump script).
if (require.main === module) {
  bootstrap().catch((error) => {
    // Config/boot failures must be loud and must not start a half-working API.
    new Logger('Bootstrap').error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { bootstrap };
