import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  app.use(
    helmet({
      // Swagger UI is served from this origin and needs inline scripts/styles.
      // The browser-facing app lives on Vercel behind its own CSP; this process
      // only serves JSON and the docs page.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Query/path params arrive as strings; transform runs the @Type() casts.
      transform: true,
      // Silently drop unknown properties rather than trusting them.
      whitelist: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PitStop Ops API')
    .setDescription(
      [
        'Backend for the PitStop Ops live vehicle service dashboard.',
        '',
        'Every endpoint except `POST /api/auth/login` and `GET /api/health` requires a bearer token.',
        'Sign in with one of the seeded demo accounts to get one:',
        '',
        '- `admin@pitstop.dev` / `password123` — ADMIN, can change booking status',
        '- `ops@pitstop.dev` / `password123` — OPS, read-only',
        '',
        'Live updates are delivered over Socket.IO on the `/events` namespace, authenticated with the same token.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'PitStop Ops API',
  });

  const port = Number(config.get<string>('PORT', '3001'));
  // 0.0.0.0 rather than localhost: inside a container the port has to be
  // reachable from outside the container.
  await app.listen(port, '0.0.0.0');

  logger.log(`API listening on port ${port}`);
  logger.log(`Swagger UI at /api/docs`);
  logger.log(`CORS origins: ${origins.join(', ')}`);
}

void bootstrap();
