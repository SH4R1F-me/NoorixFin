/**
 * NoorixFin NestJS API — Bootstrap
 * Blueprint §7.1, §11.1, §16.2
 */
import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import { AppModule } from './app.module';
import { ReadinessService } from './health/readiness.service';
import { buildOpenApiDocument } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Route-scoped parsers below keep ordinary JSON endpoints on Express's
    // small default while allowing the two authenticated 5 MB workflows.
    bodyParser: false,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.use(
    '/v1/workspaces/:workspaceId/import',
    // Escaping quotes and backslashes can nearly double UTF-8 statement JSON.
    json({ limit: '12mb' }),
  );
  app.use(
    '/v1/workspaces/:workspaceId/transactions/:id/attachments',
    // Base64 expands decoded bytes by roughly one third.
    json({ limit: '8mb' }),
  );
  app.use(
    '/v1/admin/site-settings/logo',
    // A 2 MB image expands to about 2.7 MB as base64 JSON. This route remains
    // operator-only and the service validates decoded size and magic bytes.
    json({ limit: '3mb' }),
  );
  app.use(json({ limit: '100kb' }));

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
      'X-Client-Info',
    ],
    exposedHeaders: ['X-Request-ID', 'ETag'],
  });

  // ─── OpenAPI / Swagger (§11.1) ─────────────────────────
  // Built in src/openapi.ts so the served document and the one the API client
  // is generated from cannot diverge.
  const document = buildOpenApiDocument(app);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // ─── Start ─────────────────────────────────────────────
  // 8080 is the single development, CI, and deployment contract. Keeping one
  // default prevents health checks and direct E2E calls from targeting a
  // different API than the applications under test.
  const port = process.env.API_PORT || 8080;
  await app.listen(port);
  console.log(`🚀 NoorixFin API running on http://localhost:${port}`);
  console.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);

  installGracefulShutdown(app);
}

/**
 * Graceful shutdown (audit gap R6).
 *
 * Two things were previously lost on every SIGTERM. `SystemEventsService`
 * buffers events and flushes them on a timer, flushing a final time in
 * `onModuleDestroy` — but that hook only runs if something calls `app.close()`,
 * and nothing did, so the last couple of seconds of events went missing on
 * exactly the restarts worth investigating. And in-flight requests were cut
 * mid-response, which on a write endpoint means a client that never learns
 * whether its request applied.
 *
 * The order below is the whole point:
 *
 *   1. Readiness flips to false → the next `GET /health/ready` returns 503.
 *   2. Wait, so the load balancer notices and stops sending new requests.
 *      The socket stays open and in-flight work keeps running.
 *   3. `app.close()` → lifecycle hooks run, the event buffer flushes.
 *
 * `enableShutdownHooks()` is deliberately NOT used: it installs its own signal
 * listeners that call `app.close()` immediately, which would race this handler
 * and skip the drain. Calling `app.close()` here runs the same hooks anyway —
 * that method has never needed the signal wiring to fire them.
 */
function installGracefulShutdown(app: INestApplication) {
  // Long enough for a typical readiness poll to observe the 503, short enough
  // not to hold up a deploy. Configurable because that interval is a property
  // of the platform, not of this process.
  const drainMs = Number(process.env.SHUTDOWN_DRAIN_MS ?? 5_000);
  // A shutdown that hangs is worse than an abrupt one: an orchestrator waits,
  // then SIGKILLs anyway, and the deploy stalls for the full grace period.
  const forceExitMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 25_000);

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    // A second Ctrl-C should not restart the sequence half way through.
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n${signal} received — draining for ${drainMs}ms`);

    const forceExit = setTimeout(() => {
      console.error('Shutdown exceeded its timeout — exiting immediately');
      process.exit(1);
    }, forceExitMs);
    // Do not let this timer be the only thing keeping the loop alive.
    forceExit.unref();

    void (async () => {
      try {
        const readiness = app.get(ReadinessService, { strict: false });
        readiness.onApplicationShutdown(signal);
      } catch {
        // Health module absent (unit tests boot partial graphs) — the drain
        // below is still correct, callers just see 200s a little longer.
      }

      await new Promise((resolve) => setTimeout(resolve, drainMs));
      await app.close();

      clearTimeout(forceExit);
      console.log('Shutdown complete');
      process.exit(0);
    })().catch((error) => {
      console.error('Shutdown failed', error);
      process.exit(1);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
// `void`, not a bare call: an unhandled rejection here means the process
// started and then silently failed to listen, which looks like a hung deploy.
// The catch turns that into an exit code a supervisor can act on.
void bootstrap().catch((error) => {
  console.error('Failed to start NoorixFin API', error);
  process.exit(1);
});
