// mcp-server/src/browser/actions/snapshot.ts
import { browserLauncher } from '../launcher.js';
import { detectAuthRequired, detectChallengeRequired } from '../auth.js';
import { applyActionPacing } from '../pacing.js';

export async function snapshot(profile: string = 'default') {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  const pacingDelayMs = await applyActionPacing();
  const html = await page.content();
  const title = await page.title();
  const url = page.url();
  const [auth, challenge] = await Promise.all([
    detectAuthRequired(page),
    detectChallengeRequired(page),
  ]);

  return {
    success: true,
    html: html.substring(0, 50000), // 限制大小
    title,
    url,
    profile,
    pacingDelayMs,
    auth,
    challenge,
    requiresHumanAction: auth.requiresHumanLogin || challenge.requiresHumanVerification,
  };
}
