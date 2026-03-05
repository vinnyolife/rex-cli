import { browserLauncher } from '../launcher.js';
import { detectChallengeRequired } from '../auth.js';

export async function challengeCheck(profile: string = 'default') {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  const challenge = await detectChallengeRequired(page);
  return {
    success: true,
    profile,
    challenge,
    requiresHumanAction: challenge.requiresHumanVerification,
  };
}
