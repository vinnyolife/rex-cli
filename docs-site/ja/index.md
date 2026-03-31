---
title: 概要
description: 既存の Codex/Claude/Gemini/OpenCode CLI を OpenClaw スタイルにアップグレード。
---

# RexCLI

> 今のツールを続けながら、`codex` / `claude` / `gemini` / `opencode` に更强的能力を足す。

[GitHub で Star](https://github.com/rexleimo/rex-cli?utm_source=cli_rexai_top&utm_medium=docs&utm_campaign=english_growth&utm_content=home_hero_star){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="github_star" }
[クイックスタート](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="quick_start" }
[ワークフロー比較](cli-comparison.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="compare_workflows" }
[Superpowers](superpowers.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="superpowers" }

プロジェクトURL: <https://github.com/rexleimo/rex-cli>

## 最新機能

- [AIOS RL Training System](/blog/rl-training-system/)
- [ContextDB Search Upgrade: FTS5/BM25 by Default](/blog/contextdb-fts-bm25-search/)
- [Windows CLI Startup Stability Update](/blog/windows-cli-startup-stability/)
- [Orchestrate Live: Subagent Runtime](/blog/orchestrate-live/)

## これは何か？

RexCLIは、すでにあるCLIエージェントの上に薄い能力レイヤーを載せるもの。`codex`や`claude`などを替换せず、もっと使いやすくする。

4つのできること：

1. **記憶がセッション跨げる** - ターミナル閉じてまた開いても、前のプロジェクト状況がそのまま。同一プロジェクトなら複数デバイスで記憶共有。
2. **ブラウザ自動化** - MCP経由でChromeを操作できる。
3. **Superpowers 智能計画** - 要件自動分解、並列タスク分发、自动検証。
4. **プライバシーガード** - 設定ファイル読み込む時、自動でシークレットをマスク。

## 谁のために？

- すでに`codex`、`claude`、`gemini`、`opencode」のどれかを使ってる
- ターミナル再起動してもワークフローを続けたい
- ブラウザ自動化が必要だけどツールを変えたくない
- ベストプラクティスを強制する自動化スキルがほしい

## クイックスタート

```bash
curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
source ~/.zshrc
aios
```

上のコマンドは stable release 用インストール経路です。未リリースの `main` を使いたい場合は、[クイックスタート](getting-started.md) にある開発用 `git clone` 経路を使ってください。

まず `aios` を起動して全画面 TUI を開き、**Setup** を選んで、最後に **Doctor** を実行してください。
Windows PowerShell の手順は [クイックスタート](getting-started.md) にあります。

## 入っているもの

| 機能 | 役割 |
|---|---|
| ContextDB | セッション跨ぎの永続化記憶 |
| Playwright MCP | ブラウザ自動化 |
| Superpowers | 智能計画（自動分解、並列分发、自动検証） |
| Privacy Guard | 敏感情報を自動マスク |

## 続きを読む

- [Superpowers](superpowers.md) - CLIをより賢くする自動化スキル
- [クイックスタート](getting-started.md)
- [Raw CLI vs RexCLI](cli-comparison.md)
- [ケース集](case-library.md)
- [アーキテクチャ](architecture.md)
- [ContextDB](contextdb.md)
- [変更履歴](changelog.md)
