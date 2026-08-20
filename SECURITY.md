# Security policy

## Supported versions

Security fixes are applied to the latest release and `main`. Self-hosters should
track release notes and upgrade promptly; older releases do not receive a
guaranteed maintenance window until the project publishes an LTS policy.

## Report a vulnerability privately

Use GitHub private vulnerability reporting for `SH4R1F-me/NoorixFin`:

`Security` → `Advisories` → `Report a vulnerability`

If that control is unavailable, contact the repository owner through the
security contact listed on the GitHub profile. Do not include production data,
credentials, access tokens, or financial records. Do not open a public issue.

Include the affected commit/version, prerequisites, impact, minimal
reproduction, and any suggested mitigation. You may use a pseudonym. The
maintainer will acknowledge receipt when available, assess severity, coordinate
a fix and disclosure date, and credit reporters who request it. No fixed
response or remediation SLA is promised by this volunteer project.

## Safe research

Research only systems and data you own or have explicit permission to test. Do
not perform denial of service, social engineering, persistence, data
exfiltration, or privacy-invasive testing. Stop after demonstrating the minimum
impact necessary and delete any inadvertently obtained data.

## Self-host operator responsibility

Operators own TLS termination, secret rotation, host patching, database and
storage backups, outbound provider credentials, monitoring, and access control.
The example environment contains public placeholder credentials and is never a
production secret source. Follow [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).
