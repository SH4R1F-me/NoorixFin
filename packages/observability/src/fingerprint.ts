/**
 * Stable error fingerprints — the grouping the audit found missing (gap R1).
 *
 * `system_events` currently stores one row per occurrence, so a single bug that
 * fires ten thousand times reads as ten thousand unrelated problems and buries
 * the other nine. A fingerprint is the identity that lets an operator ask "how
 * many *distinct* things are broken?" and get a number they can act on.
 *
 * The hard part is that the obvious inputs are unstable:
 *
 *   · **Absolute paths** differ between a developer's machine, CI and the
 *     container, so the same bug fingerprints three ways.
 *   · **Line numbers** shift when anyone edits the file above the throw, so a
 *     cosmetic change silently splits a group in two and the count resets.
 *   · **Interpolated values** in messages ("workspace 7f3a… not found") make
 *     every occurrence unique, which is the failure mode this exists to fix —
 *     and on this codebase those values are financial identifiers.
 *
 * So: normalise the frames to repo-relative `file:function`, drop line and
 * column, collapse dependency frames, and scrub variable data out of the
 * message before hashing.
 */

/** Frames inside dependencies are noise: the bug is in the code that called them. */
const DEPENDENCY_FRAME = /node_modules|internal\/|node:/;

/**
 * Values that make an otherwise identical message unique. Order matters —
 * UUIDs before the generic hex rule, or the hex rule eats half a UUID and
 * leaves the dashes behind.
 */
const VARIABLE_PATTERNS: Array<[RegExp, string]> = [
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>'],
  [/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, '<timestamp>'],
  [/\b[0-9a-f]{16,}\b/gi, '<hash>'],
  [/"[^"]*"/g, '<str>'],
  [/'[^']*'/g, '<str>'],
  [/\b\d+\b/g, '<n>'],
];

/** Strip everything that varies between two occurrences of the same bug. */
export function normaliseMessage(message: string): string {
  let out = message;
  for (const [pattern, replacement] of VARIABLE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out.trim().slice(0, 300);
}

/**
 * Reduce a stack to the frames that identify the bug.
 *
 * Keeps at most `depth` application frames. More than a handful adds entropy
 * without adding identity: two calls into the same broken function from
 * different entry points are the same bug, and a deep stack would split them.
 */
export function normaliseStack(stack: string | undefined, depth = 5): string[] {
  if (!stack) return [];

  return stack
    .split('\n')
    .slice(1) // line 0 is the message, already handled separately
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .filter((line) => !DEPENDENCY_FRAME.test(line))
    .map((line) => {
      // "at Foo.bar (/abs/path/src/foo.ts:12:34)" → "src/foo.ts:Foo.bar"
      const match = /^at\s+(.+?)\s+\((.+?):\d+:\d+\)$/.exec(line);
      if (match?.[1] && match[2]) {
        return `${repoRelative(match[2])}:${match[1]}`;
      }
      // "at /abs/path/src/foo.ts:12:34" — an anonymous frame.
      const bare = /^at\s+(.+?):\d+:\d+$/.exec(line);
      return bare?.[1] ? repoRelative(bare[1]) : line;
    })
    .slice(0, depth);
}

/**
 * Trim an absolute path to something identical across machines.
 *
 * Anchors on the workspace's own directory names rather than a build-time
 * constant, so it works the same in a container, in CI and on a laptop without
 * anything having to tell it where the repo root is.
 */
function repoRelative(file: string): string {
  const cleaned = file.replace(/^file:\/\//, '');
  const match = /(?:^|\/)((?:apps|packages)\/[^/]+\/.*)$/.exec(cleaned);
  if (match?.[1]) return match[1];
  const parts = cleaned.split('/');
  return parts.slice(-2).join('/');
}

/**
 * A 16-hex-character fingerprint.
 *
 * FNV-1a rather than SHA-256 from `node:crypto`: this package is consumed by
 * React Native too, where `crypto` is not available without a polyfill, and a
 * grouping key is not a security boundary. Collisions merge two groups in a
 * log; they do not let anyone do anything.
 */
export function fingerprint(input: {
  name?: string;
  message?: string;
  stack?: string;
  /** Extra identity, e.g. the route — two different routes are two bugs. */
  context?: string;
}): string {
  const parts = [
    input.name ?? 'Error',
    normaliseMessage(input.message ?? ''),
    ...normaliseStack(input.stack),
    input.context ?? '',
  ];

  return fnv1a64(parts.join('|'));
}

/** 64-bit FNV-1a via two 32-bit halves — BigInt is slower and unavailable in some RN engines. */
function fnv1a64(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return (
    h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
  );
}
