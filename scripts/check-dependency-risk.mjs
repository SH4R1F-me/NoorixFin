#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const accepted = new Set(['GHSA-w3rx-r6r6-pgpr', 'GHSA-5p2g-fcmc-qvqq']);
const acceptanceExpiresAt = Date.parse('2026-09-15T00:00:00.000Z');
const result = spawnSync('pnpm', ['audit', '--prod', '--audit-level', 'moderate', '--json'], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

if (result.status !== 0 && result.status !== 1) {
  console.error(result.stderr || 'pnpm audit could not complete');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('pnpm audit returned invalid JSON');
  process.exit(2);
}

const advisories = Object.values(report.advisories ?? {}).filter((advisory) =>
  ['moderate', 'high', 'critical'].includes(advisory.severity),
);
const unaccepted = advisories.filter((advisory) => !accepted.has(advisory.github_advisory_id));
const acceptedPresent = advisories.filter((advisory) => accepted.has(advisory.github_advisory_id));

if (unaccepted.length) {
  for (const advisory of unaccepted) {
    console.error(
      `Unaccepted ${advisory.severity} advisory: ${advisory.github_advisory_id} ${advisory.module_name}`,
    );
  }
  process.exit(1);
}

if (acceptedPresent.length && Date.now() >= acceptanceExpiresAt) {
  console.error(
    'The image-size risk acceptance expired on 2026-09-14. Upgrade or renew it through explicit review.',
  );
  process.exit(1);
}

if (acceptedPresent.length !== accepted.size && acceptedPresent.length !== 0) {
  console.error(
    'The dependency graph no longer matches the exact two-advisory acceptance; review it instead of silently widening the exception.',
  );
  process.exit(1);
}

console.log(
  acceptedPresent.length
    ? `Dependency policy passed with ${acceptedPresent.length} documented image-size advisories; acceptance expires 2026-09-14.`
    : 'Dependency policy passed with no moderate, high, or critical advisories.',
);
