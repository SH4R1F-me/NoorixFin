# Release artifact verification

Tag builds and manually dispatched release builds produce a source archive, an
SPDX JSON SBOM, and `SHA256SUMS`. GitHub Actions signs build-provenance and SBOM
attestations through Sigstore using the workflow's short-lived OIDC identity;
there is no long-lived signing key in repository secrets.

After downloading a release bundle, verify its bytes and its repository/build
identity:

```sh
sha256sum --check SHA256SUMS
gh attestation verify noorixfin-COMMIT_SHA.tar.gz \
  --repo SH4R1F-me/NoorixFin
gh attestation verify noorixfin-COMMIT_SHA.tar.gz \
  --repo SH4R1F-me/NoorixFin \
  --predicate-type https://spdx.dev/Document/v2.3
```

Reject an archive if either checksum or attestation verification fails, if the
workflow identity is not this repository, or if its commit is not the intended
release. Artifact attestations prove origin and build identity; they do not
replace vulnerability review or runtime hardening.
