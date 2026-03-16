import assert from 'node:assert/strict';
import test from 'node:test';

import { renderState } from '../lib/tui/render.mjs';
import { createInitialState, reduceState } from '../lib/tui/state.mjs';

test('skill picker renders descriptions for visible skills', () => {
  const state = createInitialState({
    catalogSkills: [
      {
        name: 'seo-geo-page-optimization',
        description: 'Optimize a page for SEO and GEO.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: false, project: false },
      },
      {
        name: 'skill-constraints',
        description: 'Operational constraints and best practices for skill execution.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: false, project: false },
      },
    ],
  });

  let next = reduceState(state, 'enter');
  for (let index = 0; index < 6; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'space');
  for (let index = 0; index < 3; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'enter');

  const output = renderState(next, '/tmp/project');
  assert.match(output, /seo-geo-page-optimization/);
  assert.match(output, /Optimize a page for SEO and GEO\./);
  assert.match(output, /skill-constraints/);
  assert.match(output, /Operational constraints and best practices for skill execution\./);
});
