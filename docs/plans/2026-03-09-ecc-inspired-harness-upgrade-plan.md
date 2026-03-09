# ECC-Inspired Harness Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reusable harness layer to AIOS in the order `P0 -> P1 -> P2`, starting with profile controls, a quality gate, and a shared handoff schema.

**Architecture:** Keep the current `ContextDB + superpowers + browser MCP + aios` structure intact. Add a thin Node-first harness layer in `scripts/lib/harness/`, reuse existing doctor/build helpers, and introduce orchestration/telemetry only after the operator-control layer is stable.

**Tech Stack:** Node.js ESM, existing `scripts/lib/*` modules, `ContextDB`, built-in `node:test`, shell command wrappers, JSON schema.

---

### Task 1: Add the approved design artifacts

**Files:**
- Create: `docs/plans/2026-03-09-ecc-inspired-harness-upgrade-design.md`
- Create: `docs/plans/2026-03-09-ecc-inspired-harness-upgrade-plan.md`

**Step 1: Write the design document**

Document:

- why the current system is already strong,
- what ECC contributes conceptually,
- the `P0 -> P1 -> P2` sequence,
- success criteria and non-goals.

**Step 2: Write the implementation plan**

Document exact file targets and validation steps for each wave.

**Step 3: Sanity-check naming and ordering**

Confirm:

- `P0` only covers additive operator controls,
- `P1` depends on `P0` handoff schema,
- `P2` extends `ContextDB` instead of replacing it.

---

### Task 2: Implement P0 harness profiles

**Files:**
- Create: `scripts/lib/harness/profile.mjs`
- Modify: `scripts/lib/lifecycle/options.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/lib/lifecycle/doctor.mjs`
- Modify: `scripts/lib/doctor/aggregate.mjs`
- Test: `scripts/tests/aios-harness.test.mjs`

**Step 1: Write failing tests for profile parsing and gate behavior**

Cover:

- `minimal`, `standard`, `strict` normalization,
- disabled gate parsing,
- doctor command accepting `--profile`,
- gate enable/disable logic.

**Step 2: Run the harness test to verify it fails**

Run:

- `node --test scripts/tests/aios-harness.test.mjs`

Expected:

- FAIL because the harness profile module does not exist yet.

**Step 3: Implement harness profile helpers**

Add:

- profile normalization,
- env-driven defaults,
- disabled-gate parsing,
- per-gate enable checks.

**Step 4: Wire profiles into doctor flow**

Make `doctor` honor profile-level gate selection while preserving explicit strict-mode exit behavior.

**Step 5: Re-run the harness test**

Run:

- `node --test scripts/tests/aios-harness.test.mjs`

Expected:

- PASS.

---

### Task 3: Implement P0 quality gate

**Files:**
- Create: `scripts/lib/lifecycle/quality-gate.mjs`
- Modify: `scripts/aios.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/lifecycle/options.mjs`
- Test: `scripts/tests/aios-harness.test.mjs`

**Step 1: Write failing tests for quality-gate planning**

Cover:

- `quality-gate quick`,
- `quality-gate full`,
- `quality-gate pre-pr`,
- `--profile strict` parsing.

**Step 2: Run the harness test to verify it fails for the new command**

Run:

- `node --test scripts/tests/aios-harness.test.mjs`

Expected:

- FAIL because `quality-gate` is not yet a recognized command.

**Step 3: Implement the quality gate command**

Use existing command helpers to run:

- `mcp-server` typecheck/build,
- root script tests where appropriate,
- console log audit,
- security doctor in stricter modes,
- git status summary.

**Step 4: Print a stable report format**

The output should include:

- mode,
- profile,
- check status summary,
- overall pass/fail,
- PR readiness.

**Step 5: Re-run the harness test**

Run:

- `node --test scripts/tests/aios-harness.test.mjs`

Expected:

- PASS.

---

### Task 4: Implement P0 handoff schema

**Files:**
- Create: `scripts/lib/harness/handoff.mjs`
- Create: `memory/specs/agent-handoff.schema.json`
- Test: `scripts/tests/aios-harness.test.mjs`

**Step 1: Write failing tests for handoff validation and rendering**

Cover:

- required fields,
- list normalization,
- markdown rendering,
- invalid payload rejection.

**Step 2: Run the harness test to verify it fails**

Run:

- `node --test scripts/tests/aios-harness.test.mjs`

Expected:

- FAIL because the handoff module does not exist yet.

**Step 3: Implement the shared handoff helpers**

Provide:

- payload normalization,
- validation error reporting,
- markdown rendering for future subagent use.

**Step 4: Add the JSON schema artifact**

The spec should match the runtime helper fields exactly.

**Step 5: Re-run the harness test**

Run:

- `node --test scripts/tests/aios-harness.test.mjs`

Expected:

- PASS.

---

### Task 5: Prepare P1 orchestrator blueprints

**Files:**
- Create: `docs/plans/2026-03-09-aios-orchestrator-blueprints-design.md`
- Create: `memory/specs/orchestrator-blueprints.json`
- Modify: `AGENTS.md`

**Step 1: Define the blueprint set**

Include:

- `feature`,
- `bugfix`,
- `refactor`,
- `security`.

**Step 2: Define role cards and ownership rules**

Include:

- planner,
- implementer,
- reviewer,
- security-reviewer.

**Step 3: Define merge-gate behavior**

Specify:

- how outputs are merged,
- when work must stop,
- how shared-state edits are prevented.

---

### Task 6: Prepare P2 telemetry and learning extensions

**Files:**
- Create: `docs/plans/2026-03-09-contextdb-telemetry-design.md`
- Modify: `mcp-server/src/contextdb/cli.ts`
- Modify: `mcp-server/src/contextdb/core.ts`

**Step 1: Define the telemetry fields**

Include:

- verification result,
- retry count,
- failure category,
- elapsed time,
- optional cost metrics.

**Step 2: Define learn-eval promotion rules**

Only promote patterns that are:

- repeated,
- specific,
- actionable,
- non-redundant.

**Step 3: Define compatibility constraints**

Ensure the extended checkpoint format remains readable by current `context:pack` consumers.

---

### Task 7: Verify P0 implementation

**Files:**
- Modify: `package.json`
- Test: `scripts/tests/aios-harness.test.mjs`

**Step 1: Add the new harness test file to script validation**

Update `test:scripts` so the new harness tests run in the normal scripts test path.

**Step 2: Run targeted harness tests**

Run:

- `node --test scripts/tests/aios-harness.test.mjs`

Expected:

- PASS.

**Step 3: Run broader script validation**

Run:

- `npm run test:scripts`

Expected:

- PASS.

**Step 4: Run AIOS verification**

Run:

- `node scripts/aios.mjs doctor`
- `node scripts/aios.mjs quality-gate full`

Expected:

- both commands complete with stable operator-facing output.

---

Plan complete and saved to `docs/plans/2026-03-09-ecc-inspired-harness-upgrade-plan.md`.
