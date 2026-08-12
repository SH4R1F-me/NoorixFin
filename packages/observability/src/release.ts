/**
 * Release identity — who produced this error, from which build.
 *
 * Audit gap R1's first complaint: `system_events` records what happened but not
 * which build it happened in. Without that, "errors spiked at 14:00" cannot be
 * connected to "we deployed at 13:58", which is the single most useful question
 * an error feed answers.
 *
 * Deliberately env-driven and framework-free. The CI job that builds an image
 * knows the commit; the process does not, and asking it to shell out to `git`
 * at runtime would be both slow and wrong in a container that has no `.git`.
 */

export interface ReleaseInfo {
  /** Which app: 'api' | 'web' | 'mobile'. */
  service: string;
  /** Package version, e.g. '0.1.0'. */
  version: string;
  /** Short commit SHA, when the build injected one. */
  commit: string | null;
  /** 'development' | 'production' | 'test' | whatever the platform sets. */
  environment: string;
  /**
   * The single string an error tracker groups by, e.g. `api@0.1.0+3f2a1c9`.
   * Stable for a given build and different for the next one — which is the
   * whole requirement.
   */
  release: string;
}

/** Reads the standard variables, tolerating all of them being absent. */
export function resolveRelease(
  service: string,
  env: Record<string, string | undefined> = process.env,
): ReleaseInfo {
  const version = env.APP_VERSION ?? env.npm_package_version ?? '0.0.0';

  // The three names cover the platforms this is likely to run on without
  // needing a per-platform branch: Vercel, most CI images, and a manual build.
  const commitRaw =
    env.APP_COMMIT ?? env.VERCEL_GIT_COMMIT_SHA ?? env.GITHUB_SHA ?? null;
  const commit = commitRaw ? commitRaw.slice(0, 9) : null;

  const environment = env.APP_ENV ?? env.NODE_ENV ?? 'development';

  return {
    service,
    version,
    commit,
    environment,
    release: commit ? `${service}@${version}+${commit}` : `${service}@${version}`,
  };
}
