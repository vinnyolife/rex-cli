# 发布：面向多 CLI 智能体的统一上下文层

多数 AI CLI 工作流在切换工具时会断上下文。本次发布提供一个可落地的上下文层，在 Codex、Claude、Gemini 之间保持状态连续。

## 本次变化

- 共享文件系统 ContextDB
- 会话 checkpoint 与恢复包生成
- 透明命令包装，降低接入摩擦

## 价值

团队在切换客户端时不需要重新拼接任务状态。

## 下一步

从产品入口开始：
[https://cli.rexai.top](https://cli.rexai.top)
