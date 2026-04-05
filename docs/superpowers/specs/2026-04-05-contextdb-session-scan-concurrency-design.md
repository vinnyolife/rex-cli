# ContextDB Session Scan Concurrency Design

Date: 2026-04-05

## Goal

Speed up HUD + team ops commands that scan ContextDB sessions by making `listContextDbSessions()` read `meta.json` files concurrently with a safe concurrency cap.

Targets that benefit:
- `hud` session selection (`selectHudSessionId` → `listContextDbSessions`)
- `team history` initial session listing (`runTeamHistory` → `listContextDbSessions`)

## Constraints

- No ContextDB schema migrations.
- Preserve output shape and sorting semantics.
- Keep behavior deterministic (sort order defined by `updatedAt` comparison as today).
- Avoid runaway file descriptor usage (bounded concurrency).

## Current Behavior

`scripts/lib/hud/state.mjs:listContextDbSessions()`:
- `readdir()` sessions root
- loops directories and `await safeReadJson(meta.json)` sequentially
- filters by agent (optional)
- sorts by `updatedAt` desc
- returns the first `limit`

Sequential per-session `readFile + JSON.parse` becomes slow on large session trees.

## Design

### Concurrency

Read `meta.json` with bounded concurrency:
- Default concurrency: `8`
- Clamp to `1..32`

Implementation approach:
- Build a list of candidate session directories first.
- Use a small promise pool (`mapWithConcurrency`) to read + normalize meta entries in parallel.
- Filter out null/invalid metas, apply agent filter, compute `updatedAt`.
- Preserve current scan limiter: keep the existing “avoid unbounded scans” guard (`max * 4` directories) or an equivalent cap.
- Sort + slice exactly as today.

### Error Handling

Per-session read errors:
- Return `null` for that session (skip) — same as current behavior.

Sessions root missing/unreadable:
- Return `[]` — same as current behavior.

## Testing & Verification

Add a regression test that creates many sessions and ensures:
- Selection by provider still picks the newest `updatedAt`.
- Function returns expected number of sessions.

Run:
- `npm run test:scripts`

## Acceptance Criteria

- Commands using `listContextDbSessions()` behave the same but run faster on large session trees.
- Test suite passes.

## Rollback

Revert concurrency pool and restore sequential loop in `listContextDbSessions()`.

