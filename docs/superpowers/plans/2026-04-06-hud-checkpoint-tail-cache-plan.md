# HUD Checkpoint Tail Cache Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speed up `hud --watch` / `team status --watch` by caching the parsed latest checkpoint from `l1-checkpoints.jsonl` when the file has not changed.

**Architecture:** Add a small LRU cache in `scripts/lib/hud/state.mjs` for `readLastJsonLine()` keyed by `filePath + maxBytes` and invalidated by `(mtimeMs, size)` from `fs.stat`. When unchanged, skip `fs.open/read` and `JSON.parse`.

**Tech Stack:** Node.js `fs.promises`, built-in `node:test`, ESM modules.

---

### Task 1: Add a regression test for checkpoint tail caching

**Files:**
- Modify: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Add a new test that proves caching behavior (fails before implementation)**

Add a test that:
1) writes a session with `meta.json` + `l1-checkpoints.jsonl` containing `seq=1`
2) monkeypatches `fs.open` (from `node:fs` promises) to count calls
3) calls `readHudState()` twice without changing the checkpoint file
4) asserts `openCount === 1` (second call hits cache) and `latestCheckpoint.seq === 1`
5) appends a second checkpoint line (`seq=2`)
6) calls `readHudState()` again
7) asserts `openCount === 2` (cache invalidated) and `latestCheckpoint.seq === 2`

Suggested test skeleton (adapt to existing helpers in the file):

```js
test('readHudState caches latest checkpoint tail until file changes', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-checkpoint-cache-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');
  const sessionId = 'checkpoint-cache-session';
  const sessionDir = path.join(sessionsRoot, sessionId);

  await writeJson(path.join(sessionDir, 'meta.json'), makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-06T00:00:00.000Z' }));
  await writeJsonLines(path.join(sessionDir, 'l1-checkpoints.jsonl'), [{ seq: 1, ts: '2026-04-06T00:00:00.000Z', status: 'running', summary: 'First', nextActions: [], artifacts: [] }]);

  const originalOpen = fs.open;
  let openCount = 0;
  fs.open = async (...args) => {
    openCount += 1;
    return await originalOpen(...args);
  };

  try {
    const first = await readHudState({ rootDir, sessionId });
    const second = await readHudState({ rootDir, sessionId });
    assert.equal(first.latestCheckpoint?.seq, 1);
    assert.equal(second.latestCheckpoint?.seq, 1);
    assert.equal(openCount, 1);

    await fs.appendFile(
      path.join(sessionDir, 'l1-checkpoints.jsonl'),
      `${JSON.stringify({ seq: 2, ts: '2026-04-06T00:00:01.000Z', status: 'running', summary: 'Second', nextActions: [], artifacts: [] })}\n`,
      'utf8'
    );

    const third = await readHudState({ rootDir, sessionId });
    assert.equal(third.latestCheckpoint?.seq, 2);
    assert.equal(openCount, 2);
  } finally {
    fs.open = originalOpen;
  }
});
```

- [ ] **Step 2: Run the single test file to confirm it fails before caching**

Run: `node --test scripts/tests/hud-state.test.mjs`

Expected: FAIL (because `readLastJsonLine()` opens the checkpoint file every call today).

---

### Task 2: Implement the checkpoint tail LRU cache

**Files:**
- Modify: `scripts/lib/hud/state.mjs`
- Test: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Add cache constants**

In `scripts/lib/hud/state.mjs`, add near other HUD caches:

```js
const CHECKPOINT_TAIL_CACHE_MAX_ENTRIES = 32;
const CHECKPOINT_TAIL_CACHE = new Map();
```

- [ ] **Step 2: Refactor `readTailText()` to accept pre-fetched stats**

Change signature from:

```js
async function readTailText(filePath, maxBytes) { ... }
```

To:

```js
async function readTailText(filePath, maxBytes, stats = null) { ... }
```

Use `stats ?? await fs.stat(filePath)` so callers can avoid a second `fs.stat`.

- [ ] **Step 3: Implement cache lookup in `readLastJsonLine()`**

Algorithm:
1) `const stats = await fs.stat(filePath)` (inside try/catch)
2) compute signature: `{ mtimeMs: Math.floor(stats.mtimeMs), size: Number(stats.size) || 0 }`
3) key: `${filePath}::${maxBytes}`
4) if cache entry exists and signature matches, `bumpLruCache(...)` and return cached `value`
5) else read tail (`readTailText(filePath, maxBytes, stats)`), parse last valid JSON, then store in cache via `setLruCache(...)`

Example structure:

```js
const cacheKey = `${filePath}::${maxBytes}`;
const cached = CHECKPOINT_TAIL_CACHE.get(cacheKey);
if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
  bumpLruCache(CHECKPOINT_TAIL_CACHE, cacheKey);
  return cached.value;
}
// ... compute value ...
setLruCache(CHECKPOINT_TAIL_CACHE, cacheKey, { mtimeMs, size, value }, CHECKPOINT_TAIL_CACHE_MAX_ENTRIES);
return value;
```

- [ ] **Step 4: Run the single test file**

Run: `node --test scripts/tests/hud-state.test.mjs`

Expected: PASS (new cache test + existing HUD tests).

---

### Task 3: Verify full scripts test suite

**Files:**
- None

- [ ] **Step 1: Run the scripts test suite**

Run: `npm run test:scripts`

Expected: PASS.

---

### Task 4: Commit + push

**Files:**
- Modify: `scripts/lib/hud/state.mjs`
- Modify: `scripts/tests/hud-state.test.mjs`
- Add: `docs/superpowers/specs/2026-04-06-hud-checkpoint-tail-cache-design.md`
- Add: `docs/superpowers/plans/2026-04-06-hud-checkpoint-tail-cache-plan.md`

- [ ] **Step 1: Commit docs (optional)**

```bash
git add docs/superpowers/specs/2026-04-06-hud-checkpoint-tail-cache-design.md docs/superpowers/plans/2026-04-06-hud-checkpoint-tail-cache-plan.md
git commit -m "docs(hud): add checkpoint tail cache design and plan"
```

- [ ] **Step 2: Commit perf change**

```bash
git add scripts/lib/hud/state.mjs scripts/tests/hud-state.test.mjs
git commit -m "perf(hud): cache latest checkpoint tail for watch"
```

- [ ] **Step 3: Push**

Run: `git push`
