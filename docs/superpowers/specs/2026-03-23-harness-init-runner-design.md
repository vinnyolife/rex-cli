# Harness Init Runner (Node) — Design (v1)

Date: 2026-03-23

## Problem

Teams repeatedly re-implement “long-running agent harness” scaffolding (runner, logs, checkpoints, safety gates) when starting new projects, even though the core workflow is reusable and described by:

- OpenAI Harness Engineering article (CN)
- Anthropic “Effective harnesses for long-running agents”

We want a reusable skill that lets code agents (Codex / Claude Code / Gemini / opencode) initialize the same harness layout inside any Node.js repository.

## Goals (v1)

- Provide a **portable Node.js harness runner** that shells out to different agent CLIs.
- Initialize a lightweight harness that is **not tied to AIOS repo layout** (`scripts/`, `memory/`, etc.).
- Keep runtime artifacts out of git by default via `./.harness/` + `.gitignore`.
- Allow a small set of common dependencies for config validation and ergonomics.
- **Always allow init**, even if the repo already has AIOS installed.

## Non-goals (v1)

- No browser automation / MCP integration as part of the harness runner.
- No hard dependency on vendor SDKs; runner uses CLI commands.
- No guarantee of “zero-config works everywhere”; provider commands remain configurable.

## Output Layout (in the target repo)

- `harness/` (code)
  - `run.mjs`: main runner entrypoint
  - `doctor.mjs`: validates provider commands are runnable
  - `config.schema.mjs`: `zod` schema + defaults
  - `providers/*`: provider adapters (`codex`, `claude`, `gemini`, `opencode`)
  - `lib/*`: run directory creation, IO capture, checkpoint writer, human-gate
- `harness.config.json` (repo root): provider command templates + parsing mode.
- `/.harness/` (repo root, gitignored): run artifacts per execution

Example run output directory:

- `./.harness/runs/<timestamp>-<provider>-<slug>/`
  - `prompt.md`, `stdout.txt`, `stderr.txt`
  - `run.json` (timings, cmd, exit code)
  - `result.json` (optional parse)
  - `checkpoint.md` / `checkpoint.json` (optional)

## Provider Model

To support multiple CLIs, each provider is defined by a minimal contract:

- `cmd` + `args[]` (with placeholders like `${promptFile}` / `${runDir}`)
- whether prompt is passed via `stdin` vs file args
- output mode `text | json` (json parse is best-effort and optional)

The harness runner:

1. Builds and stores a prompt (`prompt.md`).
2. Runs the provider command via `spawn`.
3. Captures stdout/stderr to files.
4. Writes `run.json` and optional `result.json`.
5. Writes a checkpoint artifact for human handoff (lightweight).

## Human Gate (v1)

Provide a minimal “human gate” check that can block execution unless the operator explicitly confirms risk, based on:

- boundary keywords (auth/payment/policy)
- sensitive command keywords in the task prompt

Gate is configurable and can be bypassed with an explicit flag, but defaults conservative.

## Skill Delivery

Create a new canonical skill source under `skill-sources/harness-init-runner/` and register it in `config/skills-sync-manifest.json` to generate:

- `.codex/skills/harness-init-runner`
- `.claude/skills/harness-init-runner`
- `.gemini/skills/harness-init-runner`
- `.opencode/skills/harness-init-runner`

The skill is template-driven: it includes `assets/template/*` files to copy into the target repo.

## Success Criteria

- Running the skill in a clean Node repo produces the files above.
- `npm install` then `npm run harness:doctor` works (or provides actionable diagnostics).
- `npm run harness:run -- --provider <x> --task "<...>"` produces a `./.harness/runs/...` directory with prompt and captured output.

