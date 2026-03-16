# Skills Doctor Override Warning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `doctorContextDbSkills` always report when a project-scoped skill and a global-scoped skill with the same name both exist for the same client.

**Architecture:** Keep the current scope-specific doctor behavior intact, then append a small override scan that compares project and global target paths for the filtered catalog entries. Treat override findings as warnings regardless of the requested scope.

**Tech Stack:** Node.js ESM, existing skills component, node:test, README docs

---

### Task 1: Add override warnings to skills doctor

**Files:**
- Modify: `scripts/lib/components/skills.mjs`
- Modify: `scripts/tests/skills-component.test.mjs`
- Modify: `README.md`
- Modify: `README-zh.md`

- [ ] **Step 1: Write the failing tests**

Add tests that verify:

```js
test('doctor warns about project overriding global even when scope=global', async () => {});
test('doctor warns about project overriding global even when scope=project', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test scripts/tests/skills-component.test.mjs
```

Expected: FAIL because override warnings are not emitted yet.

- [ ] **Step 3: Implement the minimal override scan**

Add a helper in `scripts/lib/components/skills.mjs` that:

- resolves both global and project target roots for the same client
- checks the filtered catalog entries only
- emits:

```text
[warn] codex: find-skills project install overrides global install
```

- [ ] **Step 4: Re-run the tests**

Run:

```bash
node --test scripts/tests/skills-component.test.mjs
```

Expected: PASS

- [ ] **Step 5: Update docs**

Add one short note to README and README-zh saying the skills doctor always reports project-overrides-global collisions regardless of selected scope.

- [ ] **Step 6: Run targeted verification**

Run:

```bash
node --test scripts/tests/skills-component.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: PASS
