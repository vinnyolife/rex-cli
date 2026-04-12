# Snapshot Incident Recovery (Pre-Mutation Restore)

Date: 2026-04-12

This runbook restores workspace files from pre-mutation snapshot artifacts created by live subagent runs.

## When To Use

Use this when a live `orchestrate --execute live` phase writes incorrect edits and you need to restore the phase-owned paths captured before mutation.

## Prerequisite

Pre-mutation snapshots must be enabled before the live run:

```bash
export AIOS_SUBAGENT_PRE_MUTATION_SNAPSHOT=1
```

Without that env toggle, no snapshot artifact is written and rollback is unavailable.

## Recovery Path A: Session + Job (recommended)

1. Dry-run preview:

```bash
aios snapshot-rollback --session <session-id> --job phase.implement --dry-run
```

2. Apply restore:

```bash
aios snapshot-rollback --session <session-id> --job phase.implement
```

3. Optional machine-readable output:

```bash
aios snapshot-rollback --session <session-id> --job phase.implement --format json
```

Notes:
- `--job` is optional, but recommended when multiple pre-mutation artifacts exist in one session.
- The command auto-selects the newest matching `pre-mutation-*` manifest under session artifacts.

## Recovery Path B: Explicit Manifest

Use this when you already have the exact manifest path from artifacts.

```bash
# preview
aios snapshot-rollback --manifest memory/context-db/sessions/<session-id>/artifacts/pre-mutation-<stamp>-phase_implement/manifest.json --dry-run

# apply
aios snapshot-rollback --manifest memory/context-db/sessions/<session-id>/artifacts/pre-mutation-<stamp>-phase_implement/manifest.json
```

## Verification Checklist

After apply:

1. Confirm file state:

```bash
git status --short
```

2. Re-run focused checks for affected area (tests/lint/build as needed).

3. Optional orchestrate preflight check:

```bash
aios orchestrate --session <session-id> --preflight auto --format json
```

## Artifact Anatomy

Typical snapshot artifact layout:

```text
memory/context-db/sessions/<session-id>/artifacts/pre-mutation-<stamp>-<job-slug>/
  manifest.json
  backup/
```

`manifest.json` includes:
- `kind`: `orchestration.pre-mutation-snapshot`
- `targets`: relative workspace paths with `existed` + `type`
- `backupPath`: restore source root
- `rollbackHistory`: appended after each successful apply

## Failure Cases

- `No pre-mutation snapshot manifest found`: snapshot was not enabled, wrong session/job, or artifacts cleaned.
- `Snapshot backup is missing`: artifact corruption or partial cleanup; use another manifest candidate.
- `...escapes workspace root`: supplied path is unsafe or malformed.
