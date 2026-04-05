# HUD Dispatch Artifact Cache Design

Date: 2026-04-06

## Goal

Reduce repeated filesystem IO and JSON parsing for HUD-related flows (especially `--watch`) by caching dispatch artifact listings and the parsed latest dispatch artifact.

Targets:
- `node scripts/aios.mjs hud --watch`
- `node scripts/aios.mjs team status --watch`
- `node scripts/aios.mjs team history` (eliminate duplicate directory scans per session)

## Constraints

- No ContextDB schema migrations.
- Preserve output shape and semantics.
- Cache must self-invalidate quickly when new dispatch artifacts are written.
- Bounded memory usage (LRU + caps).

## Current Pain

`scripts/lib/hud/state.mjs`:
- `findLatestDispatchArtifact()` and `collectRecentDispatchEvidence()` each call `readdir()` + filter + sort on the same artifacts directory.
- `readHudState()` reads the latest dispatch artifact, then `buildHindsightEval()` may read it again (when not cached) unless `artifactCache` is provided.
- `readHudDispatchSummary()` currently eagerly reads all recent dispatch artifacts into `artifactCache`, which can defeat `buildHindsightEval()`’s internal cache when hindsight is already cached.

## Design

### 1) Cached dispatch-run filename index (LRU + TTL + mtime signature)

Add a module-level cache in `scripts/lib/hud/state.mjs` keyed by `{rootDir, sessionId}` that stores:
- `dirMtimeMs`: `fs.stat(artifactsDir).mtimeMs`
- `cachedAtMs`
- `names`: dispatch artifact filenames sorted desc (`dispatch-run-*.json`)

Validation:
- If `dirMtimeMs` unchanged AND `now - cachedAtMs <= TTL_MS`, reuse cached `names`.
- Otherwise refresh via `readdir()` + filter + sort.

Cache policy:
- TTL: `2000ms` (tuned for 1s watch interval).
- Max entries: `32` sessions (LRU eviction).
- Optional in-flight dedupe map to share concurrent refresh work.

### 2) Cache parsed latest dispatch artifact

Extend the same per-session cache entry to optionally store:
- `latestName`
- `latestDispatch` (the processed object currently returned by `findLatestDispatchArtifact`)

Validation:
- If cached `latestName` equals the current latest filename AND index entry is valid, reuse `latestDispatch` (no re-read / re-parse).
- When index refresh changes `latestName`, rebuild `latestDispatch` by reading/parsing the new JSON file.

### 3) Avoid defeating hindsight caching (artifactCache seeding only)

Adjust HUD readers:
- `readHudDispatchSummary()`: only seed `artifactCache` with `latestDispatch.raw` and pass it to `buildHindsightEval`. Do **not** eagerly read all recent artifacts up front.
- `readHudState()`: same: seed `artifactCache` with `latestDispatch.raw` and pass it to `buildHindsightEval`.

This keeps the “avoid double-reading the latest dispatch artifact” win while still allowing `buildHindsightEval()`’s LRU cache to prevent unnecessary JSON reads for older artifacts.

## Testing & Verification

Add a regression test that:
- Creates a session with dispatch artifacts
- Calls `readHudDispatchSummary()` (or `readHudState()`) to populate cache
- Writes a new `dispatch-run-*.json`
- Calls again and asserts `latestDispatch.artifactPath` updates to the new artifact

Run:
- `npm run test:scripts`

## Acceptance Criteria

- HUD/team history outputs remain compatible.
- `hud --watch` no longer re-parses the latest dispatch JSON on every tick when the artifacts dir is unchanged.
- Tests pass.

## Rollback

Remove the dispatch index/parsed latest caches and revert to direct `readdir()` + `safeReadJson()` behavior.

