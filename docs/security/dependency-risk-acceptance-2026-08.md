# Temporary dependency risk acceptance — `image-size`

- **Recorded:** 2026-08-14
- **Owner:** NoorixFin maintainer (`SH4R1F-me`)
- **Expires:** 2026-09-14, or immediately when `image-size` 2.0.3 (or another
  upstream-fixed release) is published and accepted by the Expo/Metro graph
- **Advisories:** GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq
- **Severity:** High (availability)

## Decision

The remaining production audit finding is temporarily accepted for the mobile
build toolchain only. On 2026-08-14 the npm registry's `image-size` `latest` tag
is 2.0.2 and its `legacy` tag is 1.2.1, while the advisories name 2.0.3 as the
first patched version. There is therefore no published fixed package that can be
pinned today.

## Reachability and controls

The affected copies are transitive dependencies of Metro and Expo CLI. They are
used while inspecting repository assets during a mobile build; they are not
imported by the NestJS runtime, Next.js runtime, or mobile application bundle,
and NoorixFin has no endpoint that sends an uploaded user image through Metro.

Until the acceptance expires:

1. CI and release builds may process only reviewed assets committed to this
   repository. They must not build arbitrary pull-request assets from untrusted
   forks with secrets or privileged runners.
2. The dependency lockfile and supply-chain policy checks remain mandatory.
3. Dependency automation must alert on a fixed `image-size` or Expo/Metro
   release; the first compatible fix is upgraded without waiting for expiry.
4. Any new feature that routes untrusted ICNS, JXL, or HEIF content through the
   mobile build toolchain invalidates this acceptance immediately.

This acceptance does not downgrade the advisory. It documents why the affected
parser is not reachable from a NoorixFin production request and places a short,
explicit deadline on the exception.

`pnpm security:audit` and the required `Dependency risk policy` workflow permit
only these exact two advisory IDs and fail closed on 2026-09-15 UTC. Dependabot
checks the pnpm workspace, workflow actions, and containers every week. A new
moderate/high/critical advisory is never covered by this acceptance.
