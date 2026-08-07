/**
 * NoorixFin NestJS API — Bootstrap
 * Blueprint §7.1, §11.1, §16.2
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ─── URI Versioning (§11.1: /v1) ───────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ─── Global Validation Pipe (§11.1) ────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  // ─── CORS (§16.2: strict origins) ─────────────────────
  // The fallback is the WEB app's origin (3000), not this process's own port.
  // It previously read 3001 — the API's own port — so a checkout without
  // `.env.local` rejected every browser request from the web app, and the only
  // symptom was an opaque CORS failure in the devtools console.
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'Idempotency-Key',
      'If-Match',
    ],
    exposedHeaders: ['X-Request-ID', 'ETag'],
  });

  // ─── OpenAPI / Swagger (§11.1) ─────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NoorixFin API')
    .setDescription(
      'Personal and household finance management API. ' +
        'All financial amounts are minor-unit decimal strings. ' +
        'All timestamps are ISO 8601 UTC.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase access token',
      },
      'supabase-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // ─── Start ─────────────────────────────────────────────
  // 3001 is the documented contract (see .env.example and both clients'
  // API_URL defaults). The fallback was 3000, which collides with `next dev`.
  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`🚀 NoorixFin API running on http://localhost:${port}`);
  console.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
}
// `void`, not a bare call: an unhandled rejection here means the process
// started and then silently failed to listen, which looks like a hung deploy.
// The catch turns that into an exit code a supervisor can act on.
void bootstrap().catch((error) => {
  console.error('Failed to start NoorixFin API', error);
  process.exit(1);
});
