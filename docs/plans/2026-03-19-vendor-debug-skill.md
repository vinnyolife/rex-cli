# Vendor `debug` Skill (JUNERDD/skills) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor the upstream `JUNERDD/skills` `debug` skill into this repo’s canonical `skill-sources/` so it appears in the `aios` TUI skill picker and can be installed via the normal catalog flow.

**Architecture:** Copy upstream `skills/debug/` into `skill-sources/debug/` with license + upstream provenance, register it in `config/skills-sync-manifest.json` and `config/skills-catalog.json`, then run `node scripts/sync-skills.mjs` to regenerate repo-local skill surfaces (`.codex/skills`, `.claude/skills`, etc.).

**Tech Stack:** Skills system (`skill-sources/` + sync manifest), `aios` skill catalog (`config/skills-catalog.json`), Node.js sync scripts, Python 3 (for the bundled local log collector).

---

### Task 1: Vendor upstream skill source

**Files:**
- Create: `skill-sources/debug/`

- [ ] **Step 1: Copy upstream subtree**
  - Source repo: `https://github.com/JUNERDD/skills`
  - Subtree: `skills/debug/`
  - Ensure no `__pycache__/` or `*.pyc` are included.

- [ ] **Step 2: Preserve license + provenance**
  - Copy upstream MIT license into `skill-sources/debug/LICENSE`.
  - Record source commit SHA + repo URL in `skill-sources/debug/UPSTREAM.md`.

### Task 2: Register for sync + catalog (TUI visibility)

**Files:**
- Modify: `config/skills-sync-manifest.json`
- Modify: `config/skills-catalog.json`

- [ ] **Step 1: Add to skills sync manifest**
  - Add entry for `relativeSkillPath: "debug"` with `repoTargets` covering `codex`, `claude`, `gemini`, `opencode`, `agents`.

- [ ] **Step 2: Add to skills catalog**
  - Add catalog entry `name: "debug"` pointing at `source: "skill-sources/debug"`.
  - Keep `defaultInstall.global=false` by default to avoid changing existing defaults.

### Task 3: Regenerate repo-local skill surfaces

**Files:**
- Generated: `.codex/skills/debug/`, `.claude/skills/debug/`, `.gemini/skills/debug/`, `.opencode/skills/debug/`, `.agents/skills/debug/`

- [ ] **Step 1: Run sync**
  - Run: `node scripts/sync-skills.mjs`
  - Expected: `installed=1` on each surface.

- [ ] **Step 2: Sanity-check outputs**
  - Verify `SKILL.md` exists under `.codex/skills/debug/`.
  - Run: `jq . config/skills-sync-manifest.json` and `jq . config/skills-catalog.json`.

### Task 4: Document the new skill in the TUI flow

**Files:**
- Modify: `README.md`
- Modify: `README-zh.md`

- [ ] **Step 1: Add a short TUI tip**
  - Mention that `debug` is available in the skill picker for evidence-first runtime debugging.

