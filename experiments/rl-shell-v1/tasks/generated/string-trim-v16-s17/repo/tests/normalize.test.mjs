import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeName } from '../src/normalize.mjs';

test('normalizeName trims outer whitespace', () => {
  assert.equal(normalizeName('  Alice  '), 'alice');
});
