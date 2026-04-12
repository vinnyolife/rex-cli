# 2026-04-12 Snapshot Manifest CI Assertions

## Scope
- Complete Hermes optimization item 2 by adding CI-level assertions for pre-mutation snapshot manifest shape in live-runtime regression tests.
- Validate manifest schema-critical fields without changing runtime behavior.

## Implementation
1. Add `assertSnapshotManifestShape` helper in `scripts/tests/aios-orchestrator.test.mjs`.
2. Upgrade the live subagent snapshot regression test to assert:
   - `schemaVersion`, `kind`, `createdAt`, and identity fields (`sessionId`/`jobId`/`phaseId`/`role`).
   - `targets` array shape (`path`, `existed`, `type`) and path safety (`no absolute`, `no ..`).
   - `backupPath`/`manifestPath`/`restoreHint` coherence.
   - backup filesystem entries exist and match declared target type.

## Verification
- `node --test scripts/tests/aios-orchestrator.test.mjs`
- `node --test scripts/tests/aios-cli.test.mjs`

Results:
- Pass (`83/83`) for `scripts/tests/aios-orchestrator.test.mjs`.
- Pass (`32/32`) for `scripts/tests/aios-cli.test.mjs`.
