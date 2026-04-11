# 2026-04-11 Direct Codex Auto Route (Interactive)

## Goal
Make direct `codex` interactive sessions auto-consider and auto-trigger AIOS `team/subagent` execution without requiring manual user trigger commands.

## Scope
- `scripts/contextdb-shell-bridge.mjs`
- `scripts/ctx-agent-core.mjs`
- `scripts/tests/contextdb-shell-bridge-codex-home.test.mjs`
- `scripts/tests/ctx-agent-core.test.mjs`
- `README.md` + `README-zh.md`

## Plan
1. Seed default interactive auto prompt for wrapped `codex` sessions in shell bridge.
2. Ensure interactive `codex` path in `ctx-agent` consumes explicit auto prompt and appends it to injected context.
3. Strengthen `AIOS Task Router` guidance to default `live` route execution and no manual-trigger requirement.
4. Add regression tests for bridge prompt seeding and codex interactive prompt injection.
5. Verify with script tests + strict doctor.

## Verification Targets
- `node --test scripts/tests/contextdb-shell-bridge-codex-home.test.mjs`
- `node --test scripts/tests/ctx-agent-core.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs doctor --strict`
