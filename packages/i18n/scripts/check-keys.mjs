#!/usr/bin/env node
/**
 * Locale parity gate.
 *
 * `package.json` has referenced `check:keys` since the package was created, but
 * the script did not exist — so "parity verified by script each session"
 * (TEST_RESULTS, I18N-01) was never actually enforced by anything.
 *
 * Fails the build when:
 *   1. a key exists in one language and not the other — half the users would see
 *      the raw key, or silently fall back to English;
 *   2. a translation is empty or still identical to a placeholder;
 *   3. `{{placeholders}}` differ between languages — an interpolated value that
 *      renders in English and vanishes in Bangla is a data-loss bug, not a
 *      cosmetic one.
 *
 * Usage:  node scripts/check-keys.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, '..', 'locales');

const REFERENCE = 'en';

function flatten(object, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

const placeholders = (text) =>
  [...String(text).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');

const languages = readdirSync(localesDir).filter((entry) =>
  readdirSync(join(localesDir, entry)).length > 0,
);
const namespaces = readdirSync(join(localesDir, REFERENCE)).map((f) =>
  f.replace(/\.json$/, ''),
);

const problems = [];
let checked = 0;

for (const namespace of namespaces) {
  const catalogs = {};
  for (const language of languages) {
    const path = join(localesDir, language, `${namespace}.json`);
    catalogs[language] = flatten(JSON.parse(readFileSync(path, 'utf8')));
  }

  const reference = catalogs[REFERENCE];

  for (const language of languages) {
    const catalog = catalogs[language];

    for (const key of Object.keys(reference)) {
      checked += 1;
      if (!(key in catalog)) {
        problems.push(`${language}/${namespace}: MISSING  ${key}`);
        continue;
      }
      const value = catalog[key];
      if (typeof value !== 'string' || value.trim() === '') {
        problems.push(`${language}/${namespace}: EMPTY    ${key}`);
        continue;
      }
      if (placeholders(value) !== placeholders(reference[key])) {
        problems.push(
          `${language}/${namespace}: PLACEHOLDER MISMATCH ${key} ` +
            `(${REFERENCE}: {{${placeholders(reference[key])}}} vs ${language}: {{${placeholders(value)}}})`,
        );
      }
    }

    for (const key of Object.keys(catalog)) {
      if (!(key in reference)) {
        // Not merely untidy: `fallbackLng` is English, so a key that exists only
        // in Bangla renders as its own name for every English reader.
        problems.push(`${language}/${namespace}: EXTRA    ${key} (not in ${REFERENCE})`);
      }
    }
  }
}

const total = Object.keys(
  flatten(JSON.parse(readFileSync(join(localesDir, REFERENCE, 'common.json'), 'utf8'))),
).length;

if (problems.length > 0) {
  console.error(`\n✗ Locale parity FAILED — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`   ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ Locale parity OK — ${languages.join(', ')} across ${namespaces.join(', ')}; ` +
    `${checked} key checks, ${total} keys in common.`,
);
