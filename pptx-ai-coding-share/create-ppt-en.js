const PptxGenJS = require("pptxgenjs");

// Create presentation
const pres = new PptxGenJS();

// Set slide size (16:9)
pres.layout = "LAYOUT_WIDE";
pres.author = "Rex";
pres.title = "AI Coding Best Practices";
pres.subject = "How to Make AI Write Reliable Code";

// Color scheme
const COLORS = {
  primary: "1E3A5F",      // Deep blue
  accent: "3B82F6",       // Bright blue
  success: "10B981",      // Green
  warning: "F59E0B",      // Orange
  danger: "EF4444",       // Red
  light: "F3F4F6",        // Light gray
  dark: "1F2937",         // Dark gray
  text: "374151",         // Text color
  white: "FFFFFF"
};

// Helper: Create title slide
function createTitleSlide(title, subtitle) {
  const slide = pres.addSlide();

  // Background gradient
  slide.background = { type: "solid", color: COLORS.primary };

  // Decorative circles
  slide.addShape(pres.ShapeType.ellipse, {
    x: 8.5, y: -1, w: 3, h: 3,
    fill: { color: COLORS.accent, transparency: 50 }
  });
  slide.addShape(pres.ShapeType.ellipse, {
    x: -1, y: 4, w: 2, h: 2,
    fill: { color: COLORS.accent, transparency: 70 }
  });

  // Main title
  slide.addText(title, {
    x: 0.5, y: 2.5, w: 9, h: 1.2,
    fontSize: 44, bold: true, color: COLORS.white,
    fontFace: "Arial", align: "left"
  });

  // Subtitle
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 3.8, w: 9, h: 0.6,
      fontSize: 20, color: COLORS.white,
      fontFace: "Arial", align: "left"
    });
  }

  return slide;
}

// Helper: Create content slide
function createContentSlide(title) {
  const slide = pres.addSlide();

  // Top decoration bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.08,
    fill: { color: COLORS.accent }
  });

  // Title
  slide.addText(title, {
    x: 0.5, y: 0.3, w: 12, h: 0.7,
    fontSize: 32, bold: true, color: COLORS.primary,
    fontFace: "Arial", align: "left"
  });

  return slide;
}

// Helper: Create problem card
function createProblemCard(slide, title, content, x, y) {
  slide.addShape(pres.ShapeType.rect, {
    x: x, y: y, w: 5.5, h: 2.2,
    fill: { color: COLORS.light },
    line: { color: COLORS.danger, width: 2 }
  });

  slide.addText("❌ " + title, {
    x: x + 0.3, y: y + 0.2, w: 5, h: 0.5,
    fontSize: 20, bold: true, color: COLORS.danger,
    fontFace: "Arial"
  });

  slide.addText(content, {
    x: x + 0.3, y: y + 0.8, w: 5, h: 1.2,
    fontSize: 16, color: COLORS.text,
    fontFace: "Arial"
  });
}

// Helper: Create skill card
function createSkillCard(slide, skillName, description, examples, x, y, color = COLORS.accent) {
  slide.addShape(pres.ShapeType.rect, {
    x: x, y: y, w: 12, h: 3.5,
    fill: { color: COLORS.white },
    line: { color: color, width: 1 }
  });

  // Skill name tag
  slide.addShape(pres.ShapeType.rect, {
    x: x, y: y, w: 12, h: 0.5,
    fill: { color: color }
  });

  slide.addText("Skill: " + skillName, {
    x: x + 0.2, y: y + 0.08, w: 11.6, h: 0.4,
    fontSize: 16, bold: true, color: COLORS.white,
    fontFace: "Arial"
  });

  // Usage
  slide.addText("Purpose: " + description, {
    x: x + 0.3, y: y + 0.65, w: 11.4, h: 0.5,
    fontSize: 14, color: COLORS.text,
    fontFace: "Arial"
  });

  // Examples
  slide.addText(examples, {
    x: x + 0.3, y: y + 1.3, w: 11.4, h: 2,
    fontSize: 12, color: COLORS.text,
    fontFace: "Arial"
  });
}

// ============ Slide Content ============

// 1. Cover
createTitleSlide("AI Coding Best Practices", "How to Make AI Write Reliable Code");

// 2. Core Problems
{
  const slide = createContentSlide("I. The Core Problems");
  slide.background = { color: COLORS.light };

  createProblemCard(slide, "No Planning, Just Coding", "Requirements keep changing, scope keeps expanding", 0.6, 1.2);
  createProblemCard(slide, "Hallucinations", "Fake APIs, non-existent functions, logic errors", 6.8, 1.2);

  slide.addText("The Two Biggest Pitfalls in AI Coding", {
    x: 0.6, y: 3.8, w: 12, h: 0.5,
    fontSize: 24, bold: true, color: COLORS.primary,
    fontFace: "Arial", align: "center"
  });
}

// 3. Solution Overview
{
  const slide = createContentSlide("II. Solution: Planning + Verification");

  // Left - Planning
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 1.3, w: 5.8, h: 3.5,
    fill: { color: COLORS.accent }
  });
  slide.addText("🗂️ Planning", {
    x: 0.7, y: 1.5, w: 5.4, h: 0.6,
    fontSize: 24, bold: true, color: COLORS.white,
    fontFace: "Arial"
  });
  slide.addText("• brainstorming\n• writing-plans\n• dispatching-parallel-agents", {
    x: 0.7, y: 2.3, w: 5.4, h: 2,
    fontSize: 18, color: COLORS.white,
    fontFace: "Arial"
  });

  // Right - Verification
  slide.addShape(pres.ShapeType.rect, {
    x: 7, y: 1.3, w: 5.8, h: 3.5,
    fill: { color: COLORS.success }
  });
  slide.addText("✅ Verification", {
    x: 7.2, y: 1.5, w: 5.4, h: 0.6,
    fontSize: 24, bold: true, color: COLORS.white,
    fontFace: "Arial"
  });
  slide.addText("• verification\n• test-driven-development\n• search-first", {
    x: 7.2, y: 2.3, w: 5.4, h: 2,
    fontSize: 18, color: COLORS.white,
    fontFace: "Arial"
  });
}

// 4. Planning - brainstorming
{
  const slide = createContentSlide("2.1 Planning: brainstorming");
  createSkillCard(slide, "superpowers:brainstorming",
    "Before complex tasks: brainstorm all possible approaches and choose the best path",
    "Example:\nUser: Build an automated posting tool\nAI: First uses brainstorming\n  → Option A: Selenium\n  → Option B: Playwright\n  → Option C: Official API\n  → Choose Option B + anti-detection scripts",
    0.6, 1.2
  );
}

// 5. Planning - writing-plans
{
  const slide = createContentSlide("2.2 Planning: writing-plans");
  createSkillCard(slide, "superpowers:writing-plans",
    "For multi-step tasks: write a plan document first\nGenerate docs/plans/YYYY-MM-DD-<topic>.md",
    "Example:\n## Plan: Automated Posting Tool\n1. Set up Playwright MCP server\n2. Implement anti-detection scripts\n3.封装发布笔记技能\n4. Add error retry mechanism\n5. Verify end-to-end flow",
    0.6, 1.2
  );
}

// 6. Planning - parallel-agents
{
  const slide = createContentSlide("2.3 Planning: dispatching-parallel-agents");
  createSkillCard(slide, "superpowers:dispatching-parallel-agents",
    "Execute independent tasks in parallel\nSpeed up 3-5x with multiple sub-agents",
    "Example:\nTask: Optimize project performance\n→ Dispatch in parallel:\n  • Agent A: Analyze bundle size\n  • Agent B: Check API response time\n  • Agent C: Review DB query performance",
    0.6, 1.2
  );
}

// 7. Prevent Hallucination - verification
{
  const slide = createContentSlide("3.1 Prevent Hallucination: verification-before-completion");
  createSkillCard(slide, "superpowers:verification-before-completion",
    "Force verification before task completion\nCheck if code actually runs, APIs actually exist",
    "Example:\nAfter AI writes code:\n✓ Run test cases\n✓ Check dependencies installed\n✓ Verify API documentation\n✗ Found issues → Auto-fix",
    0.6, 1.2, COLORS.success
  );
}

// 8. Prevent Hallucination - TDD
{
  const slide = createContentSlide("3.2 Prevent Hallucination: test-driven-development");
  createSkillCard(slide, "superpowers:test-driven-development",
    "Write tests first, then implementation\nCode logic is protected by tests, no more guessing",
    "Example:\n// 1. Write test first\ntest('publishNote should return noteId', async () => {\n  const result = await publishNote({title:'test'});\n  expect(result.noteId).toBeDefined();\n});\n\n// 2. Then write implementation\nasync function publishNote(data) { ... }",
    0.6, 1.2, COLORS.success
  );
}

// 9. Prevent Hallucination - search-first
{
  const slide = createContentSlide("3.3 Prevent Hallucination: search-first");
  createSkillCard(slide, "search-first",
    "Before writing code, search for existing solutions\nAvoid reinventing the wheel, use proven libraries",
    "Example:\nUser: Write a JWT validation\nAI: Search first → Found jsonwebtoken library\n→ Use proven solution instead of writing from scratch",
    0.6, 1.2, COLORS.success
  );
}

// 10. Prompt Optimization - Structure
{
  const slide = createContentSlide("IV. Prompt Optimization Tips");

  // Left - Bad prompt
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 1.2, w: 5.8, h: 3.8,
    fill: { color: COLORS.white },
    line: { color: COLORS.danger, width: 2 }
  });
  slide.addText("❌ Weak Prompt", {
    x: 0.7, y: 1.4, w: 5.4, h: 0.5,
    fontSize: 18, bold: true, color: COLORS.danger,
    fontFace: "Arial"
  });
  slide.addText("Help me write a login feature", {
    x: 0.7, y: 2.2, w: 5.4, h: 0.8,
    fontSize: 16, color: COLORS.text,
    fontFace: "Arial"
  });

  // Right - Good prompt
  slide.addShape(pres.ShapeType.rect, {
    x: 7, y: 1.2, w: 5.8, h: 3.8,
    fill: { color: COLORS.white },
    line: { color: COLORS.success, width: 2 }
  });
  slide.addText("✅ Strong Prompt", {
    x: 7.2, y: 1.4, w: 5.4, h: 0.5,
    fontSize: 18, bold: true, color: COLORS.success,
    fontFace: "Arial"
  });
  slide.addText("Task: Implement user login\nRequirements:\n1. Use JWT authentication\n2. Hash passwords with bcrypt\n3. Lock after 3 failed attempts for 15 min\n4. Return: { token, user }\nConstraints:\n- No plaintext password storage\n- Don't implement crypto yourself", {
    x: 7.2, y: 2.0, w: 5.4, h: 2.8,
    fontSize: 12, color: COLORS.text,
    fontFace: "Arial"
  });
}

// 11. Prompt Optimization - Step by Step
{
  const slide = createContentSlide("IV. Prompt Optimization - Step by Step");

  const steps = [
    "Step 1: Use brainstorming to list core modules",
    "Step 2: Use writing-plans to create implementation plan",
    "Step 3: Use parallel-agents to develop modules in parallel",
    "Step 4: Use verification to validate integration"
  ];

  steps.forEach((step, i) => {
    slide.addShape(pres.ShapeType.rect, {
      x: 0.8, y: 1.2 + i * 0.9, w: 0.6, h: 0.6,
      fill: { color: COLORS.accent }
    });
    slide.addText(String(i + 1), {
      x: 0.8, y: 1.2 + i * 0.9, w: 0.6, h: 0.6,
      fontSize: 20, bold: true, color: COLORS.white,
      fontFace: "Arial", align: "center", valign: "middle"
    });
    slide.addText(step, {
      x: 1.6, y: 1.2 + i * 0.9, w: 10, h: 0.6,
      fontSize: 20, color: COLORS.text,
      fontFace: "Arial"
    });
  });

  // Contrast
  slide.addText("❌ One-shot: Help me build a complete e-commerce system", {
    x: 0.8, y: 5.2, w: 12, h: 0.4,
    fontSize: 14, color: COLORS.danger,
    fontFace: "Arial"
  });
}

// 12. Live Demo Flow
{
  const slide = createContentSlide("V. Live Demo: Scheduled Publishing Feature");

  const steps = [
    "1. brainstorming → Choose node-cron + task queue",
    "2. writing-plans → docs/plans/2026-03-06-scheduled-publish.md",
    "3. test-driven-development → Write tests first, then implementation",
    "4. parallel-agents parallel development",
    "   • Agent A: Timer • Agent B: Task Queue • Agent C: Publish API",
    "5. verification-before-completion → Run tests, check edge cases, verify error handling"
  ];

  steps.forEach((step, i) => {
    slide.addText(step, {
      x: 0.6, y: 1.1 + i * 0.75, w: 12, h: 0.7,
      fontSize: 16, color: COLORS.text,
      fontFace: "Arial"
    });
  });
}

// 13. Summary
{
  const slide = createContentSlide("VI. Summary");
  slide.background = { color: COLORS.primary };

  const summary = [
    { title: "1. Plan First", desc: "brainstorming → writing-plans → parallel-agents" },
    { title: "2. Verify Always", desc: "test-driven → verification → search-first" },
    { title: "3. Optimize Prompts", desc: "Structure, steps, provide context" }
  ];

  summary.forEach((item, i) => {
    slide.addShape(pres.ShapeType.rect, {
      x: 0.8, y: 1.3 + i * 1.1, w: 11.7, h: 0.9,
      fill: { color: COLORS.white, transparency: 90 }
    });
    slide.addText(item.title, {
      x: 1, y: 1.4 + i * 1.1, w: 3, h: 0.7,
      fontSize: 22, bold: true, color: COLORS.white,
      fontFace: "Arial"
    });
    slide.addText(item.desc, {
      x: 4, y: 1.4 + i * 1.1, w: 8, h: 0.7,
      fontSize: 18, color: COLORS.white,
      fontFace: "Arial"
    });
  });

  slide.addText("Remember: AI is a tool, not magic.\nGood prompts + good processes = reliable code.", {
    x: 0.8, y: 4.8, w: 11.7, h: 0.8,
    fontSize: 20, color: COLORS.accent,
    fontFace: "Arial", align: "center"
  });
}

// 14. Appendix: Skills Quick Reference
{
  const slide = createContentSlide("Appendix: Skills Quick Reference");

  const tableData = [
    ["Skill", "Purpose", "When to Use"],
    ["superpowers:brainstorming", "Brainstorm", "Before complex tasks"],
    ["superpowers:writing-plans", "Write Plan", "Multi-step tasks"],
    ["superpowers:dispatching-parallel-agents", "Parallel Exec", "Independent sub-tasks"],
    ["superpowers:verification-before-completion", "Verify", "Before task completion"],
    ["superpowers:test-driven-development", "TDD", "When writing core logic"],
    ["search-first", "Search", "Before adding new dependencies"],
    ["superpowers:systematic-debugging", "Debug", "When encountering complex bugs"]
  ];

  // Draw table
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
        fontFace: "Arial",
        valign: "middle"
      });
    });
  });
}

// 15. Thank You
createTitleSlide("Thank You!", "Q&A Time");

// Save file
pres.writeFile({ fileName: "AI-Coding-Best-Practices.pptx" })
  .then(() => console.log("PPT generated successfully!"))
  .catch(err => console.error("Generation failed:", err));
