#!/usr/bin/env node
/**
 * Migration drift gate.
 *
 * Why this exists: on 2026-08-08 an audit found `00021_site_settings.sql`
 * committed to the repository but never applied to the local database. Nothing
 * failed loudly — `/admin/site-settings` simply queried tables that did not
 * exist, and the error surfaced three layers away from its cause. A developer
 * pulling that commit would have hit the same wall.
 *
 * Three distinct failures are caught here, and they need different messages
 * because they have different fixes:
 *
 *   1. UNAPPLIED  — the file is on disk, the database has not run it.
 *                   Fix: `supabase migration up --local`.
 *   2. ORPHANED   — the database has a migration the repository does not.
 *                   Usually a branch switch or a hand-run SQL file. Fix is a
 *                   judgement call, so this only warns unless --strict.
 *   3. UNTRACKED  — a `.sql` file the CLI does not recognise as a migration at
 *                   all, because its name does not match `<version>_<name>.sql`.
 *                   This is the quiet one: the file looks committed and
 *                   reviewed, and is silently never executed anywhere.
 *
 * Usage:
 *   node supabase/scripts/check-migration-drift.mjs                 # local stack
 *   node supabase/scripts/check-migration-drift.mjs --db-url <uri>  # any database
 *   node supabase/scripts/check-migration-drift.mjs --strict        # orphans fail too
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// The CLI's own convention. A file that does not match this is not a migration
// as far as `supabase` is concerned, however much it looks like one.
const MIGRATION_FILENAME = /^(\d+)_[A-Za-z0-9_-]+\.sql$/;

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const dbUrlIndex = argv.indexOf('--db-url');
const dbUrl = dbUrlIndex !== -1 ? argv[dbUrlIndex + 1] : null;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function listMigrations() {
  const args = ['supabase', 'migration', 'list', '--output-format', 'json'];
  args.push(...(dbUrl ? ['--db-url', dbUrl] : ['--local']));

  let stdout;
  try {
    stdout = execFileSync('npx', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
  } catch (error) {
    // A CLI that cannot reach the database is a different problem from drift,
    // and saying "drift detected" here would send someone down the wrong path.
    console.error(red('✗ Could not read migration state.'));
    console.error(dim(String(error.stderr || error.message).trim()));
    console.error(
      dim('\n  Is the local stack running?  npx supabase start'),
    );
    process.exit(2);
  }

  // The command prints progress lines before the payload, so take the last
  // line that parses as the object we expect rather than assuming line count.
  for (const line of stdout.trim().split('\n').reverse()) {
    if (!line.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(line);
      if (Array.isArray(parsed.migrations)) return parsed.migrations;
    } catch {
      // Not the payload line; keep looking.
    }
  }

  console.error(red('✗ Could not parse the migration list output.'));
  console.error(dim(stdout));
  process.exit(2);
}

const migrations = listMigrations();

const unapplied = migrations.filter((m) => m.local && !m.remote).map((m) => m.local);
const orphaned = migrations.filter((m) => m.remote && !m.local).map((m) => m.remote);
const applied = migrations.filter((m) => m.local && m.remote).length;

// Cross-check the directory itself. The CLI can only report on files it
// recognises, so a typo'd filename is invisible in the list above — which is
// exactly what makes it worth checking separately.
const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
const untracked = sqlFiles.filter((f) => !MIGRATION_FILENAME.test(f));
const knownVersions = new Set(migrations.map((m) => m.local).filter(Boolean));
const unlisted = sqlFiles
  .filter((f) => MIGRATION_FILENAME.test(f))
  .filter((f) => !knownVersions.has(f.match(MIGRATION_FILENAME)[1]));

let failed = false;

if (unapplied.length > 0) {
  failed = true;
  console.error(red(`✗ ${unapplied.length} migration(s) committed but NOT applied:`));
  for (const v of unapplied) console.error(red(`    ${v}`));
  console.error(dim('\n  Apply them:  npx supabase migration up --local\n'));
}

if (untracked.length > 0) {
  failed = true;
  console.error(red(`✗ ${untracked.length} .sql file(s) the CLI does not treat as migrations:`));
  for (const f of untracked) console.error(red(`    ${f}`));
  console.error(dim('\n  Expected `<version>_<name>.sql`, e.g. 00022_client_telemetry.sql.'));
  console.error(dim('  A file that does not match is never executed, anywhere.\n'));
}

if (unlisted.length > 0) {
  failed = true;
  console.error(red(`✗ ${unlisted.length} migration file(s) missing from the CLI's list:`));
  for (const f of unlisted) console.error(red(`    ${f}`));
  console.error(dim('\n  Usually a duplicate version number — the later one is shadowed.\n'));
}

if (orphaned.length > 0) {
  const say = strict ? red : yellow;
  if (strict) failed = true;
  console.error(say(`${strict ? '✗' : '⚠'} ${orphaned.length} migration(s) in the database but not the repository:`));
  for (const v of orphaned) console.error(say(`    ${v}`));
  console.error(
    dim(
      '\n  A branch switch or a hand-run file. Harmless locally; on a shared\n' +
        '  database it means someone applied SQL that was never reviewed.\n',
    ),
  );
}

if (failed) {
  console.error(red('Migration drift detected.'));
  process.exit(1);
}

console.log(
  green(`✓ No migration drift — ${applied} migration(s) on disk and all applied.`),
);
