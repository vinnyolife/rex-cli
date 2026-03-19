# tmp session follow-up Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Review the latest `dispatch-run` artifact for session `codex-cli-20260303T080437-065e16c0`, re-run `learn-eval` telemetry, and write a fresh ContextDB checkpoint/context packet for human handoff.

**Architecture:** Treat this as an observability + verification pass (read artifacts, run telemetry commands, summarize deltas). Only make code changes if a concrete gap is confirmed and can be validated locally.

**Tech Stack:** Node.js scripts in `scripts/`, ContextDB CLI (`npm run contextdb`), JSON artifact inspection.

---

### Task 1: Review latest dispatch-run artifact

**Files:**
- Read: `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/dispatch-run-20260316T111419Z.json`

- [ ] **Step 1: Open and summarize key fields**
  - Identify: `blueprint`, `executors`, `jobs` count, `blocked` count, `finalOutputs`, any `needs-input`/`human-gate` signals.

- [ ] **Step 2: Cross-check with timeline events**
  - If needed, pull the last ~30 session events to confirm which phase(s) were blocked/ready.

### Task 2: Run learn-eval / telemetry checks

**Files:**
- Read/Run: `scripts/aios.mjs` (or the repo’s canonical telemetry entrypoint)

- [ ] **Step 1: Locate the correct learn-eval command**
  - Use ripgrep to find `learn-eval` / telemetry commands and confirm the expected flags.

- [ ] **Step 2: Run learn-eval and capture current averages**
  - Record: `avgElapsedMs`, token/cost fields if present, and any recommendations (e.g. `latency-watch`).

### Task 3: Produce concise “what changed / what to do next”

**Files:**
- Create/Modify: (none required unless a concrete bug/defect is identified)

- [ ] **Step 1: Write a short findings summary**
  - Focus on: whether `blocked` is now 0, whether `needs-input` is still present, and whether human gate triggers persist.

- [ ] **Step 2: Propose next actions**
  - Examples: adjust harness thresholds, refine work-item prompts, update runbook, or document remaining open issues.

### Task 4: Persist new ContextDB checkpoint + context packet

**Files:**
- Write: `memory/context-db/exports/<session_id>-context.md` (via `npm run contextdb -- context:pack`)

- [ ] **Step 1: Export a fresh context packet**
  - Prefer: `cd mcp-server && npm run contextdb -- context:pack --session codex-cli-20260303T080437-065e16c0 --limit 60 --token-budget 2000 --kinds prompt,response,error --refs scripts/lib/harness/orchestrator.mjs,scripts/lib/harness/subagent-runtime.mjs`

- [ ] **Step 2: Verify artifact and export exist**
  - Confirm the new export timestamp and that it includes the latest dispatch-run artifact reference.

