# Core Skills Defaults Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default-select only core system skills while leaving non-core business and repo-specific skills unselected.

**Architecture:** Keep top-level components unchanged, and use `config/skills-catalog.json` as the single source of truth for default selected skills in the picker.

**Tech Stack:** JSON catalog, node:test, TUI render tests

---

### Task 1: Promote `skill-constraints` into the default core skill set

**Files:**
- Modify: `config/skills-catalog.json`
- Modify: `scripts/tests/aios-tui-render.test.mjs`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the render test and verify failure**
- [ ] **Step 3: Change the catalog defaultInstall flag**
- [ ] **Step 4: Re-run the test and verify pass**
