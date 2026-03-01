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
