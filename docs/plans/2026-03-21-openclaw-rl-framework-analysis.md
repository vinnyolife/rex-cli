# OpenClaw-RL 对 AIOS 的框架强化分析

## 结论

不建议把 `OpenClaw-RL` 整体引入 `aios`。

原因很直接：

1. `OpenClaw-RL` 的核心收益来自在线 RL / OPD / LoRA 微调，而 `aios` 当前的核心资产是 `ContextDB + skills + harness + orchestrate`。
2. `aios` 现在最缺的不是“模型权重在线训练”，而是“把真实交互自动沉淀成更强的技能、记忆、门控和执行策略”的闭环。
3. `OpenClaw-RL` 自己的 roadmap 也明确写了下一步是 “beyond the policy: extend learning to skills and memory”，这和 `aios` 的方向比纯 RL 更契合。

因此，最合理的路线不是 `Adopt`，而是 `Compose`：

- 保留 `aios` 的本地优先、跨 CLI、可审计架构
- 吸收 `OpenClaw-RL` 在“请求标记、turn 切分、next-state 反馈、异步评估、信号融合”上的方法
- 把学习目标从“在线改模型权重”改成“在线改技能、runbook、memo、gate、dispatch 策略”

## OpenClaw-RL 真正值得学的部分

### 1. 统一的交互标记协议

`OpenClaw-RL` 不是简单记录对话，而是在请求发出前就注入：

- `X-Session-Id`
- `X-Turn-Type` (`main` / `side`)

这样它能在日志侧重建完整 session，并且把真正可学习的主线回合和 housekeeping 回合区分开。

这点对 `aios` 很重要，因为 `aios` 现在已经有：

- workspace memo
- bootstrap
- orchestrate preflight
- quality gate
- verification artifacts

但这些信号混在一起时，很难判断“哪个交互应该进入学习闭环，哪个只是维护噪声”。

### 2. 用 next-state 评价上一步，而不是只看终局 checkpoint

`OpenClaw-RL` 的关键设计不是“多一个 judge”，而是：

- 回合 `t` 先正常服务
- 等到 `t+1` 到来时，把 `t+1` 当作 `t` 的 next state
- 再去评价 `t` 是否有效

这比只看最终任务是否完成更强，因为它能捕获：

- 用户纠正
- redo / retry
- 工具调用成功或失败
- 环境返回的结构化错误

而 `aios` 当前的 `learn-eval` 更偏 session/checkpoint 级总结，适合做 runbook/promote/fix 建议，但不适合回答：

- 上一轮 browser action 到底有没有推进任务
- 这次 retry 是必要修复还是无效重复
- 哪条用户反馈应该被沉淀成技能约束

### 3. 异步解耦

`OpenClaw-RL` 把 serving、rollout collect、judge、training 拆成并行回路。

迁移到 `aios` 后，不应该变成训练闭环，而应该变成：

- live execution loop: 正常执行任务
- evidence loop: 异步聚合轨迹和环境反馈
- hindsight loop: 生成 lesson / hint / failure tag
- promotion loop: 将高价值 lesson 转成 memo / skill / gate / dispatch recommendation

这样才能在不阻塞用户当前任务的情况下，让系统边用边改。

### 4. 融合两类信号：标量结果 + 文本纠错

`OpenClaw-RL` 的组合方法本质上是在融合：

- Binary RL: 这步总体对不对
- OPD: 如果不对，应该怎样更好

这个模式非常适合 `aios`，只是目标不应该是梯度更新，而应该是框架更新：

- 标量信号: pass/fail, blocked/done, retry count, elapsed ms, quality gate result
- 文本信号: 用户纠错、人工接管说明、日志里的关键失败摘要、事后补充的 memo

`aios` 现在只有前一类信号比较成体系，后一类还是分散在 prompt / response / memo / notes 里，没形成稳定的 hindsight distillation。

## AIOS 当前状态和差距

### 现有强项

`aios` 已经具备一套很好的“可审计执行框架”：

- ContextDB 保存 session / event / checkpoint / packet
- learn-eval 从 checkpoint telemetry 反推 promote/fix/observe
- orchestrate 能做 blueprint、preflight、dispatch、artifact 持久化
- workspace memo 能做人工沉淀和后续注入

这说明 `aios` 已经有“学习的容器”，缺的是“学习的细粒度样本”和“自动蒸馏过程”。

### 主要差距

#### 差距 A: 缺统一的 turn 级信号模型

当前事件有 `kind`，checkpoint 有 `verification/failureCategory/cost`，但没有一个统一的 turn envelope 去表达：

- 这是主线回合还是 side 回合
- 这一步属于哪个 work item / 哪个子代理 / 哪个环境
- 下一条反馈对应的是哪一步的后验评价

这会限制后续所有自动学习能力。

#### 差距 B: learn-eval 太偏 session 末端，不够贴近动作本身

现在 `learn-eval` 更像“checkpoint telemetry summarizer”，不是“行为学习器”。

它擅长：

- 判断是否值得 promote
- 判断失败主要来自哪个 category
- 发现 verification 缺失

但它不擅长：

- 识别某个 browser/tool step 的直接后果
- 将用户纠错变成局部策略约束
- 为下一轮同类动作生成可复用的 hindsight hint

#### 差距 C: 结果能记住，但不能稳定蒸馏成框架资产

`aios` 可以记录：

- memo
- checkpoint
- artifact
- notes

但现在缺少一个稳定流程把“高价值事件”自动变成：

- pinned memory
- skill patch 候选
- gate rule 候选
- dispatch policy 调整建议
- browser / shell / MCP domain-specific runbook

#### 差距 D: 还没有环境适配层

`OpenClaw-RL` 已经把 terminal / GUI / SWE / tool-call 分成独立场景。

`aios` 当前虽然有 browser MCP、CLI agent、quality gate、orchestrate，但“怎么从不同环境里提取学习信号”还没有独立成 adapter 层。

## 对 AIOS 最值得做的 5 个优化点

### P0. 引入 `interaction envelope` 作为统一学习载体

建议新增一个 turn/work-item 级结构，而不是继续只靠松散事件文本：

- `sessionId`
- `turnId`
- `parentTurnId`
- `workItemId`
- `agent`
- `environment` (`cli`, `browser`, `shell`, `orchestrate`, `memo`)
- `turnType` (`main`, `side`, `system-maintenance`, `verification`)
- `inputRefs`
- `outputRefs`
- `nextStateRefs`
- `outcome`
- `hindsightStatus`

建议优先落在：

- `mcp-server/src/contextdb/core.ts`
- `mcp-server/src/contextdb/sqlite.ts`
- `scripts/ctx-agent-core.mjs`
- `scripts/lib/harness/orchestrator-evidence.mjs`

这是后面所有自动学习能力的前置条件。

### P1. 在 harness 里新增 `hindsight-eval`，专门处理 next-state 学习

不要一上来做 RL。先做一个轻量、可审计的“后验评估器”：

输入：

- 某一步 agent 输出
- 下一步用户 / 工具 / 环境反馈
- 当前 work item 上下文

输出：

- `success | correction | retry-needed | ambiguous`
- `failureCategory`
- `hint`
- `confidence`
- `promotionCandidate`

这会把 `OpenClaw-RL` 的 next-state 思路迁到 `aios`，但产出的是框架资产而不是训练样本。

### P1. 建一个后台 `lesson distiller`

它不改模型权重，只做：

1. 扫描最近高价值 session
2. 找出重复失败 / 明确纠错 / 高成功率模式
3. 产出结构化建议：
   - memo append
   - pinned memory update
   - gate candidate
   - runbook patch candidate
   - skill constraint candidate

最适合从这些入口接：

- `learn-eval`
- `quality-gate` artifact
- `orchestrate` dispatch artifact
- browser action traces

这会把 `aios` 从“能记录”推进到“能持续变强”。

### P1. 把文本纠错和标量验证融合，而不是二选一

建议把现有 `verification` / `failureCategory` / `retryCount` 保留，同时新增：

- `hindsightHint`
- `correctionSource` (`user`, `tool`, `env`, `self-review`, `human`)
- `hintQuality`
- `applicabilityScope`

然后让 `learn-eval` 同时看：

- checkpoint telemetry
- hindsight hints
- memo/pinned updates

这样 promote/fix 推荐会从“统计驱动”升级成“统计 + 语言反馈联合驱动”。

### P2. 做环境适配器，而不是一个通用 evaluator 吃所有东西

建议按环境拆 learning adapter：

- `browser-learning-adapter`
  - 看 DOM/state diff、auth wall、tool result、重试模式
- `shell-learning-adapter`
  - 看 exit code、stderr、命令重试、cwd/file diff
- `orchestrate-learning-adapter`
  - 看 dispatch blocked、merge gate、executor choice、handoff 质量
- `memo-learning-adapter`
  - 从人工 memo 里提约束和升级候选

这样 `aios` 不会变成一个巨大的“万能 judge”，而是逐环境增强。

### P2. 可选实验：本地 API 代理层

如果未来要更接近 `OpenClaw-RL` 的方式，可以考虑给 `aios` 增加一个可选本地代理层，用来：

- 标准化请求元数据
- 捕获真实 provider 交互
- 更精确地关联 response 和后续 feedback

但这应该是实验项，不是当前主线。因为它会显著增加：

- 兼容成本
- 安全边界复杂度
- 跨 CLI 维护难度

## 不建议现在做的事情

### 1. 不建议直接接入 SLIME / Tinker / LoRA 在线训练

这套东西很强，但对 `aios` 当前阶段不划算：

- 基础设施太重
- 对 GPU / provider / serving topology 依赖强
- 会把 `aios` 从 agent infrastructure 拉向 model training platform
- 和跨 CLI、本地优先、可审计、小步迭代的当前目标不一致

### 2. 不建议把“学习”定义成自动改 prompt 文本本身

如果没有统一 turn envelope 和 hindsight evaluation，直接让系统自动改 prompt/skill 很容易引入回归。

顺序应该是：

1. 先有细粒度证据
2. 再有 lesson distillation
3. 再有人工审阅或严格 gate
4. 最后才考虑自动 patch

## 对应到 Search-First 的结论

### 总体结论: `Compose`

#### Adopt

- 会话/回合标记协议
- `main` / `side` 的可学习过滤思想

#### Extend

- 把 `learn-eval` 从 checkpoint 汇总扩展到 turn/work-item hindsight
- 把 artifact telemetry 扩展成可蒸馏输入

#### Compose

- `ContextDB + learn-eval + memo + orchestrate + hindsight-eval + lesson distiller`

#### Build

- `aios` 自己的轻量学习闭环
- 不直接照搬 OpenClaw-RL 的训练框架

## 推荐实施顺序

### Phase 1: 先补数据模型

- 定义 interaction envelope
- 给 event/checkpoint/artifact 加 turn/work-item 关联
- 区分 main/side/verification/system-maintenance

### Phase 2: 再补后验学习

- 新增 hindsight-eval
- 新增 hint / correction / confidence 字段
- 给 learn-eval 增加对 hint 的消费能力

### Phase 3: 最后补自动蒸馏

- lesson distiller
- memo / gate / skill patch candidate
- 人工审阅或 verification gate 后再落库

## 最终判断

`OpenClaw-RL` 对 `aios` 最有价值的，不是 RL 本身，而是它对“边运行边收集、边后验评估、边持续优化”的闭环拆法。

如果把这个思路迁对了，`aios` 可以得到一个更实用的版本：

- 不训练模型权重
- 但能持续训练自己的执行框架
- 学到的是技能、记忆、门控和调度策略

这条路比直接引入在线微调，更符合 `aios` 当前的系统边界和投入产出比。
