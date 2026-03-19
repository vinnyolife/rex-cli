# ContextDB 检索升级：默认走 FTS5/BM25

ContextDB 的 `search` 已从 lexical-first 路径升级为默认 SQLite FTS5 + BM25，同时保留兼容性回退与可选语义重排。

## 为什么要改

随着会话历史变大，纯 lexical 扫描在速度和排序质量上都会波动。我们需要：

- 在大事件集上更快命中；
- 对精确/近似命中给出更稳定的排序；
- 在本地环境 FTS 不可用时不影响可用性。

## 现在的默认行为

`contextdb search` 的执行路径为：

1. SQLite FTS5 `MATCH`
2. BM25 排序（`bm25(...)`，覆盖 `kind/text/refs`）
3. 若 FTS 不可用，自动回退 lexical 匹配

日常使用无需迁移。

## 语义重排也做了修正

开启 `--semantic` 后，重排基于“当前 query 的 lexical 候选集”执行，而不是仅按最近事件取样。  
这样可以降低“较早但命中非常精确”的结果被提前丢掉的概率。

## 可直接复用的命令

```bash
cd mcp-server
npm run contextdb -- search --query "auth race" --project demo
npm run contextdb -- search --query "auth race" --project demo --semantic
npm run contextdb -- index:rebuild
```

## 实际价值

- `contextdb search` 默认相关性更稳定
- 在不同本地 SQLite 环境下行为更可预测
- 长会话场景里，语义模式对“历史关键事件”更友好

如果你在做长流程协作或跨 CLI 接力，这套默认路径建议直接使用。
