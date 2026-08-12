#!/usr/bin/env node
/**
 * Emit `tokens.css` from the TypeScript tokens.
 *
 * Run after `build`, because it imports the compiled output — importing the
 * source would need a TypeScript loader in a script whose only job is to write
 * one file.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// CommonJS output (see tsconfig `module: CommonJS`), so `require`, not import.
const { toCssText } = require(join(here, '..', 'dist', 'index.js'));

const out = join(here, '..', 'tokens.css');
writeFileSync(out, toCssText());
console.log(`✓ ${out}`);
