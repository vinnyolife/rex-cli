# rex-ai-boot (AIOS)

本项目是一个面向 `Codex CLI`、`Claude Code`、`Gemini CLI` 的本地 Agent 工作流仓库。  
目标不是做一个新的聊天客户端，而是给现有 CLI 增加两件事：

1. 统一浏览器自动化能力（Playwright MCP，`browser_*` 工具）
2. 跨 CLI 共享的文件系统 Context DB（可追溯会话记忆）

## 你最关心的点：为什么直接输入 `codex` 也会带 ContextDB？

原理是 **zsh 包装函数透明接管**：

- 安装脚本 [`scripts/install-contextdb-shell.sh`](scripts/install-contextdb-shell.sh) 会往 `~/.zshrc` 追加一行：
  `source "/Users/rex/cool.cnb/rex-ai-boot/scripts/contextdb-shell.zsh"`
- [`scripts/contextdb-shell.zsh`](scripts/contextdb-shell.zsh) 定义同名函数：`codex()`、`claude()`、`gemini()`
- 在本仓库目录内，这些函数会调用 [`scripts/ctx-agent.sh`](scripts/ctx-agent.sh) 先处理 context，再启动原生 CLI
- 在仓库外或管理子命令（如 `codex mcp`、`gemini hooks`）场景下，会直接透传到原命令

所以你仍然输入原命令，体验上不需要改操作习惯。

## 系统架构

```text
User -> codex/claude/gemini
     -> (zsh wrapper: contextdb-shell.zsh)
     -> ctx-agent.sh
        -> contextdb CLI (init/session/event/checkpoint/pack)
        -> 启动原生 codex/claude/gemini（注入 context packet）
     -> mcp-server/browser_* (可选，浏览器自动化)
```

## 目录说明

- `mcp-server/`: Playwright MCP 服务与 `contextdb` CLI 实现
- `scripts/ctx-agent.sh`: 统一运行器（自动接入 ContextDB）
- `scripts/contextdb-shell.zsh`: 透明接管 `codex/claude/gemini`
- `memory/context-db/`: 会话数据（本地产物，已忽略提交）
- `config/browser-profiles.json`: 浏览器 profile/CDP 配置

## 快速开始

### 1) 构建 MCP 与 ContextDB CLI

```bash
cd mcp-server
npm install
npm run build
```

### 2) 安装透明接管（一次即可）

```bash
cd ..
./scripts/install-contextdb-shell.sh
source ~/.zshrc
```

安装脚本会在 `~/.zshrc` 写入一个 `ROOTPATH` 逻辑块（不是写死单条 source）：

```zsh
export ROOTPATH="${ROOTPATH:-<repo-root>}"
if [[ -f "$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
  source "$ROOTPATH/scripts/contextdb-shell.zsh"
fi
```

如果仓库搬家，只要改 `ROOTPATH` 即可，无需重装 CLI。

### 3) 直接使用原命令

```bash
codex
claude
gemini
```

## 两种运行模式

### A. 交互模式（直接 `codex` / `claude` / `gemini`）

- 自动做：`init`、`session:latest/new`、`context:pack`
- 用途：启动时自动带上历史上下文
- 边界：不会在每一轮消息后自动写 checkpoint

### B. One-shot 模式（推荐做全自动闭环）

```bash
scripts/ctx-agent.sh --agent codex-cli --project rex-ai-boot --prompt "继续上次任务并执行下一步"
```

one-shot 下会自动执行完整 5 步：
`init -> session:new/latest -> event:add -> checkpoint -> context:pack`

## ContextDB 数据结构（L0/L1/L2）

```text
memory/context-db/
  manifest.json
  index/sessions.jsonl
  sessions/<session_id>/
    meta.json
    l0-summary.md
    l1-checkpoints.jsonl
    l2-events.jsonl
    state.json
  exports/<session_id>-context.md
```

## 常用命令

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent claude-code --project rex-ai-boot --goal "stabilize flow"
npm run contextdb -- event:add --session <id> --role user --text "need retry plan"
npm run contextdb -- checkpoint --session <id> --summary "blocked by auth" --status blocked --next "wait-login|resume"
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
```

## 开发验证

```bash
cd mcp-server
npm test
npm run typecheck
npm run build
```

## 卸载透明接管

从 `~/.zshrc` 删除这一行后重新加载 shell：

```bash
grep -v 'contextdb-shell.zsh' ~/.zshrc > ~/.zshrc.tmp && mv ~/.zshrc.tmp ~/.zshrc
source ~/.zshrc
```

删除后 `codex/claude/gemini` 会恢复原生行为。
