#!/usr/bin/env node
/**
 * Fail when the checked-in types no longer match the migrations.
 *
 * A generated types file that has drifted from the schema is WORSE than not
 * having one: the compiler keeps vouching for a shape the database stopped
 * having, so the errors it used to catch come back as runtime bugs while
 * everything still type-checks. This is the check that stops that.
 *
 * Regenerates against the local database and diffs. Requires `supabase start`
 * and a database at the head of the migrations — in CI that is a fresh
 * `supabase db reset`, so a migration merged without regenerating fails here.
 *
 * Usage:  pnpm --filter @noorixfin/db-types check:fresh
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const checkedIn = join(here, '..', 'src', 'database.types.ts');

let fresh;
try {
  fresh = execFileSync(
    'npx',
    ['supabase', 'gen', 'types', 'typescript', '--local', '--schema', 'public'],
    { cwd: join(here, '..', '..', '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
} catch (error) {
  console.error(
    '✗ Could not generate types. Is `supabase start` running and the database migrated?\n' +
      String(error.stderr ?? error.message),
  );
  process.exit(1);
}

const current = readFileSync(checkedIn, 'utf8');

// Normalised before comparing: the generator's trailing-newline behaviour has
// changed between CLI releases, and failing the build over that would train
// people to ignore this check.
const normalise = (text) => text.replace(/\r\n/g, '\n').trimEnd();

if (normalise(fresh) !== normalise(current)) {
  console.error(
    '\n✗ packages/db-types/src/database.types.ts is STALE.\n\n' +
      '  A migration changed the schema and the types were not regenerated, so\n' +
      '  the compiler is now vouching for a shape the database no longer has.\n\n' +
      '  Fix:  pnpm --filter @noorixfin/db-types generate\n',
  );
  process.exit(1);
}

console.log('✓ Database types match the migrations.');
