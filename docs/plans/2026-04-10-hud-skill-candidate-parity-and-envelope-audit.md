# 2026-04-10 HUD Skill-Candidate Parity and Envelope Audit

## Goal
Close remaining follow-ups from OpenClaw-RL handoff by delivering HUD/team status parity for skill-candidate operations and verifying interaction-envelope turn/work-item linkage.

## Scope
- Add HUD parity for skill-candidate detail mode and one-command patch-template export.
- Add `--draft-id` filtering across HUD/team status/history skill-candidate flows.
- Add dedicated `team skill-candidates export` command that exports patch templates without rendering HUD/team status views.
- Add orchestrate evidence tests covering turn/work-item envelope linkage between dispatch artifacts and ContextDB events.
- Re-run script-level verification and strict doctor checks.

## Implementation Steps
1. CLI surface update
   - `hud`: add `--skill-candidate-view`, `--export-skill-candidate-patch-template`, `--draft-id`.
   - `team status/history`: add `--draft-id`.
   - `team skill-candidates export`: add dedicated export action + parser.
2. Shared filtering behavior
   - Add skill-candidate draft-id filter helpers in HUD skill-candidate utility.
   - Apply filtered state for HUD/team status render, JSON output, patch export, and history record filtering.
3. HUD lifecycle parity
   - Support detail-only candidate rendering and patch-template artifact export in `runHud`.
4. Team export command
   - Add `runTeamSkillCandidatesExport` to export patch-template artifacts directly (with optional JSON output).
5. Interaction-envelope audit tests
   - Assert dispatch artifact job `turnId/workItemRefs/refs` enrichment.
   - Assert dispatch event turn envelope includes `turnId`, `workItemRefs`, and verification metadata.
6. Verification
   - `node --test scripts/tests/aios-cli.test.mjs scripts/tests/hud-state.test.mjs scripts/tests/aios-orchestrator.test.mjs`
   - `npm run test:scripts`
   - `node scripts/aios.mjs doctor --strict`

## Evidence
- New/updated tests pass for CLI, HUD/team status, orchestrator evidence linkage.
- Full script test suite and strict doctor pass.
