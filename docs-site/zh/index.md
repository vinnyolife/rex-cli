---
title: 概览
description: 把现有 Codex/Claude/Gemini/OpenCode CLI 升级为 OpenClaw 风格能力的快速入口。
---

# RexCLI 文档

> 不换客户端，不改习惯。把你正在用的 `codex` / `claude` / `gemini` / `opencode` 升级成 OpenClaw 风格能力体验。

[30 秒开始（主 CTA）](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="hero" data-rex-target="quick_start" }
[查看能力案例](case-library.md){ .md-button data-rex-track="cta_click" data-rex-location="hero" data-rex-target="case_library" }

项目地址：<https://github.com/rexleimo/rex-cli>

`RexCLI` 是面向四类 CLI 智能体的本地工作流层：

- Codex CLI
- Claude Code
- Gemini CLI
- OpenCode

它不替代原生 CLI，而是补充两项能力：

1. 文件系统 ContextDB（可恢复会话记忆）
2. 统一工作流能力层（继续直接输入 `codex` / `claude` / `gemini` / `opencode`）

## RexCLI 可交付能力（运营视角）

### 1. 首页转化链路优化（从曝光到点击）

- 典型输入：当前首页 URL、目标人群、唯一主目标（例如“快速开始”）。
- 核心动作：定位信息断点、收敛 CTA、重写 Hero/问题/证据/行动区。
- 标准交付：可直接替换的页面文案块、CTA 位置方案、埋点事件命名表。
- 验收指标：主 CTA 点击率、案例页进入率、首屏跳出率可持续优化。

### 2. 能力表达重构（10 秒可理解）

- 典型输入：现有服务能力、代表案例、明确边界（不提供的范围）。
- 核心动作：把泛化描述改写成“问题 -> 动作 -> 结果”。
- 标准交付：能力矩阵、适用人群说明、skills 优先级列表。
- 验收指标：访客可在 10 秒内判断是否匹配并进入下一步。

### 3. 多 CLI 协作衔接（Codex/Claude/Gemini/OpenCode 接力）

- 典型输入：当前命令习惯、常见中断点、手动交接方式。
- 核心动作：定义 checkpoint 粒度、ContextDB 交接规则、one-shot/interactive 流程。
- 标准交付：标准接力命令、恢复模板、跨会话执行规范。
- 验收指标：切换工具或重开会话时的背景重复说明显著减少。

### 4. 团队流程 skill 化（从经验到标准）

- 典型输入：每周重复任务、现有手工流程、质量风险点。
- 核心动作：拆分步骤、补充约束与验证点，并封装为可复用 skills。
- 标准交付：skills 文档、执行清单、交付前验证门槛。
- 验收指标：新成员上手速度与交付一致性提升。

## 当前可复用 Skills（高频）

- `seo-geo-page-optimization`：用于着陆页结构、文案与 SEO/Geo 转化优化。
- `xhs-ops-methods`：用于小红书运营流程（选题、人设、排发互、复盘）。
- `brainstorming`：用于在改功能和改页面前收敛目标与设计方向。
- `writing-plans`：用于把多步骤需求拆成可执行计划。
- `dispatching-parallel-agents`：用于并行推进独立任务并提升交付速度。
- `systematic-debugging`：用于异常场景下的结构化排障。
- `verification-before-completion`：用于交付前强制验证，避免误判完成状态。

## 为什么说是 OpenClaw 风格能力升级？

你得到的是同类核心能力组合：

- 跨会话记忆（ContextDB）
- 浏览器自动化（Playwright MCP）
- 多 CLI 可接力（Codex / Claude / Gemini / OpenCode）
- 技能化流程复用（skills）

这不是“重新做一个聊天壳”，而是给你现有 CLI 直接加能力层。

## 30 秒上手（先用后看原理）

```bash
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## 你会立刻感受到的变化

| 场景 | 传统 CLI | 升级后（RexCLI） |
|---|---|---|
| 会话恢复 | 常靠手工回忆 | 自动带上项目上下文 |
| 多 CLI 协作 | 切工具容易丢状态 | 同一 ContextDB 接力 |
| 网页操作 | 手动点点点 | `browser_*` 自动化 |
| 复用流程 | 经验散落聊天记录 | skills 可复用沉淀 |

## 快速示例（直接可跑）

```bash
codex
claude
gemini
opencode

scripts/ctx-agent.sh --agent codex-cli --prompt "继续上一阶段并执行下一步"
```

## 继续阅读

- [快速开始](getting-started.md)
- [官方案例库](case-library.md)
- [博客站点](https://cli.rexai.top/blog/zh/)
- [友情链接](friends.md)
- [项目地址（GitHub）](https://github.com/rexleimo/rex-cli)
- [更新日志](changelog.md)
- [CLI 工作流](use-cases.md)
- [架构](architecture.md)
- [ContextDB](contextdb.md)
