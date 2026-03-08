import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAxSnapshotFromCdpNodes } from '../src/browser/actions/snapshot.js';

test('buildAxSnapshotFromCdpNodes disambiguates duplicate role selectors with nth', () => {
  const snapshot = buildAxSnapshotFromCdpNodes(
    'Example',
    'https://example.com/',
    [
      {
        nodeId: '1',
        role: { value: 'RootWebArea' },
        name: { value: 'Example' },
        backendDOMNodeId: 2,
        childIds: ['2'],
      },
      {
        nodeId: '2',
        role: { value: 'main' },
        backendDOMNodeId: 20,
        childIds: ['3', '4'],
      },
      {
        nodeId: '3',
        role: { value: 'textbox' },
        name: { value: 'Email' },
        backendDOMNodeId: 100,
        properties: [{ name: 'focusable', value: { value: true } }],
      },
      {
        nodeId: '4',
        role: { value: 'textbox' },
        name: { value: 'Email' },
        backendDOMNodeId: 101,
        properties: [{ name: 'focusable', value: { value: true } }],
      },
    ],
    { maxLines: 50, verbose: false }
  );

  assert.equal(snapshot.mode, 'ax-v1');
  assert.equal(snapshot.truncated, false);
  assert.ok(snapshot.text.includes('uid=b2 RootWebArea "Example" url="https://example.com/"'));

  assert.equal(snapshot.interactive.length, 2);
  assert.equal(snapshot.interactive[0].selectorHint, 'role=textbox[name="Email"] >> nth=0');
  assert.equal(snapshot.interactive[1].selectorHint, 'role=textbox[name="Email"] >> nth=1');
});

test('buildAxSnapshotFromCdpNodes truncates output by maxLines', () => {
  const snapshot = buildAxSnapshotFromCdpNodes(
    'Example',
    'https://example.com/',
    [
      {
        nodeId: '1',
        role: { value: 'RootWebArea' },
        name: { value: 'Example' },
        backendDOMNodeId: 2,
        childIds: ['2', '3'],
      },
      {
        nodeId: '2',
        role: { value: 'banner' },
        backendDOMNodeId: 10,
      },
      {
        nodeId: '3',
        role: { value: 'main' },
        backendDOMNodeId: 11,
      },
    ],
    { maxLines: 1, verbose: false }
  );

  assert.equal(snapshot.truncated, true);
  assert.match(snapshot.text, /uid=b2 RootWebArea/);
  assert.doesNotMatch(snapshot.text, /banner|main/);
});
