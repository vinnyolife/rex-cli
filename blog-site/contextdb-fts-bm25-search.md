# ContextDB Search Upgrade: FTS5/BM25 by Default

ContextDB search has moved from a lexical-first path to a SQLite FTS5 + BM25 default path, while keeping compatibility fallback and optional semantic rerank.

## Why We Changed It

As session history grows, plain lexical scanning becomes less stable in both speed and ranking quality. We needed:

- faster lookup on large event sets,
- better ranking for exact and near-exact matches,
- safe fallback when FTS is unavailable in a local runtime.

## What Is Live Now

`contextdb search` now follows this order:

1. SQLite FTS5 `MATCH` query
2. BM25 ranking (`bm25(...)`) on indexed fields (`kind/text/refs`)
3. Automatic lexical fallback when FTS is unavailable

No migration is required for normal usage.

## Semantic Rerank Adjustment

When `--semantic` is enabled, rerank now runs on query-scoped lexical candidates instead of recency-only candidates.  
This reduces the chance that older but exact hits are filtered out too early.

## Commands

```bash
cd mcp-server
npm run contextdb -- search --query "auth race" --project demo
npm run contextdb -- search --query "auth race" --project demo --semantic
npm run contextdb -- index:rebuild
```

## Practical Impact

- Better default relevance for `contextdb search`
- More predictable behavior across different local SQLite builds
- Safer semantic mode for long-running sessions with older critical events

If you operate long sessions or cross-CLI handoffs, this is the recommended default path.
