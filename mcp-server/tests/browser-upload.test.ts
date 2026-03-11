import test from 'node:test';
import assert from 'node:assert/strict';

import { tools } from '../src/browser/index.js';
import { browserLauncher } from '../src/browser/launcher.js';
import { setInputFiles } from '../src/browser/actions/set-input-files.js';

test('browser_set_input_files schema exposes selector and files array', () => {
  const uploadTool = tools.find((tool) => tool.name === 'browser_set_input_files');

  assert.ok(uploadTool);
  const properties = (uploadTool?.inputSchema as any)?.properties ?? {};
  assert.equal('selector' in properties, true);
  assert.equal(properties.files?.type, 'array');
});

test('setInputFiles uses locator API on active page and returns file count', async () => {
  let usedSelector = '';
  let usedFiles: string[] = [];

  const page = {
    locator: (selector: string) => ({
      setInputFiles: async (files: string[]) => {
        usedSelector = selector;
        usedFiles = files;
      },
    }),
  };

  const originalGetState = browserLauncher.getState.bind(browserLauncher);
  browserLauncher.getState = (() => ({
    activePageId: 1,
    pages: new Map([[1, page]]),
  })) as typeof browserLauncher.getState;

  try {
    const result = await setInputFiles('input[type=file]', ['a.png', 'b.png'], 'default');

    assert.equal(result.success, true);
    assert.equal(result.selector, 'input[type=file]');
    assert.equal(result.fileCount, 2);
    assert.deepEqual(usedFiles, ['a.png', 'b.png']);
    assert.equal(usedSelector, 'input[type=file]');
  } finally {
    browserLauncher.getState = originalGetState;
  }
});
