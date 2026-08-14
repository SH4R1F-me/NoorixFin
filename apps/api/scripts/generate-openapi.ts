/**
 * Write the OpenAPI document to disk.
 *
 * `@noorixfin/api-client` generates from this file rather than from a running
 * server, so producing the client needs no database, no Supabase stack and no
 * free port — which is what lets CI check the committed client for drift on
 * every push instead of only when someone remembers.
 *
 * `NestFactory.create` is used **without** `listen()`: the document is built by
 * walking the module graph and its decorator metadata, and none of that needs
 * a socket. The app is closed immediately afterwards.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi';

const OUTPUT = join(__dirname, '..', '..', '..', 'packages', 'api-client', 'openapi.json');

async function main() {
  // Building decorator metadata does not contact Supabase, but constructing
  // the application graph still validates that these keys exist. Placeholder
  // values keep generation usable in a clean clone and the static CI job;
  // real runtime values always win because these are fallback-only.
  process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321';
  process.env.SUPABASE_ANON_KEY ??= 'openapi-generation-placeholder';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'openapi-generation-placeholder';
  process.env.SUPABASE_JWT_SECRET ??= 'openapi-generation-placeholder-32-bytes';

  // Errors and warnings only: booting the graph logs every mapped route, and
  // ~70 lines of noise before one line of output makes a failure hard to spot.
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

  // Must match main.ts, or paths in the document would lack their /v1 prefix
  // and every generated call would 404.
  app.enableVersioning({
    type: (await import('@nestjs/common')).VersioningType.URI,
    defaultVersion: '1',
  });

  await app.init();

  const document = buildOpenApiDocument(app);
  await app.close();

  mkdirSync(dirname(OUTPUT), { recursive: true });
  // Trailing newline and stable 2-space indent so the committed file produces
  // a readable diff when a route changes, rather than one enormous line.
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);

  const routes = Object.keys(document.paths ?? {}).length;
  console.log(`✓ OpenAPI written to ${OUTPUT} (${routes} paths)`);
}

main().catch((error) => {
  console.error('Failed to generate the OpenAPI document', error);
  process.exit(1);
});
