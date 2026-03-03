---
name: contextdb-autopilot
description: Use when running tasks in Codex CLI, Claude Code, or Gemini CLI and you need automatic context persistence (init/session/event/checkpoint/context-pack) without manual contextdb commands.
---

# ContextDB Autopilot

## Overview
Use this skill to run a task with full filesystem context DB automation in one command.

Script path: `scripts/ctx-agent.sh`

## When to Use
- You want cross-CLI memory continuity (`codex`, `claude`, `gemini`) in the same project.
- You need zero-manual context DB operations per task run.
- You want each run to auto-write user event, assistant event, checkpoint, and refreshed context packet.

## Required Pattern
Use one-shot mode (`--prompt`) for full automation.

```bash
scripts/ctx-agent.sh --agent codex-cli --project rex-ai-boot --prompt "继续上次任务，先做最小变更"
scripts/ctx-agent.sh --agent claude-code --project rex-ai-boot --prompt "延续当前会话并输出下一步"
scripts/ctx-agent.sh --agent gemini-cli --project rex-ai-boot --prompt "基于已有上下文继续执行"
```

## Session Control
- Continue same session: `--session <session_id>`
- Mark terminal step: `--status done`
- Disable checkpoint (rare): `--no-checkpoint`

Example:
```bash
scripts/ctx-agent.sh \
  --agent codex-cli \
  --project rex-ai-boot \
  --session codex-cli-20260303T010101-abcd1234 \
  --status done \
  --prompt "所有改动完成，给最终总结"
```

## Verification
- Context packet output: `memory/context-db/exports/<session_id>-context.md`
- Session files: `memory/context-db/sessions/<session_id>/`
