# Skills Global Visibility Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make selected business and repo skills visible in both `global` and `project` pickers while keeping them unselected by default.

**Architecture:** Change only the catalog scope metadata for the affected skills, then verify through TUI render tests that the global picker can show those entries without auto-selecting them.

**Tech Stack:** JSON catalog, Node test runner, TUI render/state modules

---

### Task 1: Expand scope visibility in the catalog

**Files:**
- Modify: `config/skills-catalog.json`
- Modify: `scripts/tests/aios-tui-render.test.mjs`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the render test and verify failure**
- [ ] **Step 3: Change affected catalog entries from `["project"]` to `["global", "project"]`**
- [ ] **Step 4: Re-run the render test and verify pass**
