# AIOS Learning Loop Architecture

> 这是基于 `OpenClaw-RL` 分析后，为 `aios` 提出的目标架构图。
> 核心思想不是在线训练模型权重，而是在线强化 `skills / memory / gates / dispatch policy`。

## High-Level Diagram

```mermaid
flowchart TB
  subgraph U["Execution Surfaces"]
    CLI["CLI Agents<br/>codex / claude / gemini"]
    BROWSER["Browser MCP<br/>browser_* tools"]
    ORCH["Orchestrate Runtime<br/>dispatch / preflight / subagents"]
    SHELL["Shell / Script Runs<br/>quality-gate / doctor / local commands"]
    HUMAN["Human Input<br/>memo / review / takeover / correction"]
  end

  subgraph C["Capture Layer"]
    CTX["ContextDB Core<br/>session / event / checkpoint / artifact"]
    ENV["Interaction Envelope<br/>sessionId / turnId / workItemId / turnType / environment / outcome"]
    TRACE["Execution Evidence<br/>logs / snapshots / DOM / stderr / artifacts"]
  end

  subgraph E["Evaluation Layer"]
    HINDSIGHT["Hindsight Eval<br/>judge previous step by next-state"]
    ADAPTERS["Environment Adapters<br/>browser / shell / orchestrate / memo"]
    SIGNALS["Signal Fusion<br/>verification + failureCategory + retry + textual hints"]
  end

  subgraph L["Learning Layer"]
    DISTILL["Lesson Distiller<br/>extract reusable lessons from recent sessions"]
    LEARN["Learn-Eval++<br/>promote / fix / observe with hindsight signals"]
  end

  subgraph A["Framework Assets"]
    MEMO["Workspace Memory<br/>memo / pinned memory"]
    SKILL["Skill Candidates<br/>skill patch / constraints / runbook updates"]
    GATE["Gate Candidates<br/>quality / auth / retry / clarity / human-gate"]
    POLICY["Dispatch Policy<br/>blueprint / executor / routing adjustments"]
  end

  subgraph V["Verification & Control"]
    REVIEW["Human Review Gate"]
    VERIFY["Verification Loop<br/>quality-gate / evidence checks / regression checks"]
  end

  CLI --> CTX
  BROWSER --> CTX
  ORCH --> CTX
  SHELL --> CTX
  HUMAN --> CTX

  CLI --> TRACE
  BROWSER --> TRACE
  ORCH --> TRACE
  SHELL --> TRACE
  HUMAN --> TRACE

  CTX --> ENV
  TRACE --> ENV
  ENV --> ADAPTERS
  ADAPTERS --> HINDSIGHT
  HINDSIGHT --> SIGNALS
  CTX --> SIGNALS

  SIGNALS --> DISTILL
  SIGNALS --> LEARN
  DISTILL --> MEMO
  DISTILL --> SKILL
  DISTILL --> GATE
  DISTILL --> POLICY
  LEARN --> GATE
  LEARN --> POLICY

  MEMO --> REVIEW
  SKILL --> REVIEW
  GATE --> REVIEW
  POLICY --> REVIEW

  REVIEW --> VERIFY
  VERIFY --> CLI
  VERIFY --> BROWSER
  VERIFY --> ORCH
  VERIFY --> SHELL
```

## Read Path

1. Execution surfaces keep working normally; no training loop blocks the user path.
2. Every meaningful action is captured into `ContextDB + Interaction Envelope + Evidence`.
3. `Hindsight Eval` uses the next state to judge the previous step.
4. `Signal Fusion` combines structured telemetry with natural-language correction signals.
5. `Lesson Distiller` and `Learn-Eval++` turn repeated evidence into framework improvements.
6. Proposed changes flow through review and verification before being fed back into runtime behavior.

## Component Intent

- `Interaction Envelope`
  - Standardize turn-level learning metadata.
  - Distinguish `main` vs `side` vs `verification` vs maintenance turns.

- `Environment Adapters`
  - Avoid one giant evaluator.
  - Let browser, shell, orchestrate, and memo domains emit different hindsight signals.

- `Hindsight Eval`
  - Evaluate step `t` from the feedback arriving at `t+1`.
  - Produce `success / correction / retry-needed / ambiguous` plus hints and confidence.

- `Lesson Distiller`
  - Convert repeated failures or strong corrections into reusable framework assets.

- `Framework Assets`
  - Strengthen the system by updating memory, skills, gates, and dispatch policy.

## Phase Mapping

- Phase 1
  - `Interaction Envelope`
  - turn/work-item linkage in `ContextDB` and harness artifacts

- Phase 2
  - `Hindsight Eval`
  - `Signal Fusion`
  - `Learn-Eval++`

- Phase 3
  - `Lesson Distiller`
  - review-gated promotion into `memo / skills / gates / dispatch policy`
