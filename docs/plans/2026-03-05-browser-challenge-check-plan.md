# Browser Challenge Check Implementation Plan

Date: 2026-03-05

## Goal

Add a safe, testable MCP capability that detects anti-bot challenges (Cloudflare/Google risk/captcha) and returns explicit human-handoff guidance instead of attempting bypass behavior.

## Scope

- `mcp-server/src/browser/auth.ts`
- `mcp-server/src/browser/actions/challenge-check.ts` (new)
- `mcp-server/src/browser/index.ts`
- `mcp-server/src/index.ts`
- `mcp-server/tests/browser-auth.test.ts` (new)
- `mcp-server/README.md`

## Design

1. Extend browser risk detection in `auth.ts`:
   - Add `detectChallengeRequired(page)` for Cloudflare/Google/captcha signals.
   - Keep existing `detectAuthRequired(page)` behavior intact.
   - Include structured fields: `challengeDetected`, `challengeType`, `signals`, `humanActionHint`, `recommendedPath`.

2. Expose a dedicated MCP tool:
   - Add `browser_challenge_check` that returns challenge assessment for current page/profile.

3. Improve auth tool output:
   - Make `browser_auth_check` also include challenge summary and unified `requiresHumanAction`.

4. Verification:
   - TDD: write failing unit tests for challenge classification and hints first.
   - Run `npm run typecheck`, targeted tests, and `npm run build` under `mcp-server/`.
