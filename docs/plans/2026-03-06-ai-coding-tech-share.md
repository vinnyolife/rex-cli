# AI Coding 技术分享大纲

> 分享时间：下周
> 主题：如何让 AI 写出靠谱的代码

---

## 一、核心问题

AI 写代码常见的两大坑：
1. **没规划，乱写** - 改着改着就跑偏了
2. **瞎编乱造** - 幻觉、API 不存在、逻辑错误

---

## 二、解决方案：规划 + 验证

### 2.1 规划能力（Planning Skills）

让 AI 先想清楚再动手，用三个核心技能：

#### 技能 1：`superpowers:brainstorming`
- **用途**：复杂任务开始前，先头脑风暴
- **效果**：列出所有可能方案，选最优路径
- **示例**：
  ```
  用户："帮我做一个小红书自动发布工具"
  AI：先用 brainstorming 分析
    - 方案 A：Selenium（稳定但慢）
    - 方案 B：Playwright（快但需要反检测）
    - 方案 C：官方 API（最稳但需要申请）
  → 选择方案 B + 反检测脚本
  ```

#### 技能 2：`superpowers:writing-plans`
- **用途**：多步骤任务，先写计划文档
- **效果**：生成 `docs/plans/YYYY-MM-DD-<topic>.md`，分步执行
- **示例**：
  ```markdown
  ## 计划：小红书自动发布
  1. 搭建 Playwright MCP 服务器
  2. 实现反检测脚本
  3. 封装发布笔记技能
  4. 添加错误重试机制
  5. 验证完整流程
  ```

#### 技能 3：`superpowers:dispatching-parallel-agents`
- **用途**：独立任务并行执行
- **效果**：多个子任务同时跑，提速 3-5 倍
- **示例**：
  ```
  任务：优化项目性能
  → 并行派发：
    - Agent A：分析前端打包体积
    - Agent B：检查后端 API 响应时间
    - Agent C：审查数据库查询性能
  ```

---

### 2.2 防止幻觉（Anti-Hallucination）

让 AI 产出的内容有据可查，用三个验证技能：

#### 技能 1：`superpowers:verification-before-completion`
- **用途**：任务完成前，强制验证
- **效果**：检查代码是否真的能跑、API 是否存在
- **示例**：
  ```
  AI 写完代码后：
  ✓ 运行测试用例
  ✓ 检查依赖是否安装
  ✓ 验证 API 文档
  ✗ 发现问题 → 自动修复
  ```

#### 技能 2：`superpowers:test-driven-development`
- **用途**：先写测试，再写实现
- **效果**：代码逻辑有测试保障，不会瞎编
- **示例**：
  ```javascript
  // 1. 先写测试
  test('发布笔记应该返回笔记 ID', async () => {
    const result = await publishNote({ title: '测试' });
    expect(result.noteId).toBeDefined();
  });

  // 2. 再写实现（AI 根据测试写代码）
  async function publishNote(data) { ... }
  ```

#### 技能 3：`search-first`
- **用途**：写代码前，先搜索现有方案
- **效果**：避免重复造轮子，参考成熟库
- **示例**：
  ```
  用户："帮我写一个 JWT 验证"
  AI：先搜索 → 发现 jsonwebtoken 库
  → 直接用成熟方案，不自己瞎写
  ```

---

## 三、提示词优化技巧

### 3.1 结构化提示词

❌ 差的提示词：
```
帮我写一个登录功能
```

✅ 好的提示词：
```
任务：实现用户登录功能
要求：
1. 使用 JWT 认证
2. 密码用 bcrypt 加密
3. 登录失败 3 次锁定账号 15 分钟
4. 返回格式：{ token, user: { id, name, email } }
约束：
- 不要用明文存储密码
- 不要自己实现加密算法
验证：
- 写单元测试覆盖正常/异常流程
```

### 3.2 分步执行

❌ 一次性要求：
```
帮我做一个完整的电商系统
```

✅ 分步执行：
```
第 1 步：先用 brainstorming 列出核心模块
第 2 步：用 writing-plans 写实现计划
第 3 步：用 parallel-agents 并行开发各模块
第 4 步：用 verification 验证集成
```

### 3.3 提供上下文

❌ 缺少上下文：
```
这个 bug 怎么修？
```

✅ 完整上下文：
```
项目：Node.js + Express + PostgreSQL
问题：用户登录后 token 过期时间不对
错误信息：[粘贴错误日志]
相关代码：[粘贴 auth.js 代码]
预期行为：token 应该 7 天过期，实际 1 小时就过期
```

---

## 四、实战演示（可选）

现场演示一个完整流程：

```
任务：给小红书助手添加"定时发布"功能

1. 用 brainstorming 分析方案
   → 选择 node-cron + 任务队列

2. 用 writing-plans 写计划
   → 生成 docs/plans/2026-03-06-scheduled-publish.md

3. 用 test-driven-development 写测试
   → 先写测试用例，再写实现

4. 用 parallel-agents 并行开发
   → Agent A：实现定时器
   → Agent B：实现任务队列
   → Agent C：实现发布接口

5. 用 verification-before-completion 验证
   → 运行测试、检查边界条件、验证错误处理
```

---

## 五、总结

AI Coding 的核心：
1. **规划先行** - brainstorming → writing-plans → parallel-agents
2. **验证保障** - test-driven → verification → search-first
3. **提示词优化** - 结构化、分步骤、给上下文

记住：AI 是工具，不是魔法。好的提示词 + 好的流程 = 靠谱的代码。

---

## 附录：常用技能速查

| 技能 | 用途 | 触发时机 |
|------|------|---------|
| `superpowers:brainstorming` | 头脑风暴 | 复杂任务开始前 |
| `superpowers:writing-plans` | 写计划 | 多步骤任务 |
| `superpowers:dispatching-parallel-agents` | 并行执行 | 独立子任务 |
| `superpowers:verification-before-completion` | 验证完成 | 任务结束前 |
| `superpowers:test-driven-development` | 测试驱动 | 写核心逻辑时 |
| `search-first` | 搜索方案 | 引入新依赖前 |
| `superpowers:systematic-debugging` | 系统调试 | 遇到复杂 bug |

---

**分享建议**：
- 重点讲"规划"和"验证"两部分（各 15 分钟）
- 提示词优化部分快速过（5 分钟）
- 留 10 分钟 Q&A
- 如果时间充裕，现场演示一个小功能开发
