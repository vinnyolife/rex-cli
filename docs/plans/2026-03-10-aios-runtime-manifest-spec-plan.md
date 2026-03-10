# AIOS Runtime Manifest Spec Implementation Plan

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Externalize the dispatch runtime catalog into a declarative spec so the runtime boundary can scale to a second runtime without reshaping the registry contract.

**Architecture:** Mirror the existing executor-spec pattern. Add `memory/specs/orchestrator-runtimes.json`, load it in `orchestrator-runtimes.mjs`, keep execution logic in code, and expose additive `manifestVersion` metadata through runtime registry helpers.

**Tech Stack:** Node.js ESM, JSON import assertions, existing AIOS harness modules, Node test runner

---

### Task 1: Add failing tests for the runtime manifest contract

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

**Steps:**
1. Add a test that the runtime manifest spec file exists and includes `local-dry-run`.
2. Add a test that runtime registry results expose `manifestVersion`.
3. Run the targeted test file and confirm the new assertions fail for the expected reason.

### Task 2: Add the declarative runtime spec

**Files:**
- Add: `memory/specs/orchestrator-runtimes.json`

**Steps:**
1. Create schema version `1`.
2. Add the `local-dry-run` runtime entry with current metadata.
3. Keep the spec limited to stable metadata, not execution code.

### Task 3: Wire the runtime registry to the spec

**Files:**
- Modify: `scripts/lib/harness/orchestrator-runtimes.mjs`

**Steps:**
1. Import the runtime spec JSON.
2. Build the immutable runtime catalog from the spec.
3. Add `manifestVersion` to runtime metadata returned by registry helpers.
4. Keep runtime adapter execution code unchanged.
5. Re-run targeted tests.

### Task 4: Update docs and verify

**Files:**
- Modify: `docs/plans/2026-03-10-aios-runtime-adapter-boundary-design.md`
- Modify: `docs/plans/2026-03-10-aios-runtime-manifest-spec-design.md` only if implementation details shifted

**Steps:**
1. Note that runtime metadata now comes from a declarative spec.
2. Re-run:
   - `node --test scripts/tests/aios-orchestrator.test.mjs`
   - `npm run test:scripts`
   - `cd mcp-server && npm run typecheck && npm run build`
   - `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute dry-run --format json`
