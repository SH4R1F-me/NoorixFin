# Coverage policy

Coverage is a regression floor, not a quality score. CI runs API unit coverage
and rendered mobile coverage on every change; browser behavior, authorization,
database invariants, native-device acceptance, and recovery are enforced by
their dedicated suites rather than being hidden inside one percentage.

The API global floor preserves the measured baseline across the full Nest
source tree, including controllers and DTOs primarily exercised by application
boundary/E2E tests. Higher per-file floors protect the scale- and money-sensitive
sync, bounded export, transaction, and notification worker services. Mobile
coverage separately requires 70% lines/statements, 65% functions, and 55%
branches across the rendered sign-in and shared screen primitives.

Coverage floors may be raised whenever tests land. Lowering or excluding a
covered financial/security path requires an explicit pull-request explanation
and maintainer review. New critical services should receive a per-file floor in
the same change that introduces them.
