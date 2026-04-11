# 2026-04-11 Multi-Client Interactive Auto Route

## Goal
Extend interactive auto-route startup behavior to all supported wrappers (`codex`, `claude`, `gemini`, `opencode`) so agents can auto-select `single/subagent/team` and trigger AIOS route commands without manual user triggers.

## Scope
- `scripts/contextdb-shell-bridge.mjs`
- `scripts/ctx-agent-core.mjs`
- `scripts/tests/contextdb-shell-bridge-codex-home.test.mjs`
- `scripts/tests/ctx-agent-core.test.mjs`
- `README.md` + `README-zh.md`

## Plan
1. Make bridge-generated interactive auto prompts route-aware for all wrappers.
2. Add runtime-safe subagent client resolution (`codex-cli|claude-code|gemini-cli`) including `opencode` fallback.
3. Make `ctx-agent` interactive `gemini` consume `CTXDB_AUTO_PROMPT` similarly to codex/claude/opencode.
4. Keep one-shot routed execution stable by mapping unsupported route clients to supported subagent runtimes.
5. Add regression tests for multi-client prompt seeding and subagent client fallback.
6. Verify with focused tests plus full script suite and strict doctor.

## Verification
- `node --test scripts/tests/contextdb-shell-bridge-codex-home.test.mjs`
- `node --test scripts/tests/ctx-agent-core.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs doctor --strict`
