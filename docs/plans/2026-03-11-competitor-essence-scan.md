# 竞品精华点扫描（Memos + Local‑first 笔记/知识库）

> 快扫时间：2026-03-11  
> 扫描范围：`temp/research/memos` + `temp/research/competitors/*`（以 README/关键 docs 为主，不做逐行代码审计）  
> 目标：提炼“能迁移到我们系统里的精华点”，并给出下一轮强化补丁方向（ROI 优先）

## TL;DR（最值得抄的 10 个点）

1. **“文件优先”是可迁移性护城河**：把 Markdown/附件作为长期真相（source of truth），DB/索引都是缓存或派生物（Flatnotes / Notable / QOwnNotes / Logseq）。
2. **索引与存储解耦**：允许外部编辑文件；应用只缓存搜索索引并增量更新（Flatnotes 的“只缓存搜索索引”思路很干净）。
3. **“快速捕捉 + 快速打开”决定使用频次**：时间线/Inbox、全局搜索快捷键、Quick Open/命令面板（Memos / Flatnotes / Notable）。
4. **可编程性 = 长期生命力**：Lua/JS/QML/插件/模板/命令（SilverBullet / TiddlyWiki / Trilium / Logseq / QOwnNotes）。
5. **多空间/多库是“自然的多账号模型”**：space/vault/graph/workspace 作为隔离边界（Dendron vault / Logseq graph / Trilium tree+clone / Outline workspace）。
6. **安全的“默认值”最重要**：默认本地绑定、强制鉴权、2FA/SSO/访问码（Trilium OIDC+TOTP、SiYuan accessAuthCode、Flatnotes 2FA、Standard Notes/Notesnook/Joplin E2EE）。
7. **端到端加密（E2EE）是云同步时代的门槛**：零知识同步 + 客户端密钥管理（Standard Notes / Notesnook / Joplin）。
8. **协作/同步的真正成本在“冲突与一致性”**：CRDT/RTC（AFFiNE y-octo/Yjs、Logseq DB version RTC），并明确提示“可能数据丢失+备份策略”。
9. **结构化知识的核心不是 UI，而是“可查询数据模型”**：属性/对象/查询语言/SQL embed（Trilium attributes+query、SilverBullet objects+queries、SiYuan SQL query embed）。
10. **许可证是“能不能抄代码”的硬门槛**：BSL/AGPL 项目很多，只能借鉴思路，避免 copy‑paste（Outline BSL；AppFlowy/SiYuan/HedgeDoc/Logseq 等 AGPL）。

## 快照清单（本地克隆时的 HEAD）

| repo | sha | license（粗读） |
|---|---:|---|
| `usememos/memos` | `f4154d0` | MIT |
| `AppFlowy-IO/AppFlowy` | `bbe886f` | AGPL |
| `TiddlyWiki/TiddlyWiki5` | `846deb3` | BSD‑3‑Clause（文件名为 `license`） |
| `TriliumNext/Trilium` | `7295138` | AGPL |
| `Zettlr/Zettlr` | `8611c43` | GPL |
| `athensresearch/athens` | `b463a97` | EPL‑1.0（且已停更） |
| `dendronhq/dendron` | `4420715` | Apache‑2.0（且 maintenance only） |
| `dullage/flatnotes` | `0fdd0fd` | MIT |
| `hedgedoc/hedgedoc` | `d99c311` | AGPL |
| `laurent22/joplin` | `4abe83f` | 默认 AGPL‑3.0‑or‑later（子目录可能不同 LICENSE） |
| `logseq/logseq` | `c1a9bee` | AGPL |
| `marktext/marktext` | `be81e3a` | MIT |
| `notable/notable` | `aee9598` | 仅旧版本开源（README 提示） |
| `outline/outline` | `0d8d9a1` | BSL‑1.1 |
| `pbek/QOwnNotes` | `184e82b` | GPL |
| `silverbulletmd/silverbullet` | `0cc7091` | MIT（LICENSE.md 内容等价 MIT） |
| `siyuan-note/siyuan` | `297bd52` | AGPL |
| `standardnotes/app` | `ffd55a7` | AGPL |
| `streetwriters/notesnook` | `dda36bb` | GPL |
| `toeverything/AFFiNE` | `9844ca4` | 以 MIT 为主，但部分目录有单独 LICENSE（见仓库说明） |

> 备注：许可证仅用于“快速合规提醒”，真实以各仓库 `LICENSE*`/目录内 LICENSE 为准。

## 核心主题提炼（抽象成可复用模式）

### 1) Storage：File‑first vs DB‑first vs Block‑first

- **File‑first**（Flatnotes/Notable/QOwnNotes/Dendron/Logseq*）：Markdown/附件放在可见目录，外部工具随便改；应用负责 UI + 索引 + 约束。
- **DB‑first**（Memos/Joplin/Trilium/SilverBullet/SiYuan*）：更强的一致性与结构化能力，代价是迁移与外部编辑门槛更高。
- **Block‑first**（AFFiNE/SiYuan/部分 Logseq DB）：以块/对象为基本单元，更适合协作、视图（表/画布），但导出/可移植要额外设计。

我们的启示：**如果未来要“跨项目/跨工具长期可用”，文件优先会显著降低维护成本；如果要“强结构+强查询”，就必须把“导出/迁移”当作一等公民。**

### 2) Search/Index：索引是缓存，必须可重建

- Flatnotes 典型：**只缓存搜索索引**，并在启动/搜索时增量同步；允许外部修改 markdown 文件。
- 大多数项目都把“全文检索”当作核心体验（Joplin/Trilium/Zettlr 等）。

我们的启示：**把 L0/L1/L2 当“分层缓存/派生物”的设计是对的**；关键是做到“索引可重建、不会被索引绑架数据”。

### 3) Security：默认安全 + 清晰的威胁模型

- **E2EE/零知识同步**：Standard Notes / Notesnook / Joplin。
- **本地访问码/鉴权**：SiYuan 的 `--accessAuthCode`；Flatnotes 多种鉴权含 2FA；Trilium 有 OIDC/TOTP。
- **协作/对外服务**：Outline/hedgedoc 强调权限与协作，但许可证与部署复杂度更高。

我们的启示：如果我们“主要本地开发”，优先级应是：**默认只绑定本地 + 明确的 token 鉴权 + 最小暴露面**；等需要公网/团队再做 SSO/细粒度权限/审计。

### 4) Extensibility：脚本化/插件化让系统“越用越顺”

- SilverBullet（Lua）、TiddlyWiki（WikiText/插件）、Trilium（attributes+脚本）、Logseq（插件）、QOwnNotes（脚本库）。

我们的启示：我们已经有“skills/脚本”的天然扩展点，下一步是让它**更像“可组合的命令/模板/查询”**，而不是一次性脚本。

### 5) Multi‑space：把隔离边界做成一等概念

- Dendron vault、Logseq graph、Outline workspace、Trilium tree+cloning（同一内容多处引用）。

我们的启示：多账号运营并不是“小众需求”，它只是“多空间”的一个具体场景。**space 是正确抽象**。

## 单品精华（按“我们能学什么”写）

- **Memos**：时间线优先的快速捕捉；Markdown 可携带；单二进制+轻部署；开放 REST/gRPC API。
- **Flatnotes**：纯文件 Markdown（无 DB）；“只缓存搜索索引”；全局快捷搜索（`/`）；多种鉴权含 2FA；REST API。
- **Standard Notes**：E2EE + 零知识同步；客户端把加密/密钥管理抽到共享库；扩展/主题生态；可自建同步服务器。
- **Notesnook**：零知识理念强调（设备端全加密）；libsodium（XChaCha20‑Poly1305/Argon2）；跨端共享 core/crypto；含 Web Clipper。
- **Joplin**：offline‑first；E2EE 同步；插件/主题；全文检索；Web Clipper；导入导出能力强。
- **AFFiNE**：Doc+Canvas+Table 融合；local‑first + 实时协作（CRDT/Yjs/y‑octo）；底层数据引擎（OctoBase/Rust）；插件生态在路上。
- **Logseq**：隐私与用户控制；Markdown/Org；插件与主题；DB 版引入 SQLite 图谱 + RTC，并显式提醒备份/可能数据丢失。
- **SilverBullet**：Markdown 空间（Space）+ 双向链接；Lua 可编程（命令/模板/小组件/动态生成内容）；适合“可编程知识库”。
- **Trilium**：树状层级 + cloning；版本历史；属性/查询/脚本；强导航与可视化；每笔记加密；OIDC/TOTP；自建同步与分享；REST API。
- **TiddlyWiki**：单 HTML 文件即可“带着走”；UI 自身可黑客；极强可定制，适合作为“可编程笔记内核”范式参考。
- **Outline**：面向团队的知识库/协作；工程化程度高；但 BSL 许可证，借鉴思路即可。
- **AppFlowy / SiYuan**：Notion 替代路线；块级引用/数据库视图/模板/市场；同时都强调“数据控制”；但 AGPL + 体系庞大，适合只抽象思想。
- **HedgeDoc**：实时协作 Markdown；适合参考“协作/权限/共享”的产品面，但不适合直接搬代码（AGPL）。
- **Dendron**：IDE 内的“可扩展知识库”；schema/引用/重构/发布；但已 maintenance only。
- **QOwnNotes**：文件优先 + Nextcloud/文件同步；多目录；脚本仓库；加密可插拔；外部文件变更监测与差异提示。
- **Zettlr / MarkText**：编辑器工程与写作流（导出/引用/搜索/主题），更多是 UX 参考。
- **Athens**：已停更；仍可参考其离线同步事件模型文档（`src/cljc/event_sync/README.md`）的“阶段化思路”。

## 对我们系统的映射（结合“已做”和“下一步”）

### 已落地（本轮已完成）

- **快速捕捉**：`aios memo`（写入既有 ContextDB L2），并支持 `space`（多账号/多项目隔离）。
- **工作区常驻记忆**：`pinned.md` + workspace‑memory overlay（会话注入 pinned + 最近 memos）。
- **防护**：MCP HTTP 可选，默认 `127.0.0.1`，并支持 `Authorization: Bearer $MCP_HTTP_TOKEN`（最小暴露面）。

### 下一轮强化建议（按 ROI 排序）

1. **“文件优先”出口（Export as Truth）**  
   - 目标：把关键记忆（pinned + memos）随时导出成可读 Markdown/JSONL，便于 git/外部工具处理与迁移。  
   - 参考：Flatnotes/Notable/QOwnNotes 的“别绑架用户数据”原则。

2. **workspace‑memory 防泄露（Privacy Guard）**  
   - 目标：对“常驻记忆/最近 memos”的注入做更明确的边界控制（space 级隔离、敏感字段遮罩、可解释的注入日志）。  
   - 参考：Standard Notes/Notesnook 的“威胁模型清晰化”与 Trilium/SiYuan 的“访问边界”。

3. **索引可重建与性能护栏**  
   - 目标：明确 L0/L1/L2 的缓存与重建机制（重建命令、上限策略、慢查询降级）。  
   - 参考：Flatnotes “索引是缓存”、Logseq “备份/风险提示”。

4. **“命令化”技能生态（可组合命令/模板）**  
   - 目标：让技能更像 SilverBullet/Trilium 的“命令/模板/查询”，形成可复用的工作流积木。

> 协作/CRDT/E2EE 同步属于“成本高但收益大”的路线，建议等明确需要跨设备/团队协作时再上（参考 AFFiNE/Logseq 的复杂度）。

## 合规/抄作业边界（强提醒）

- **只抄思路，不 copy‑paste 代码**：竞品里 AGPL/BSL 比例高（Outline BSL；多家 AGPL），直接拷代码会把我们项目拖进许可证义务。
- 真要复用代码：必须先明确我们仓库目标许可证与分发方式，并做依赖/隔离（例如独立进程/插件边界）后再评估。

