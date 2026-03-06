const PptxGenJS = require("pptxgenjs");

// 创建演示文稿
const pres = new PptxGenJS();

// 设置幻灯片尺寸 (16:9)
pres.layout = "LAYOUT_WIDE";
pres.author = "Rex";
pres.title = "AI Coding 技术分享";
pres.subject = "如何让 AI 写出靠谱的代码";

// 配色方案
const COLORS = {
  primary: "1E3A5F",      // 深蓝色
  accent: "3B82F6",       // 亮蓝色
  success: "10B981",      // 绿色
  warning: "F59E0B",      // 橙色
  danger: "EF4444",       // 红色
  light: "F3F4F6",        // 浅灰
  dark: "1F2937",         // 深灰
  text: "374151",         // 文字颜色
  white: "FFFFFF"
};

// 辅助函数：创建标题幻灯片
function createTitleSlide(title, subtitle) {
  const slide = pres.addSlide();

  // 背景渐变
  slide.background = { type: "solid", color: COLORS.primary };

  // 装饰圆
  slide.addShape(pres.ShapeType.ellipse, {
    x: 8.5, y: -1, w: 3, h: 3,
    fill: { color: COLORS.accent, transparency: 50 }
  });
  slide.addShape(pres.ShapeType.ellipse, {
    x: -1, y: 4, w: 2, h: 2,
    fill: { color: COLORS.accent, transparency: 70 }
  });

  // 主标题
  slide.addText(title, {
    x: 0.5, y: 2.5, w: 9, h: 1.2,
    fontSize: 44, bold: true, color: COLORS.white,
    fontFace: "Microsoft YaHei", align: "left"
  });

  // 副标题
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 3.8, w: 9, h: 0.6,
      fontSize: 20, color: COLORS.white,
      fontFace: "Microsoft YaHei", align: "left"
    });
  }

  return slide;
}

// 辅助函数：创建内容幻灯片
function createContentSlide(title) {
  const slide = pres.addSlide();

  // 顶部装饰条
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.08,
    fill: { color: COLORS.accent }
  });

  // 标题
  slide.addText(title, {
    x: 0.5, y: 0.3, w: 12, h: 0.7,
    fontSize: 32, bold: true, color: COLORS.primary,
    fontFace: "Microsoft YaHei", align: "left"
  });

  return slide;
}

// 辅助函数：创建问题卡片
function createProblemCard(slide, title, content, x, y) {
  slide.addShape(pres.ShapeType.rect, {
    x: x, y: y, w: 5.5, h: 2.2,
    fill: { color: COLORS.light },
    line: { color: COLORS.danger, width: 2 }
  });

  slide.addText("❌ " + title, {
    x: x + 0.3, y: y + 0.2, w: 5, h: 0.5,
    fontSize: 20, bold: true, color: COLORS.danger,
    fontFace: "Microsoft YaHei"
  });

  slide.addText(content, {
    x: x + 0.3, y: y + 0.8, w: 5, h: 1.2,
    fontSize: 16, color: COLORS.text,
    fontFace: "Microsoft YaHei"
  });
}

// 辅助函数：创建技能卡片
function createSkillCard(slide, skillName, description, examples, x, y, color = COLORS.accent) {
  slide.addShape(pres.ShapeType.rect, {
    x: x, y: y, w: 12, h: 3.5,
    fill: { color: COLORS.white },
    line: { color: color, width: 1 }
  });

  // 技能名称标签
  slide.addShape(pres.ShapeType.rect, {
    x: x, y: y, w: 12, h: 0.5,
    fill: { color: color }
  });

  slide.addText("技能: " + skillName, {
    x: x + 0.2, y: y + 0.08, w: 11.6, h: 0.4,
    fontSize: 16, bold: true, color: COLORS.white,
    fontFace: "Microsoft YaHei"
  });

  // 用途
  slide.addText("用途: " + description, {
    x: x + 0.3, y: y + 0.65, w: 11.4, h: 0.5,
    fontSize: 14, color: COLORS.text,
    fontFace: "Microsoft YaHei"
  });

  // 示例
  slide.addText(examples, {
    x: x + 0.3, y: y + 1.3, w: 11.4, h: 2,
    fontSize: 12, color: COLORS.text,
    fontFace: "Microsoft YaHei"
  });
}

// ============ 幻灯片内容 ============

// 1. 封面
createTitleSlide("AI Coding 技术分享", "如何让 AI 写出靠谱的代码");

// 2. 核心问题
{
  const slide = createContentSlide("一、核心问题");
  slide.background = { color: COLORS.light };

  createProblemCard(slide, "没规划，乱写", "改着改着就跑偏了，需求越改越多", 0.6, 1.2);
  createProblemCard(slide, "瞎编乱造", "幻觉、API 不存在、逻辑错误", 6.8, 1.2);

  slide.addText("AI 写代码常见的两大坑", {
    x: 0.6, y: 3.8, w: 12, h: 0.5,
    fontSize: 24, bold: true, color: COLORS.primary,
    fontFace: "Microsoft YaHei", align: "center"
  });
}

// 3. 解决方案概览
{
  const slide = createContentSlide("二、解决方案：规划 + 验证");

  // 左侧 - 规划
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 1.3, w: 5.8, h: 3.5,
    fill: { color: COLORS.accent }
  });
  slide.addText("🗂️ 规划能力", {
    x: 0.7, y: 1.5, w: 5.4, h: 0.6,
    fontSize: 24, bold: true, color: COLORS.white,
    fontFace: "Microsoft YaHei"
  });
  slide.addText("• brainstorming\n• writing-plans\n• dispatching-parallel-agents", {
    x: 0.7, y: 2.3, w: 5.4, h: 2,
    fontSize: 18, color: COLORS.white,
    fontFace: "Microsoft YaHei"
  });

  // 右侧 - 验证
  slide.addShape(pres.ShapeType.rect, {
    x: 7, y: 1.3, w: 5.8, h: 3.5,
    fill: { color: COLORS.success }
  });
  slide.addText("✅ 验证保障", {
    x: 7.2, y: 1.5, w: 5.4, h: 0.6,
    fontSize: 24, bold: true, color: COLORS.white,
    fontFace: "Microsoft YaHei"
  });
  slide.addText("• verification\n• test-driven-development\n• search-first", {
    x: 7.2, y: 2.3, w: 5.4, h: 2,
    fontSize: 18, color: COLORS.white,
    fontFace: "Microsoft YaHei"
  });
}

// 4. 规划能力 - brainstorming
{
  const slide = createContentSlide("2.1 规划能力：brainstorming");
  createSkillCard(slide, "superpowers:brainstorming",
    "复杂任务开始前，先头脑风暴\n列出所有可能方案，选最优路径",
    "示例：\n用户：帮我做一个小红书自动发布工具\nAI：先用 brainstorming 分析\n  → 方案 A：Selenium\n  → 方案 B：Playwright\n  → 方案 C：官方 API\n  → 选择方案 B + 反检测脚本",
    0.6, 1.2
  );
}

// 5. 规划能力 - writing-plans
{
  const slide = createContentSlide("2.2 规划能力：writing-plans");
  createSkillCard(slide, "superpowers:writing-plans",
    "多步骤任务，先写计划文档\n生成 docs/plans/YYYY-MM-DD-<topic>.md",
    "示例：\n## 计划：小红书自动发布\n1. 搭建 Playwright MCP 服务器\n2. 实现反检测脚本\n3. 封装发布笔记技能\n4. 添加错误重试机制\n5. 验证完整流程",
    0.6, 1.2
  );
}

// 6. 规划能力 - parallel-agents
{
  const slide = createContentSlide("2.3 规划能力：dispatching-parallel-agents");
  createSkillCard(slide, "superpowers:dispatching-parallel-agents",
    "独立任务并行执行\n多个子任务同时跑，提速 3-5 倍",
    "示例：\n任务：优化项目性能\n→ 并行派发：\n  • Agent A：分析前端打包体积\n  • Agent B：检查后端 API 响应时间\n  • Agent C：审查数据库查询性能",
    0.6, 1.2
  );
}

// 7. 防止幻觉 - verification
{
  const slide = createContentSlide("3.1 防止幻觉：verification-before-completion");
  createSkillCard(slide, "superpowers:verification-before-completion",
    "任务完成前，强制验证\n检查代码是否真的能跑、API 是否存在",
    "示例：\nAI 写完代码后：\n✓ 运行测试用例\n✓ 检查依赖是否安装\n✓ 验证 API 文档\n✗ 发现问题 → 自动修复",
    0.6, 1.2, COLORS.success
  );
}

// 8. 防止幻觉 - TDD
{
  const slide = createContentSlide("3.2 防止幻觉：test-driven-development");
  createSkillCard(slide, "superpowers:test-driven-development",
    "先写测试，再写实现\n代码逻辑有测试保障，不会瞎编",
    "示例：\n// 1. 先写测试\ntest('发布笔记应返回笔记ID', async () => {\n  const result = await publishNote({title:'测试'});\n  expect(result.noteId).toBeDefined();\n});\n\n// 2. 再写实现\nasync function publishNote(data) { ... }",
    0.6, 1.2, COLORS.success
  );
}

// 9. 防止幻觉 - search-first
{
  const slide = createContentSlide("3.3 防止幻觉：search-first");
  createSkillCard(slide, "search-first",
    "写代码前，先搜索现有方案\n避免重复造轮子，参考成熟库",
    "示例：\n用户：帮我写一个 JWT 验证\nAI：先搜索 → 发现 jsonwebtoken 库\n→ 直接用成熟方案，不自己瞎写",
    0.6, 1.2, COLORS.success
  );
}

// 10. 提示词优化 - 结构化
{
  const slide = createContentSlide("四、提示词优化技巧");

  // 左侧 - 差的提示词
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 1.2, w: 5.8, h: 3.8,
    fill: { color: COLORS.white },
    line: { color: COLORS.danger, width: 2 }
  });
  slide.addText("❌ 差的提示词", {
    x: 0.7, y: 1.4, w: 5.4, h: 0.5,
    fontSize: 18, bold: true, color: COLORS.danger,
    fontFace: "Microsoft YaHei"
  });
  slide.addText("帮我写一个登录功能", {
    x: 0.7, y: 2.2, w: 5.4, h: 0.8,
    fontSize: 16, color: COLORS.text,
    fontFace: "Microsoft YaHei"
  });

  // 右侧 - 好的提示词
  slide.addShape(pres.ShapeType.rect, {
    x: 7, y: 1.2, w: 5.8, h: 3.8,
    fill: { color: COLORS.white },
    line: { color: COLORS.success, width: 2 }
  });
  slide.addText("✅ 好的提示词", {
    x: 7.2, y: 1.4, w: 5.4, h: 0.5,
    fontSize: 18, bold: true, color: COLORS.success,
    fontFace: "Microsoft YaHei"
  });
  slide.addText("任务：实现用户登录功能\n要求：\n1. 使用 JWT 认证\n2. 密码用 bcrypt 加密\n3. 登录失败 3 次锁定 15 分钟\n4. 返回格式：{ token, user }\n约束：\n- 不要用明文存储密码\n- 不要自己实现加密算法", {
    x: 7.2, y: 2.0, w: 5.4, h: 2.8,
    fontSize: 12, color: COLORS.text,
    fontFace: "Microsoft YaHei"
  });
}

// 11. 提示词优化 - 分步执行
{
  const slide = createContentSlide("四、提示词优化 - 分步执行");

  const steps = [
    "第 1 步：先用 brainstorming 列出核心模块",
    "第 2 步：用 writing-plans 写实现计划",
    "第 3 步：用 parallel-agents 并行开发各模块",
    "第 4 步：用 verification 验证集成"
  ];

  steps.forEach((step, i) => {
    slide.addShape(pres.ShapeType.rect, {
      x: 0.8, y: 1.2 + i * 0.9, w: 0.6, h: 0.6,
      fill: { color: COLORS.accent }
    });
    slide.addText(String(i + 1), {
      x: 0.8, y: 1.2 + i * 0.9, w: 0.6, h: 0.6,
      fontSize: 20, bold: true, color: COLORS.white,
      fontFace: "Microsoft YaHei", align: "center", valign: "middle"
    });
    slide.addText(step, {
      x: 1.6, y: 1.2 + i * 0.9, w: 10, h: 0.6,
      fontSize: 20, color: COLORS.text,
      fontFace: "Microsoft YaHei"
    });
  });

  // 对比
  slide.addText("❌ 一次性要求：帮我做一个完整的电商系统", {
    x: 0.8, y: 5.2, w: 12, h: 0.4,
    fontSize: 14, color: COLORS.danger,
    fontFace: "Microsoft YaHei"
  });
}

// 12. 实战演示流程
{
  const slide = createContentSlide("五、实战演示：定时发布功能");

  const steps = [
    "1. brainstorming 分析方案 → 选择 node-cron + 任务队列",
    "2. writing-plans 写计划 → docs/plans/2026-03-06-scheduled-publish.md",
    "3. test-driven-development → 先写测试用例，再写实现",
    "4. parallel-agents 并行开发",
    "   • Agent A：实现定时器 • Agent B：实现任务队列 • Agent C：实现发布接口",
    "5. verification-before-completion → 运行测试、检查边界条件、验证错误处理"
  ];

  steps.forEach((step, i) => {
    slide.addText(step, {
      x: 0.6, y: 1.1 + i * 0.75, w: 12, h: 0.7,
      fontSize: 16, color: COLORS.text,
      fontFace: "Microsoft YaHei"
    });
  });
}

// 13. 总结
{
  const slide = createContentSlide("六、总结");
  slide.background = { color: COLORS.primary };

  const summary = [
    { title: "1. 规划先行", desc: "brainstorming → writing-plans → parallel-agents" },
    { title: "2. 验证保障", desc: "test-driven → verification → search-first" },
    { title: "3. 提示词优化", desc: "结构化、分步骤、给上下文" }
  ];

  summary.forEach((item, i) => {
    slide.addShape(pres.ShapeType.rect, {
      x: 0.8, y: 1.3 + i * 1.1, w: 11.7, h: 0.9,
      fill: { color: COLORS.white, transparency: 90 }
    });
    slide.addText(item.title, {
      x: 1, y: 1.4 + i * 1.1, w: 3, h: 0.7,
      fontSize: 22, bold: true, color: COLORS.white,
      fontFace: "Microsoft YaHei"
    });
    slide.addText(item.desc, {
      x: 4, y: 1.4 + i * 1.1, w: 8, h: 0.7,
      fontSize: 18, color: COLORS.white,
      fontFace: "Microsoft YaHei"
    });
  });

  slide.addText("记住：AI 是工具，不是魔法。\n好的提示词 + 好的流程 = 靠谱的代码。", {
    x: 0.8, y: 4.8, w: 11.7, h: 0.8,
    fontSize: 20, color: COLORS.accent,
    fontFace: "Microsoft YaHei", align: "center"
  });
}

// 14. 附录：技能速查表
{
  const slide = createContentSlide("附录：常用技能速查");

  const tableData = [
    ["技能", "用途", "触发时机"],
    ["superpowers:brainstorming", "头脑风暴", "复杂任务开始前"],
    ["superpowers:writing-plans", "写计划", "多步骤任务"],
    ["superpowers:dispatching-parallel-agents", "并行执行", "独立子任务"],
    ["superpowers:verification-before-completion", "验证完成", "任务结束前"],
    ["superpowers:test-driven-development", "测试驱动", "写核心逻辑时"],
    ["search-first", "搜索方案", "引入新依赖前"],
    ["superpowers:systematic-debugging", "系统调试", "遇到复杂 bug"]
  ];

  // 绘制表格
  const startX = 0.5;
  const startY = 1.2;
  const colWidths = [3.5, 4.5, 3.5];
  const rowHeight = 0.5;

  tableData.forEach((row, rowIdx) => {
    const bgColor = rowIdx === 0 ? COLORS.primary : (rowIdx % 2 === 0 ? COLORS.light : COLORS.white);
    const textColor = rowIdx === 0 ? COLORS.white : COLORS.text;
    const isBold = rowIdx === 0;

    row.forEach((cell, colIdx) => {
      slide.addShape(pres.ShapeType.rect, {
        x: startX + colWidths.slice(0, colIdx).reduce((a, b) => a + b, 0),
        y: startY + rowIdx * rowHeight,
        w: colWidths[colIdx],
        h: rowHeight,
        fill: { color: bgColor },
        line: { color: COLORS.light, width: 0.5 }
      });
      slide.addText(cell, {
        x: startX + colWidths.slice(0, colIdx).reduce((a, b) => a + b, 0) + 0.1,
        y: startY + rowIdx * rowHeight,
        w: colWidths[colIdx] - 0.2,
        h: rowHeight,
        fontSize: isBold ? 14 : 12,
        bold: isBold,
        color: textColor,
        fontFace: "Microsoft YaHei",
        valign: "middle"
      });
    });
  });
}

// 15. 谢谢
createTitleSlide("谢谢！", "Q&A 交流时间");

// 保存文件
pres.writeFile({ fileName: "AI-Coding-技术分享.pptx" })
  .then(() => console.log("PPT 生成成功！"))
  .catch(err => console.error("生成失败:", err));
