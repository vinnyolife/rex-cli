# HUD Checkpoint Tail Cache Design

Date: 2026-04-06

## Goal

Speed up `hud --watch` / `team status --watch` by caching the parsed “latest checkpoint” read from `l1-checkpoints.jsonl` when the file has not changed.

## Constraints

- No ContextDB schema migrations.
- Preserve output shape and semantics.
- Cache must invalidate reliably when new checkpoint lines are appended.
- Bounded memory usage (LRU).

## Current Behavior

`scripts/lib/hud/state.mjs` uses `readLastJsonLine()` to read and parse the last JSON row from:

`memory/context-db/sessions/<sessionId>/l1-checkpoints.jsonl`

On watch refresh, this repeats every tick, causing:
- repeated `fs.open + read + JSON.parse` even when the file is unchanged.

## Design

### Cache key + signature

Cache entries are keyed by:
- `filePath`
- `maxBytes` (tail read window)

Each entry stores a signature:
- `mtimeMs` (from `fs.stat`)
- `size` (from `fs.stat`)

If the signature matches, return the cached parsed checkpoint without re-reading the file contents.

### LRU bounds

- Max entries: `32`
- Cache only the parsed last JSON object (or `null`), not the full tail text.

### Avoid duplicate `fs.stat`

Refactor `readTailText()` to accept a pre-fetched `stats` object so `readLastJsonLine()` can:
1) call `fs.stat` once (for signature + size)
2) read the tail using the same stats

## Testing & Verification

Add a regression test that:
- writes `l1-checkpoints.jsonl` with seq=1
- calls `readHudState()` and asserts seq=1
- appends a new checkpoint (seq=2)
- calls `readHudState()` again and asserts seq=2

Run:
- `npm run test:scripts`

## Acceptance Criteria

- `hud --watch` does not re-read/parse checkpoints when `l1-checkpoints.jsonl` is unchanged.
- When a new checkpoint is written, the next HUD refresh shows the new latest checkpoint.
- Test suite passes.

## Rollback

Remove the checkpoint tail cache and revert `readTailText()` signature changes.

