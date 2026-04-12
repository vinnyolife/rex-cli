# 2026-04-12 Snapshot Incident Recovery Docs

## Scope
- Complete Hermes-inspired follow-up item by documenting incident recovery workflow from pre-mutation snapshot artifacts.
- Provide operator-ready examples for both session-based and manifest-based restore.

## Implementation
1. Add README section `Incident Recovery (pre-mutation snapshots)` with:
   - prerequisite env toggle,
   - dry-run/apply commands by `--session` + `--job`,
   - explicit `--manifest` examples,
   - post-restore verification pointers.
2. Add dedicated runbook `docs/snapshot-incident-recovery.md` with:
   - use conditions,
   - two recovery paths,
   - verification checklist,
   - artifact anatomy and common failure cases.
3. Update `docs/hermes-inspired-capability-mapping.md` to mark the docs/examples item completed.

## Verification
- `node --test scripts/tests/aios-cli.test.mjs`
- `node --test scripts/tests/aios-orchestrator.test.mjs`

Results:
- Pass (`32/32`) for `scripts/tests/aios-cli.test.mjs`.
- Pass (`83/83`) for `scripts/tests/aios-orchestrator.test.mjs`.
