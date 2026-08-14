#!/usr/bin/env node
/**
 * Fail when the checked-in API types no longer match the API's routes.
 *
 * Same reasoning as `@noorixfin/db-types`' check of the same name: a generated
 * file that has drifted is worse than no generated file, because the compiler
 * keeps vouching for a shape the server stopped serving. The errors it used to
 * catch return as runtime bugs while everything still type-checks.
 *
 * Needs no database and no running API — `generate-openapi.ts` builds the
 * document by walking the Nest module graph, so this can run in the `static`
 * CI job alongside lint and typecheck.
 *
 * Usage:  pnpm --filter @noorixfin/api-client check:fresh
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const repo = join(pkg, '..', '..');

const committedSpec = join(pkg, 'openapi.json');
const committedTypes = join(pkg, 'src', 'schema.d.ts');

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300_000,
    ...opts,
  });
}

// ── 1. Is the committed spec still what the API produces? ────────────────
let freshSpec;
try {
  run('pnpm', ['--filter', '@noorixfin/api', 'openapi:generate'], { cwd: repo });
  freshSpec = readFileSync(committedSpec, 'utf8');
} catch (error) {
  console.error(red('✗ Could not generate the OpenAPI document.'));
  console.error(dim(String(error.stderr || error.message).trim()));
  process.exit(2);
}

// `openapi:generate` writes over the committed file, so compare against git's
// copy rather than a pre-read snapshot — that is the only version that
// represents "what was committed" once the generator has run.
let committedFromGit;
try {
  committedFromGit = run('git', ['show', 'HEAD:packages/api-client/openapi.json'], {
    cwd: repo,
  });
} catch {
  // Not yet committed (first run). Nothing to compare the spec against; the
  // type check below still applies.
  committedFromGit = null;
}

if (committedFromGit !== null && committedFromGit !== freshSpec) {
  console.error(red('✗ openapi.json is stale — the API has routes it does not describe.'));
  console.error(dim('\n  Regenerate and commit:'));
  console.error(dim('    pnpm --filter @noorixfin/api-client generate\n'));
  process.exit(1);
}

// ── 2. Do the committed types still match the spec? ──────────────────────
const scratch = join(mkdtempSync(join(tmpdir(), 'noorix-apitypes-')), 'schema.d.ts');
try {
  run('pnpm', ['exec', 'openapi-typescript', committedSpec, '-o', scratch], { cwd: pkg });
} catch (error) {
  console.error(red('✗ Type generation failed.'));
  console.error(dim(String(error.stderr || error.message).trim()));
  process.exit(2);
}

const fresh = readFileSync(scratch, 'utf8');
const checkedIn = readFileSync(committedTypes, 'utf8');

if (fresh !== checkedIn) {
  console.error(red('✗ src/schema.d.ts is stale — it no longer matches openapi.json.'));
  console.error(dim('\n  Regenerate and commit:'));
  console.error(dim('    pnpm --filter @noorixfin/api-client generate\n'));
  process.exit(1);
}

console.log(green('✓ API client types match the API.'));
