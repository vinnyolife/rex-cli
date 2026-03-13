# OpenCode ContextDB Wrapper Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `opencode` to the existing ContextDB shell wrapper/runtime flow so interactive startup auto-loads the context packet and auto-sends the handoff prompt, matching the current Claude behavior.

**Architecture:** Extend the existing `codex/claude/gemini` wrapper pipeline instead of creating a separate OpenCode path. Reuse `ctx-agent` for session resolution and context packing, map OpenCode one-shot and interactive invocation to its native CLI flags, and verify behavior with wrapper and runtime tests.

**Tech Stack:** Node.js ESM scripts, existing shell bridge/runtime modules, node:test.

---

### Task 1: Extend wrapper/bridge/runtime entrypoints for OpenCode

**Files:**
- Modify: `scripts/contextdb-shell.zsh`
- Modify: `scripts/contextdb-shell.ps1`
- Modify: `scripts/contextdb-shell-bridge.mjs`
- Modify: `scripts/ctx-agent-core.mjs`

- [x] Add `opencode()` shell wrappers alongside `codex()/claude()/gemini()`.
- [x] Extend bridge validation and usage text to accept `opencode` + `opencode-cli`.
- [x] Update `ctx-agent` agent validation and launch paths to support OpenCode.
- [x] Use native OpenCode commands: `opencode run [message..]` for one-shot and `opencode --prompt <message>` for interactive startup.

### Task 2: Add regression coverage

**Files:**
- Modify: `scripts/tests/contextdb-shell-bridge-codex-home.test.mjs`
- Modify: `scripts/tests/ctx-agent-core.test.mjs`

- [x] Add wrapper tests covering OpenCode bridge argument passthrough.
- [x] Add `ctx-agent` tests for OpenCode one-shot and interactive prompt injection.
- [x] Keep existing Claude/Codex/Gemini behavior unchanged.

### Task 3: Verify

**Files:**
- Update via CLI: `memory/context-db/*` if needed during manual verification

- [x] Run: `node --test scripts/tests/contextdb-shell-bridge-codex-home.test.mjs scripts/tests/ctx-agent-core.test.mjs scripts/tests/aios-components.test.mjs`
- [x] Run: `npm run test:scripts`
- [x] Manual smoke: launch `opencode` in this repo and confirm startup prints ContextDB metadata plus auto prompt enablement.

## Verification Notes

- `node --test scripts/tests/contextdb-shell-bridge-codex-home.test.mjs scripts/tests/ctx-agent-core.test.mjs scripts/tests/aios-components.test.mjs` passed with 36/36 tests green.
- `npm run test:scripts` passed with 140/140 tests green.
- Real interactive smoke via sourced `scripts/contextdb-shell.zsh` printed:
  - `Session: opencode-cli-20260313T015506-56ca38ee`
  - `Context packet: /Users/rex/cool.cnb/rex-ai-boot/memory/context-db/exports/opencode-cli-20260313T015506-56ca38ee-context.md`
  - `Auto prompt: enabled (context handoff via file)`
- Real one-shot smoke via `node scripts/ctx-agent.mjs --agent opencode-cli --prompt 'say only: OK' --no-bootstrap` returned `OK` and showed OpenCode read the exported context packet file.
