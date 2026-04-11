# 2026-04-11 ctx-agent Route Decision + Trigger Support

## Goal
Improve subagent/agent-team activation frequency by adding an explicit one-shot route gate in `ctx-agent` and user-facing triggers that work across Codex/Claude/Gemini/OpenCode clients.

## Scope
- Add `ctx-agent` route controls (`auto|single|team|subagent`) for one-shot runs.
- Add prompt-level shortcuts (`/team`, `/subagent`, `/single`) so users can self-trigger agent workflows.
- Inject a routing checklist into context so planning steps explicitly decide whether to use team/subagent.
- Keep existing contextdb event/checkpoint flow unchanged.
- Add regression tests for route decision and dry-run trigger output.

## Implementation Steps
1. Extend `scripts/ctx-agent-core.mjs` argument parsing/validation for route flags.
2. Add route decision heuristics and explicit prompt trigger parser.
3. Add routed one-shot execution bridge to `node scripts/aios.mjs team|orchestrate`.
4. Inject router guidance into context packet handoff text.
5. Add tests in `scripts/tests/ctx-agent-core.test.mjs`.
6. Update `contextdb-autopilot` skill docs in `.codex` and `.claude`.

## Verification
- `node --test scripts/tests/ctx-agent-core.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs doctor --strict`
