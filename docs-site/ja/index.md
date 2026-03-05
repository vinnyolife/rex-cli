---
title: 概要
description: 既存の Codex/Claude/Gemini ワークフローを OpenClaw スタイル能力で強化する入口。
---

# RexCLI ドキュメント

> 今の CLI 習慣はそのまま。`codex` / `claude` / `gemini` に OpenClaw スタイルの能力レイヤーを追加します。

[30秒で開始（Primary CTA）](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="hero" data-rex-target="quick_start" }
[能力ケースを見る](case-library.md){ .md-button data-rex-track="cta_click" data-rex-location="hero" data-rex-target="case_library" }

プロジェクト URL: <https://github.com/rexleimo/rex-cli>

`RexCLI` は次の CLI 向けローカルワークフローレイヤーです。

- Codex CLI
- Claude Code
- Gemini CLI
- OpenCode

ネイティブ CLI を置き換えず、次の 2 つを追加します。

1. ファイルシステム ContextDB（セッション記憶）
2. 透過ラッパー（`codex` / `claude` / `gemini` をそのまま利用）

## RexCLI の提供価値（運用視点）

### 1. LP 転換導線の最適化（閲覧 -> クリック）

- 典型入力: 現在の LP URL、対象ユーザー、主目的 1 つ（例: クイックスタート）。
- 中核動作: メッセージ断点の特定、CTA の集約、Hero/課題/証拠/行動ブロックの再設計。
- 標準成果物: 差し替え可能なコピー、CTA 配置案、計測イベント命名表。
- 検収指標: 主 CTA クリック率とケースページ流入率を継続改善できる状態を作る。

### 2. 能力説明の再設計（10 秒で理解可能）

- 典型入力: 提供サービス、代表実績、非対応範囲。
- 中核動作: 抽象的な訴求を「課題 -> 実行 -> 結果」形式へ変換。
- 標準成果物: 能力マトリクス、対象ユーザー定義、skills 優先リスト。
- 検収指標: 訪問者が 10 秒以内に適合性を判断し、次の導線へ進める。

### 3. ContextDB による複数 CLI 連携の安定化

- 典型入力: Codex/Claude/Gemini の運用フローと引き継ぎ課題。
- 中核動作: checkpoint 粒度、記憶引き継ぎルール、one-shot/interactive 導線の定義。
- 標準成果物: 標準引き継ぎコマンド、再開テンプレート、跨セッション運用基準。
- 検収指標: ツール切替時の背景再説明コストを削減。

### 4. 反復運用の skills 化（経験を標準へ）

- 典型入力: 週次で繰り返すタスク、現行の手作業フロー、品質リスク。
- 中核動作: 手順分解、ガードレール設計、検証ポイント追加、skills 化。
- 標準成果物: skill ドキュメント、実行チェックリスト、完了前検証ゲート。
- 検収指標: オンボーディング短縮とチーム品質の安定化。

## 高頻度で再利用される Skills

- `seo-geo-page-optimization`: LP 構成・文案・SEO/Geo 転換最適化向け。
- `xhs-ops-methods`: 小紅書運用フローの一気通貫実行向け。
- `brainstorming`: 実装前の意図整理と設計方向の収束向け。
- `writing-plans`: 複数ステップ要件の実行計画化向け。
- `dispatching-parallel-agents`: 独立ドメインの安全な並列実行向け。
- `systematic-debugging`: 証拠ベースの障害対応向け。
- `verification-before-completion`: 完了宣言前の必須検証向け。

## 30 秒で開始（先に使う）

```bash
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## すぐに試す

```bash
codex
claude
gemini
```

## 次に読む

- [クイックスタート](getting-started.md)
- [公式ケースライブラリ](case-library.md)
- [ブログサイト](https://cli.rexai.top/blog/ja/)
- [リンク集](friends.md)
- [プロジェクト（GitHub）](https://github.com/rexleimo/rex-cli)
- [変更履歴](changelog.md)
- [CLI ワークフロー](use-cases.md)
- [アーキテクチャ](architecture.md)
- [ContextDB](contextdb.md)
