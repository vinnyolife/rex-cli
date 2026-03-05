---
title: Overview
description: Upgrade your existing Codex/Claude/Gemini workflow with OpenClaw-style capabilities.
---

# RexCLI

> Keep your current CLI workflow. Add OpenClaw-style capabilities on top of `codex`, `claude`, and `gemini`.

[Start in 30 seconds (Primary CTA)](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="hero" data-rex-target="quick_start" }
[See Capability Cases](case-library.md){ .md-button data-rex-track="cta_click" data-rex-location="hero" data-rex-target="case_library" }

Project URL: <https://github.com/rexleimo/rex-cli>

`RexCLI` is a local-first workflow layer for four CLI agents:

- Codex CLI
- Claude Code
- Gemini CLI
- OpenCode

It adds two practical capabilities without replacing native CLIs:

1. **Filesystem ContextDB** for resumable memory across sessions.
2. **Unified wrapper flow** so you still run `codex`, `claude`, or `gemini` directly.

## What RexCLI Delivers for Ops Funnels

### 1. Landing conversion path optimization (from visits to clicks)

- Typical input: current landing URL, target audience, one primary action.
- Core actions: identify message drop-off, consolidate CTA focus, rewrite hero/problem/proof/action blocks.
- Standard deliverables: production-ready copy blocks, CTA placement map, event naming sheet.
- Success metrics: primary CTA CTR and case-library entry rate become trackable and continuously improvable.

### 2. Capability narrative redesign (understandable in 10 seconds)

- Typical input: current services, strongest cases, explicit boundaries.
- Core actions: convert generic claims into clear "problem -> action -> output" statements.
- Standard deliverables: capability matrix, audience-fit section, prioritized skill list.
- Success metrics: lower confusion and higher qualified clicks from hero to next step.

### 3. Multi-CLI handoff stabilization with ContextDB

- Typical input: existing Codex/Claude/Gemini flow and common handoff failures.
- Core actions: define checkpoint granularity, memory handoff rules, one-shot and interactive flows.
- Standard deliverables: handoff command set, restart templates, cross-session workflow baseline.
- Success metrics: less repeated background explanation after tool switching or session restart.

### 4. Reusable skills packaging for team operations

- Typical input: weekly recurring tasks and current manual process.
- Core actions: decompose workflows, add guardrails and verification gates, encode reusable skills.
- Standard deliverables: skill documentation, execution checklists, pre-delivery verification criteria.
- Success metrics: faster onboarding and more consistent team output quality.

## High-Use Reusable Skills

- `seo-geo-page-optimization`: for landing structure, copy, and SEO/Geo conversion optimization.
- `xhs-ops-methods`: for end-to-end Xiaohongshu growth operations.
- `brainstorming`: for locking intent and design direction before implementation.
- `writing-plans`: for turning multi-step requirements into executable plans.
- `dispatching-parallel-agents`: for safe parallel execution across independent domains.
- `systematic-debugging`: for evidence-based debugging instead of guesswork.
- `verification-before-completion`: for mandatory verification before completion claims.

## Why this is an OpenClaw-style upgrade

You get the same category of outcomes:

- resumable cross-session memory (ContextDB)
- browser automation (Playwright MCP)
- multi-CLI handoff across Codex/Claude/Gemini/OpenCode
- reusable operational skills

This is not a new chat shell. It is an upgrade layer for tools you already use.

## Start in 30 seconds (use first, read later)

```bash
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## Immediate before/after

| Scenario | Typical CLI | With RexCLI |
|---|---|---|
| Session resume | manual recall | automatic project context |
| Multi-CLI collaboration | state loss between tools | shared ContextDB handoff |
| Browser operations | manual clicking | `browser_*` automation |
| Process reuse | ad-hoc chat history | reusable skills |

## Quick Command Preview

```bash
# interactive mode (same commands, context injected automatically)
codex
claude
gemini

# one-shot mode (full 5-step pipeline)
scripts/ctx-agent.sh --agent codex-cli --prompt "Continue from latest checkpoint"
```

## Read Next

- [Quick Start](getting-started.md)
- [Case Library](case-library.md)
- [Blog Site](https://cli.rexai.top/blog/)
- [Friends](friends.md)
- [Project (GitHub)](https://github.com/rexleimo/rex-cli)
- [Changelog](changelog.md)
- [CLI Workflows](use-cases.md)
- [Architecture](architecture.md)
- [ContextDB runtime details](contextdb.md)
