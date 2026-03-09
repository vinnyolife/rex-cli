# ContextDB Checkpoint Telemetry — Design

**Date:** 2026-03-09  
**Status:** Drafted

## Goal

Add structured checkpoint telemetry so AIOS can learn from execution quality instead of only storing free-text summaries.

## Scope

This design adds an additive telemetry payload to ContextDB checkpoints with these fields:

- verification result,
- retry count,
- failure category,
- elapsed time,
- optional cost metrics.

## Design Rules

- `l1-checkpoints.jsonl` remains the canonical source of truth.
- Telemetry is optional and additive. Older checkpoints stay valid.
- The SQLite sidecar mirrors telemetry for fast retrieval and later evaluation.
- Existing commands keep working without new flags.
- P2 in this slice is telemetry-first. Automatic learn-eval promotion stays for the next increment.

## Data Model

Each checkpoint may include:

- `telemetry.verification.result`: `unknown | passed | failed | partial`
- `telemetry.verification.evidence`: optional short evidence text
- `telemetry.retryCount`: non-negative integer
- `telemetry.failureCategory`: normalized short label
- `telemetry.elapsedMs`: non-negative integer
- `telemetry.cost.inputTokens|outputTokens|totalTokens|usd`: optional cost fields

## Runtime Behavior

- `contextdb checkpoint` accepts telemetry flags and persists them into JSONL plus SQLite.
- Packet and summary rendering surface telemetry when present.
- `ctx-agent-core` auto-checkpoints attach baseline telemetry so one-shot runs immediately emit elapsed time and coarse failure metadata.

## Non-Goals

- No scoring model in this slice.
- No automatic skill extraction in this slice.
- No breaking schema migration for older sessions.
