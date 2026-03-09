# ECC-Inspired Harness Upgrade — Design

**Date:** 2026-03-09  
**Status:** Approved

## Goal

Upgrade the current AIOS harness in three staged waves so the system becomes more controllable, more reusable under parallel execution, and better at learning from repeated work without abandoning the existing `ContextDB + superpowers + browser MCP` architecture.

The target sequence is:

1. **P0:** standardize operator controls,
2. **P1:** standardize orchestration,
3. **P2:** standardize telemetry and learning.

## Current Strengths

The repository already has the right core primitives:

- process routing and default execution guidance in `AGENTS.md`,
- durable task memory through `ContextDB`,
- browser automation via `browser_*` MCP tools,
- verification entrypoints through `aios doctor` and related doctor scripts,
- subagent dispatch capability through superpowers skills.

The main gap is not missing capability. The gap is that these capabilities are not yet packaged into a thin, reusable harness layer with profile controls, reusable handoffs, and operator-facing orchestration defaults.

## Problem Statement

Three recurring friction points remain:

1. **Automation intensity is not standardized.**
   The repo has strong checks, but no single switch like `minimal|standard|strict` to scale behavior up or down cleanly.

2. **Parallel execution is possible but not yet productized.**
   The project can dispatch parallel work, but still relies on ad hoc task decomposition instead of standard role cards, handoff payloads, and merge rules.

3. **Session knowledge is durable but under-observed.**
   `ContextDB` persists events and checkpoints, but it does not yet capture enough structured telemetry to support cost analysis, retry analysis, or automated skill extraction.

## Decision Summary

Adopt a staged harness-upgrade plan.

### P0: Operator Control Layer

Add a small harness layer that introduces:

- `AIOS_HARNESS_PROFILE=minimal|standard|strict`,
- opt-out gate suppression for specific checks,
- a reusable quality gate command/report,
- a shared handoff schema for agent-to-agent communication.

This stage should be additive and low-risk. No existing install/update/uninstall flow should be broken.

### P1: Orchestration Layer

Build a reusable orchestrator surface on top of the existing superpowers/subagent model.

This layer should define:

- workflow blueprints such as `feature`, `bugfix`, `refactor`, and `security`,
- reusable role cards such as `planner`, `implementer`, `reviewer`, and `security-reviewer`,
- merge gates for parallel outputs,
- standardized handoff payload generation.

P1 should consume the P0 handoff schema instead of inventing a new format.

### P2: Telemetry and Learning Layer

Extend `ContextDB` checkpointing and session summaries with structured telemetry so the harness can learn which flows are effective.

This layer should add:

- verification outcome metadata,
- retry/failure counters,
- wall-clock timing,
- cost/session summaries where available,
- a `learn-eval` path for turning high-quality repeated patterns into reusable skills or runbooks.

## Architecture

## 1. Harness Profiles

Create a small harness-profile module under `scripts/lib/harness/`.

Responsibilities:

- validate profile names,
- read profile state from CLI or environment,
- read disabled gate identifiers from environment,
- tell lifecycle commands whether a gate is enabled.

This mirrors the spirit of ECC hook profiles while staying compatible with AIOS's Node-first CLI.

## 2. Quality Gate Surface

Add a dedicated `quality-gate` command to `node scripts/aios.mjs`.

The command should support:

- `quick`
- `full`
- `pre-pr`

and print one stable operator-facing report.

The command should reuse existing repo validation building blocks where possible:

- `mcp-server` typecheck/build,
- root script tests,
- security doctor,
- console log audit,
- git working tree summary.

## 3. Handoff Schema

Create one shared handoff payload format for future orchestration.

The schema should capture:

- source role,
- target role,
- task title,
- context summary,
- findings,
- files touched,
- open questions,
- recommendations,
- handoff status.

The key design rule is: **handoff artifacts must be valid as both machine-readable input and human-readable review notes.**

## 4. Orchestrator Blueprints

P1 will add workflow templates that sit above the handoff schema. These blueprints should stay declarative and file-scoped, so new workflows can be added without rewriting runtime logic.

## 5. Telemetry Backfill

P2 will extend checkpoint writing instead of replacing it. The current `ContextDB` sequence remains canonical:

`init -> session -> event -> checkpoint -> context:pack`

Telemetry should therefore be attached to checkpoint summaries and metadata, not introduced as a separate persistence system.

## Risk Management

### Low-risk changes first

P0 is intentionally additive:

- new harness modules,
- new CLI command,
- small lifecycle option extensions,
- no breaking renames.

### Shared-state caution

P1 must not let parallel outputs overwrite user work or each other. Ownership and merge rules must be explicit before orchestrator workflows become the default path.

### Telemetry discipline

P2 must avoid storing noisy or redundant metrics. Only metrics that support operator decisions, retry analysis, or future learning should be persisted.

## Success Criteria

### P0 succeeds when:

- `aios doctor` supports harness profiles,
- `aios quality-gate` emits stable reports,
- a shared handoff schema exists in code and spec form,
- targeted tests cover the new harness helpers.

### P1 succeeds when:

- a standard workflow can spawn reusable role-based subagents,
- each phase emits a structured handoff,
- parallel outputs can be merged through one gate.

### P2 succeeds when:

- checkpoints carry useful telemetry,
- repeated failure patterns become visible,
- the repo has one disciplined path for extracting reusable knowledge.

## Non-Goals

- Replacing `ContextDB` with another memory system,
- Porting ECC commands/hook files verbatim,
- Introducing a plugin-only architecture,
- Reworking the browser MCP server during P0.
