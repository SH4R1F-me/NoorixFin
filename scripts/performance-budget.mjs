#!/usr/bin/env node

const baseUrl = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:8080';
const path = process.env.PERF_PATH ?? '/v1/health/live';
const requestCount = readPositiveInteger('PERF_REQUESTS', 500);
const concurrency = Math.min(readPositiveInteger('PERF_CONCURRENCY', 20), requestCount);
const p95BudgetMs = readPositiveNumber('PERF_P95_MS', 100);
const p99BudgetMs = readPositiveNumber('PERF_P99_MS', 250);
const maxErrorRate = readRate('PERF_MAX_ERROR_RATE', 0);
const requestTimeoutMs = readPositiveNumber('PERF_TIMEOUT_MS', 5_000);
const endpoint = new URL(path, baseUrl).toString();
const headers = process.env.PERF_BEARER_TOKEN
  ? { authorization: `Bearer ${process.env.PERF_BEARER_TOKEN}` }
  : undefined;

// Warm connections/JIT before measuring. These requests are deliberately not
// included in the budget so a cold DNS lookup does not masquerade as steady
// application latency.
for (let index = 0; index < Math.min(20, concurrency); index += 1) {
  await request();
}

const latencies = [];
let failures = 0;
let nextIndex = 0;
const startedAt = performance.now();

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (nextIndex < requestCount) {
      nextIndex += 1;
      const result = await request();
      latencies.push(result.durationMs);
      if (!result.ok) failures += 1;
    }
  }),
);

const wallMs = performance.now() - startedAt;
latencies.sort((left, right) => left - right);
const p50 = percentile(latencies, 0.5);
const p95 = percentile(latencies, 0.95);
const p99 = percentile(latencies, 0.99);
const errorRate = failures / requestCount;
const throughput = requestCount / (wallMs / 1_000);

console.log(
  JSON.stringify(
    {
      endpoint,
      requests: requestCount,
      concurrency,
      failures,
      error_rate: Number(errorRate.toFixed(4)),
      requests_per_second: Number(throughput.toFixed(1)),
      latency_ms: {
        p50: Number(p50.toFixed(1)),
        p95: Number(p95.toFixed(1)),
        p99: Number(p99.toFixed(1)),
      },
      budgets: {
        p95_ms: p95BudgetMs,
        p99_ms: p99BudgetMs,
        max_error_rate: maxErrorRate,
      },
    },
    null,
    2,
  ),
);

if (p95 > p95BudgetMs || p99 > p99BudgetMs || errorRate > maxErrorRate) {
  console.error('Performance budget failed.');
  process.exitCode = 1;
}

async function request() {
  const before = performance.now();
  try {
    const response = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    await response.arrayBuffer();
    return { ok: response.ok, durationMs: performance.now() - before };
  } catch {
    return { ok: false, durationMs: performance.now() - before };
  }
}

function percentile(sorted, quantile) {
  if (!sorted.length) return Number.POSITIVE_INFINITY;
  return sorted[Math.min(Math.ceil(sorted.length * quantile) - 1, sorted.length - 1)];
}

function readPositiveInteger(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
}

function readPositiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

function readRate(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new Error(`${name} must be between 0 and 1`);
  return value;
}
