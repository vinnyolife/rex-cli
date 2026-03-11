import { browserLauncher } from '../launcher.js';
import { applyActionPacing } from '../pacing.js';

export async function setInputFiles(
  selector: string,
  files: string[],
  profile: string = 'default'
) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('browser_set_input_files requires a non-empty files array');
  }

  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  const pacingDelayMs = await applyActionPacing();
  await page.locator(selector).setInputFiles(files);

  return {
    success: true,
    selector,
    fileCount: files.length,
    profile,
    pacingDelayMs,
  };
}
