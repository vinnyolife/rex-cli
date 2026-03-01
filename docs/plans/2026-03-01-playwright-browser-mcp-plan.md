# Playwright 浏览器控制 MCP 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现基于 Playwright 的浏览器控制 MCP，参照 OpenClaw 架构，支持反检测和多人浏览 Profile

**Architecture:** 基于 Playwright 构建浏览器控制层，通过 MCP 协议暴露工具接口，支持多 Profile 管理

**Tech Stack:** Playwright, TypeScript, MCP SDK

---

## 阶段 1: 基础设置

### Task 1: 添加 Playwright 依赖

**Files:**
- Modify: `mcp-server/package.json`

**Step 1: 修改 package.json 添加 Playwright**

```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "playwright-core": "^1.40.0"
  }
}
```

**Step 2: 安装依赖**

Run: `cd mcp-server && npm install playwright@^1.40.0 playwright-core@^1.40.0`
Expected: 安装成功

**Step 3: 尝试安装浏览器**

Run: `cd mcp-server && npx playwright install chromium`
Expected: Chromium 安装成功

**Step 4: Commit**

```bash
git add mcp-server/package.json mcp-server/package-lock.json
git commit -m "feat: add playwright dependencies

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: 创建目录结构和类型定义

**Files:**
- Create: `mcp-server/src/browser/index.ts`
- Create: `mcp-server/src/browser/types.ts`

**Step 1: 创建 browser 目录**

Run: `mkdir -p mcp-server/src/browser`

**Step 2: 创建类型定义文件**

```typescript
// mcp-server/src/browser/types.ts
import type { Browser, BrowserContext, Page, Locator } from 'playwright';

export interface BrowserProfile {
  name: string;
  cdpPort?: number;
  cdpUrl?: string;
  color?: string;
  executablePath?: string;
  userDataDir?: string;
}

export interface ProfileState {
  browser: Browser | null;
  context: BrowserContext | null;
  pages: Map<number, Page>;
  activePageId: number | null;
}

export interface BrowserState {
  profiles: Map<string, ProfileState>;
  activeProfile: string | null;
}

export interface LaunchOptions {
  headless?: boolean;
  profile?: string;
  url?: string;
}

export interface NavigateOptions {
  url: string;
  profile?: string;
}

export interface ClickOptions {
  selector: string;
  profile?: string;
  double?: boolean;
}

export interface TypeOptions {
  selector: string;
  text: string;
  profile?: string;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  profile?: string;
}
```

**Step 3: Commit**

```bash
git add mcp-server/src/browser/types.ts
git commit -m "feat: add browser types and interfaces

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 阶段 2: 浏览器启动和 Profile 管理

### Task 3: 实现 Profile 管理器

**Files:**
- Create: `mcp-server/src/browser/profiles.ts`

**Step 1: 创建 Profile 管理器**

```typescript
// mcp-server/src/browser/profiles.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import type { BrowserProfile } from './types.js';

const PROFILES_DIR = path.join(process.cwd(), '.browser-profiles');

export class ProfileManager {
  private profiles: Map<string, BrowserProfile> = new Map();

  async init(): Promise<void> {
    try {
      await fs.mkdir(PROFILES_DIR, { recursive: true });
    } catch {
      // 目录已存在
    }
    await this.loadProfiles();
  }

  private async loadProfiles(): Promise<void> {
    const configPath = path.join(process.cwd(), 'config', 'browser-profiles.json');
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(data);
      if (config.profiles) {
        for (const [name, profile] of Object.entries(config.profiles)) {
          this.profiles.set(name, profile as BrowserProfile);
        }
      }
    } catch {
      // 配置文件不存在，使用默认
    }
  }

  getProfile(name: string): BrowserProfile | undefined {
    return this.profiles.get(name);
  }

  getAllProfiles(): Map<string, BrowserProfile> {
    return this.profiles;
  }

  setProfile(name: string, profile: BrowserProfile): void {
    this.profiles.set(name, profile);
  }

  getProfileDir(name: string): string {
    return path.join(PROFILES_DIR, name);
  }
}

export const profileManager = new ProfileManager();
```

**Step 2: Commit**

```bash
git add mcp-server/src/browser/profiles.ts
git commit -m "feat: add profile manager

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: 实现浏览器启动器

**Files:**
- Create: `mcp-server/src/browser/launcher.ts`

**Step 1: 创建浏览器启动器**

```typescript
// mcp-server/src/browser/launcher.ts
import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import type { BrowserProfile, ProfileState } from './types.js';
import { profileManager } from './profiles.js';

// 反检测启动参数
const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-infobars',
  '--disable-browser-side-navigation',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor',
  '--ignore-certificate-errors',
  '--disable-extensions',
  '--disable-plugins',
  '--disable-default-apps',
  '--disable-background-networking',
  '--disable-sync',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-first-run',
  '--safebrowsing-disable-auto-update',
];

// 反检测注入脚本
const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
  window.chrome = { runtime: {} };
`;

export class BrowserLauncher {
  private state: Map<string, ProfileState> = new Map();
  private pageIdCounter = 0;

  async launch(profileName: string = 'default', url?: string): Promise<ProfileState> {
    if (this.state.has(profileName)) {
      const existing = this.state.get(profileName)!;
      if (existing.browser?.isConnected()) {
        return existing;
      }
    }

    const profile = profileManager.getProfile(profileName) || { name: profileName };
    const profileDir = profileManager.getProfileDir(profileName);

    // 确保 profile 目录存在
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    const browser = await chromium.launch({
      headless: false,
      args: STEALTH_ARGS,
      executablePath: profile.executablePath,
      userDataDir: profileDir,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    // 注入反检测脚本
    await context.addInitScript(STEALTH_SCRIPT);

    const state: ProfileState = {
      browser,
      context,
      pages: new Map(),
      activePageId: null,
    };

    this.state.set(profileName, state);

    // 创建第一个页面
    if (url) {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const pageId = ++this.pageIdCounter;
      state.pages.set(pageId, page);
      state.activePageId = pageId;
    }

    return state;
  }

  getState(profileName: string): ProfileState | undefined {
    return this.state.get(profileName);
  }

  getActivePage(profileName: string) {
    const state = this.state.get(profileName);
    if (!state || state.activePageId === null) return null;
    return state.pages.get(state.activePageId);
  }

  async close(profileName: string): Promise<void> {
    const state = this.state.get(profileName);
    if (!state) return;

    if (state.context) {
      await state.context.close();
    }
    if (state.browser) {
      await state.browser.close();
    }

    this.state.delete(profileName);
  }
}

export const browserLauncher = new BrowserLauncher();
```

**Step 2: Commit**

```bash
git add mcp-server/src/browser/launcher.ts
git commit -m "feat: add browser launcher with stealth

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 阶段 3: 浏览器操作实现

### Task 5: 实现导航操作

**Files:**
- Create: `mcp-server/src/browser/actions/navigate.ts`

**Step 1: 创建导航模块**

```typescript
// mcp-server/src/browser/actions/navigate.ts
import { browserLauncher } from '../launcher.js';

export async function navigate(url: string, profile: string = 'default') {
  const state = browserLauncher.getState(profile);
  if (!state || !state.context) {
    await browserLauncher.launch(profile, url);
    return { success: true, url, profile };
  }

  const page = await state.context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  const pageId = ++browserLauncher['pageIdCounter'];
  state.pages.set(pageId, page);
  state.activePageId = pageId;

  return {
    success: true,
    url: await page.url(),
    title: await page.title(),
    pageId,
    profile,
  };
}
```

**Step 2: Commit**

```bash
git add mcp-server/src/browser/actions/navigate.ts
git commit -m "feat: add navigate action

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: 实现点击操作

**Files:**
- Create: `mcp-server/src/browser/actions/click.ts`

**Step 1: 创建点击模块**

```typescript
// mcp-server/src/browser/actions/click.ts
import { browserLauncher } from '../launcher.js';

export async function click(selector: string, profile: string = 'default', double: boolean = false) {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  await page.click(selector, { double });

  return {
    success: true,
    selector,
    action: double ? 'double-click' : 'click',
    profile,
  };
}
```

**Step 2: Commit**

```bash
git add mcp-server/src/browser/actions/click.ts
git commit -m "feat: add click action

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: 实现输入操作

**Files:**
- Create: `mcp-server/src/browser/actions/type.ts`

**Step 1: 创建输入模块**

```typescript
// mcp-server/src/browser/actions/type.ts
import { browserLauncher } from '../launcher.js';

export async function type(selector: string, text: string, profile: string = 'default') {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  await page.fill(selector, text);

  return {
    success: true,
    selector,
    textLength: text.length,
    profile,
  };
}
```

**Step 2: Commit**

```bash
git add mcp-server/src/browser/actions/type.ts
git commit -m "feat: add type action

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: 实现快照和截图

**Files:**
- Create: `mcp-server/src/browser/actions/snapshot.ts`
- Create: `mcp-server/src/browser/actions/screenshot.ts`

**Step 1: 创建快照模块**

```typescript
// mcp-server/src/browser/actions/snapshot.ts
import { browserLauncher } from '../launcher.js';

export async function snapshot(profile: string = 'default') {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  const html = await page.content();
  const title = await page.title();
  const url = page.url();

  return {
    success: true,
    html: html.substring(0, 50000), // 限制大小
    title,
    url,
    profile,
  };
}
```

**Step 2: 创建截图模块**

```typescript
// mcp-server/src/browser/actions/screenshot.ts
import { browserLauncher } from '../launcher.js';

export async function screenshot(fullPage: boolean = false, profile: string = 'default') {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  const buffer = await page.screenshot({ fullPage });

  return {
    success: true,
    image: buffer.toString('base64'),
    fullPage,
    profile,
  };
}
```

**Step 3: Commit**

```bash
git add mcp-server/src/browser/actions/snapshot.ts mcp-server/src/browser/actions/screenshot.ts
git commit -m "feat: add snapshot and screenshot actions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 阶段 4: MCP 工具集成

### Task 9: 整合所有工具到 browser/index.ts

**Files:**
- Create: `mcp-server/src/browser/index.ts`

**Step 1: 创建主入口文件**

```typescript
// mcp-server/src/browser/index.ts
import { profileManager } from './profiles.js';
import { browserLauncher } from './launcher.js';
import { navigate } from './actions/navigate.js';
import { click } from './actions/click.js';
import { type } from './actions/type.js';
import { snapshot } from './actions/snapshot.js';
import { screenshot } from './actions/screenshot.js';

export {
  profileManager,
  browserLauncher,
  navigate,
  click,
  type,
  snapshot,
  screenshot,
};

// MCP 工具定义
export const tools = [
  {
    name: 'browser_launch',
    description: 'Launch browser with optional profile',
    inputSchema: {
      type: 'object',
      properties: {
        profile: { type: 'string', default: 'default' },
        url: { type: 'string' },
      },
    },
  },
  {
    name: 'browser_navigate',
    description: 'Navigate to URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        profile: { type: 'string', default: 'default' },
      },
    },
  },
  {
    name: 'browser_click',
    description: 'Click element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        profile: { type: 'string', default: 'default' },
        double: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'browser_type',
    description: 'Type text into element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text: { type: 'string' },
        profile: { type: 'string', default: 'default' },
      },
    },
  },
  {
    name: 'browser_snapshot',
    description: 'Get page snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        profile: { type: 'string', default: 'default' },
      },
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Take screenshot',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', default: false },
        profile: { type: 'string', default: 'default' },
      },
    },
  },
];
```

**Step 2: Commit**

```bash
git add mcp-server/src/browser/index.ts
git commit -m "feat: add browser module entry point with tools

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: 更新 MCP Server 主入口

**Files:**
- Modify: `mcp-server/src/index.ts`

**Step 1: 读取现有 index.ts**

Run: `cat mcp-server/src/index.ts`

**Step 2: 添加浏览器工具集成**

```typescript
// 在文件顶部添加导入
import { tools, navigate, click, type, snapshot, screenshot, browserLauncher } from './browser/index.js';

// 在 toolHandlers 中添加工具处理
const toolHandlers: Record<string, (args: any) => Promise<any>> = {
  // ... 现有 handlers

  // 浏览器工具
  browser_launch: async (args) => {
    const { profile = 'default', url } = args;
    const state = await browserLauncher.launch(profile, url);
    return { success: true, profile };
  },

  browser_navigate: async (args) => {
    return await navigate(args.url, args.profile);
  },

  browser_click: async (args) => {
    return await click(args.selector, args.profile, args.double);
  },

  browser_type: async (args) => {
    return await type(args.selector, args.text, args.profile);
  },

  browser_snapshot: async (args) => {
    return await snapshot(args.profile);
  },

  browser_screenshot: async (args) => {
    return await screenshot(args.fullPage, args.profile);
  },
};
```

**Step 3: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "feat: integrate browser tools into MCP server

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: 测试编译

**Step 1: 编译 TypeScript**

Run: `cd mcp-server && npm run build`
Expected: 编译成功，无错误

**Step 2: Commit**

```bash
git add .
git commit -m "feat: complete browser MCP implementation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 阶段 5: 验证

### Task 12: 验证浏览器启动

**Step 1: 启动 MCP Server 测试**

Run: `cd mcp-server && timeout 10 npm run dev || true`
Expected: Server 启动成功

**Step 2: 手动测试浏览器功能**

1. 配置 Claude Code 使用新的 MCP Server
2. 测试 `browser_launch` 工具
3. 测试 `browser_navigate` 导航到 xiaohongshu.com
4. 验证反检测效果

---

## 完成

**Plan complete and saved to `docs/plans/2026-03-01-playwright-browser-mcp-plan.md`.**

Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
