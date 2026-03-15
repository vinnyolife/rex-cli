---
title: "RexCli 最新更新：Windows 原生支持 + 实时成本追踪"
description: "RexCli 带来重大更新：完整的 Windows 工作流支持、实时 API 成本追踪、OpenCode Agent 集成，让 AI 开发更高效、更透明"
date: 2026-03-16
tags: [RexCli, Windows, Cost Tracking, OpenCode, AI Development]
---

# RexCli 最新更新：Windows 原生支持 + 实时成本追踪

我们很高兴地宣布 RexCli 的几项重大更新，这些功能让 AI 辅助开发变得更加高效和透明。

## 🪟 Windows 原生工作流支持

RexCli 现在完全支持 Windows 环境！我们解决了路径处理、命令行参数分割等 Windows 特有的问题，让 Windows 开发者也能享受流畅的 AI 辅助开发体验。

**关键改进：**
- 原生 Windows 路径处理（`C:\Users\...` 格式）
- 修复 cmd 环境下的 CLI 启动问题
- 避免 Windows Codex 参数分割错误
- 非 git 工作区的优雅降级支持

相关文档：[Windows 使用指南](../windows-guide.md)

## 💰 实时成本追踪（Cost Telemetry）

新增的成本遥测功能让你实时了解 API 调用的成本。在执行长时间运行的任务时，RexCli 会自动追踪并显示：

- 实时 token 使用量
- API 调用成本统计
- 任务执行预算控制
- 成本超限预警

这对于需要控制 AI 使用成本的团队来说是一个重要功能。你可以在 `aios orchestrate` 命令中看到实时的成本数据。

## 🤖 OpenCode Agent 支持

RexCli 现在集成了 OpenCode Agent 支持，让你可以：

- 使用 OpenCode 生态的 agent 能力
- 更灵活的 agent 编排和调度
- 与 ContextDB 深度集成

通过 `ctx-agent` 核心，RexCli 统一了不同 agent 运行时的接口，让多 agent 协作变得更加简单。

## 📊 Context Session 管理增强

我们改进了 Context Session 的管理机制：

- 更稳定的 session 状态追踪
- 临时 session 协调计划
- 优化的 checkpoint 机制
- 更好的 context 打包和恢复

这些改进让长时间运行的 AI 任务更加可靠，即使遇到中断也能从 checkpoint 恢复。

## 🔧 其他改进

- **ContextDB SQLite 索引**：`index:rebuild` 命令支持，可选的 `--semantic` 语义搜索
- **Privacy Guard**：严格的隐私保护，支持 Ollama 本地模型
- **Orchestrator Catalog**：agent 目录和生成器支持
- **Runtime Manifest**：外部化的运行时清单规范

## 升级指南

```bash
# 更新到最新版本
npm install -g rex-cli

# 查看完整更新日志
rex changelog
```

## 相关链接

- [完整更新日志](../changelog.md)
- [快速开始](../getting-started.md)
- [ContextDB 文档](../contextdb.md)
- [故障排查](../troubleshooting.md)

---

**立即体验 RexCli 的最新功能，让 AI 辅助开发更高效、更透明！**
