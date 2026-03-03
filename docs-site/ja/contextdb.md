---
title: ContextDB
description: 5 ステップと主要コマンド。
---

# ContextDB

## 実行 5 ステップ

1. `init`
2. `session:new / session:latest`
3. `event:add`
4. `checkpoint`
5. `context:pack`

## 例

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
```

## コンテキストパック制御（P0）

`context:pack` はトークン予算とイベントフィルタに対応します。

```bash
npm run contextdb -- context:pack \
  --session <id> \
  --limit 60 \
  --token-budget 1200 \
  --kinds prompt,response,error \
  --refs core.ts,cli.ts
```

- `--token-budget`: L2イベントを推定トークン数で制限。
- `--kinds` / `--refs`: 一致イベントのみ含める。
- 重複イベントはデフォルトで除外。

## 検索コマンド（P1）

```bash
npm run contextdb -- search --query "auth race" --project demo --kinds response --refs auth.ts
npm run contextdb -- timeline --session <id> --limit 30
npm run contextdb -- event:get --id <sessionId>#<seq>
```
