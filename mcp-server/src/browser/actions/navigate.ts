// mcp-server/src/browser/actions/navigate.ts
import { browserLauncher } from '../launcher.js';
import { detectAuthRequired, detectChallengeRequired } from '../auth.js';
import { applyActionPacing } from '../pacing.js';

export async function navigate(url: string, profile: string = 'default', newTab: boolean = false) {
  const state = browserLauncher.getState(profile);
  if (!state || !state.context) {
    await browserLauncher.launch(profile, url);
    return { success: true, url, profile };
  }

  let pageId: number;
  let page;

  if (!newTab && state.activePageId !== null && state.pages.has(state.activePageId)) {
    pageId = state.activePageId;
    page = state.pages.get(pageId)!;
  } else {
    page = await state.context.newPage();
    pageId = ++browserLauncher.pageIdCounter;
    state.pages.set(pageId, page);
    state.activePageId = pageId;
  }

  const pacingDelayMs = await applyActionPacing();
  await page.goto(url, { waitUntil: 'networkidle' });
  const [auth, challenge] = await Promise.all([
    detectAuthRequired(page),
    detectChallengeRequired(page),
  ]);

  return {
    success: true,
    url: await page.url(),
    title: await page.title(),
    pageId,
    profile,
    pacingDelayMs,
    auth,
    challenge,
    requiresHumanAction: auth.requiresHumanLogin || challenge.requiresHumanVerification,
  };
}
