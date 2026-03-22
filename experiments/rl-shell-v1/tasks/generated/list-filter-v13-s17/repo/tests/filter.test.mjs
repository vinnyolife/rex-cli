import test from 'node:test';
import assert from 'node:assert/strict';

import { filterActive } from '../src/filter.mjs';

test('filterActive keeps only active items in original order', () => {
  assert.deepEqual(
    filterActive([{ id: 1, active: true }, { id: 2, active: false }, { id: 3, active: true }]),
    [{ id: 1, active: true }, { id: 3, active: true }]
  );
});
