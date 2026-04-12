# 2026-04-12 RL Contextual Bandit（Orchestrator 路由）实施计划

## 目标

- 在不破坏现有 `rl-core` / `rl-mixed-v1` 流程的前提下，新增一条真实在线学习链路：
  - `orchestrator` 执行器选择使用 contextual bandit 做动作选择；
  - episode 结果回流为 bandit trajectory；
  - `runOnlineUpdateBatch` 在同一批次中同时支持 PPO 与 bandit 更新。

## 变更范围

- `scripts/lib/rl-core/trainer.mjs`
  - 新增 bandit policy state、动作采样、bandit update。
  - 新增 trajectory 路由更新器，按 `updateType` 分流到 PPO 或 bandit。
- `scripts/lib/rl-orchestrator-v1/schema.mjs`
  - 新增 bandit trace 校验器。
- `scripts/lib/rl-orchestrator-v1/decision-runner.mjs`
  - 支持可选 `selectedExecutor` 输入，并将其反映到 evidence。
- `scripts/lib/rl-orchestrator-v1/adapter.mjs`
  - `runEpisode` 接受 policy，生成/返回 `bandit_trace`。
- `scripts/lib/rl-mixed-v1/run-orchestrator.mjs`
  - orchestrator episode 构建 bandit trajectory。
  - mixed batch 更新调用启用 trajectory 路由更新器。
  - summary 暴露 bandit policy 状态（用于验证/监控）。

## 验证计划

- `node --test scripts/tests/rl-core-trainer.test.mjs`
- `node --test scripts/tests/rl-orchestrator-v1-schema.test.mjs scripts/tests/rl-orchestrator-v1-adapter.test.mjs`
- `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`

## 完成标准

- orchestrator 环境在 mixed campaign 中出现可观测 bandit update（`update_count > 0`）。
- adapter episode 包含结构化 `bandit_trace`（启用 policy 时）。
- 现有 RL 相关测试通过，且未改变非 orchestrator 轨迹的 PPO 默认行为。

## 执行结果（2026-04-12）

- 已完成：
  - `rl-core/trainer.mjs` 增加 `selectContextualBanditAction`、`applyContextualBanditUpdate`、`applyTrajectoryUpdate`。
  - `rl-orchestrator-v1/adapter.mjs` 在 episode 执行阶段注入 bandit 选路并输出 `bandit_trace`。
  - `rl-orchestrator-v1/decision-runner.mjs` 支持 `selectedExecutor`，并在 fixture 中将选路反馈到 outcome。
  - `rl-orchestrator-v1/schema.mjs` 增加 `validateOrchestratorBanditTrace`。
  - `rl-mixed-v1/run-orchestrator.mjs` 为 orchestrator episode 生成 bandit trajectory，并启用混合 updater 路由。
  - `rl-mixed-v1/run-orchestrator.mjs` 将 orchestrator bandit reward 升级为多信号融合（成功率/回滚率/人工接管率 + terminal/missed-handoff/blocked 惩奖）。
  - 测试新增断言：bandit update、生效 trace、mixed summary 中的 bandit policy state。

- 验证证据（全部通过）：
  - `node --test scripts/tests/rl-core-trainer.test.mjs`（`11/11` pass）
  - `node --test scripts/tests/rl-orchestrator-v1-schema.test.mjs scripts/tests/rl-orchestrator-v1-adapter.test.mjs`（`4/4` pass）
  - `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`（`3/3` pass）
  - `node --test scripts/tests/rl-shell-v1-trainer.test.mjs`（`9/9` pass）
  - `node --test scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs`（`1/1` pass）
