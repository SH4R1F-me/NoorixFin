#!/usr/bin/env node
/**
 * Fail when the committed `tokens.css` no longer matches the TypeScript tokens.
 *
 * `tokens.css` is generated but **committed**, which needs justifying because
 * generated files in git usually rot. It is committed because `turbo dev` does
 * not run `build`, so a fresh clone starting the dev server would import a file
 * that does not exist yet and render the whole app unstyled — a confusing first
 * five minutes for a new contributor, in exchange for keeping one file out of
 * the tree.
 *
 * Committing it means it can go stale, which is what this prevents. Same
 * contract as `@noorixfin/db-types` and `@noorixfin/api-client`.
 *
 * Usage:  pnpm --filter @noorixfin/design-tokens check:fresh
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const committed = join(pkg, 'tokens.css');

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

// Compile first: comparing against a stale `dist/` would compare the committed
// CSS with an equally stale generator and pass while both were wrong.
try {
  execFileSync('npx', ['tsc'], { cwd: pkg, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
} catch (error) {
  console.error(red('✗ Tokens failed to compile.'));
  console.error(dim(String(error.stdout || error.stderr || error.message).trim()));
  process.exit(2);
}

const require = createRequire(import.meta.url);
const modulePath = join(pkg, 'dist', 'index.js');
delete require.cache[require.resolve(modulePath)];
const { toCssText } = require(modulePath);

const fresh = toCssText();
const onDisk = readFileSync(committed, 'utf8');

if (fresh !== onDisk) {
  console.error(red('✗ tokens.css is stale — it no longer matches the tokens.'));
  console.error(dim('\n  Regenerate and commit:'));
  console.error(dim('    pnpm --filter @noorixfin/design-tokens generate\n'));
  process.exit(1);
}

console.log(green('✓ tokens.css matches the design tokens.'));
