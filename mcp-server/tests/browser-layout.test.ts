import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHybridLayoutModel } from '../src/browser/actions/snapshot.js';

test('buildHybridLayoutModel returns compact layout regions for editor-like pages', () => {
  const result = buildHybridLayoutModel({
    title: 'Create post',
    url: 'https://social.example.com/publish',
    viewport: { width: 1440, height: 900 },
    textSample: 'Create a new post\nDraft saved\nPublish',
    stats: {
      imageCount: 2,
      canvasCount: 0,
      modalCount: 0,
      textNodeCount: 5,
      interactiveCount: 4,
    },
    elements: [
      {
        role: 'button',
        tag: 'button',
        text: 'Publish',
        selectorHint: '#publish',
        clickable: true,
        x: 1260,
        y: 24,
        width: 120,
        height: 40,
        zIndex: 10,
      },
      {
        role: 'textbox',
        tag: 'textarea',
        text: 'Write your post',
        selectorHint: 'textarea.compose',
        clickable: true,
        x: 280,
        y: 180,
        width: 760,
        height: 260,
        zIndex: 1,
      },
      {
        role: 'navigation',
        tag: 'nav',
        text: 'Home Analytics Posts',
        selectorHint: 'nav.sidebar',
        clickable: false,
        x: 0,
        y: 90,
        width: 220,
        height: 760,
        zIndex: 1,
      },
    ],
    textBlocks: [
      {
        text: 'Create a new post',
        x: 280,
        y: 120,
        width: 300,
        height: 30,
      },
    ],
  });

  assert.equal(result.pageSummary.pageType, 'editor');
  assert.equal(result.visualHints.needsVisualFallback, false);
  assert.equal(result.regions.some((region) => region.name === 'header'), true);
  assert.equal(result.regions.some((region) => region.name === 'left-sidebar'), true);
  assert.equal(result.regions.some((region) => region.name === 'main'), true);
  assert.equal(result.elements.some((element) => element.selectorHint === '#publish'), true);
});

test('buildHybridLayoutModel does not misclassify generic content pages as editors', () => {
  const result = buildHybridLayoutModel({
    title: 'Content page',
    url: 'https://content.example.com/',
    viewport: { width: 1280, height: 720 },
    textSample: 'This content page contains a search box and an inline help section.',
    stats: {
      imageCount: 0,
      canvasCount: 0,
      modalCount: 0,
      textNodeCount: 1,
      interactiveCount: 1,
    },
    elements: [
      {
        role: 'textbox',
        tag: 'input',
        text: 'Search content',
        selectorHint: 'input.search',
        clickable: true,
        x: 20,
        y: 20,
        width: 260,
        height: 36,
        zIndex: 1,
      },
    ],
    textBlocks: [
      {
        text: 'This is a content page.',
        x: 20,
        y: 80,
        width: 520,
        height: 40,
      },
    ],
  });

  assert.equal(result.pageSummary.pageType, 'content');
});

test('buildHybridLayoutModel requests visual fallback for canvas-heavy modal pages', () => {
  const result = buildHybridLayoutModel({
    title: 'Verification',
    url: 'https://visual.example.com/challenge',
    viewport: { width: 1280, height: 720 },
    textSample: '',
    stats: {
      imageCount: 8,
      canvasCount: 1,
      modalCount: 1,
      textNodeCount: 0,
      interactiveCount: 1,
    },
    elements: [
      {
        role: 'button',
        tag: 'button',
        text: 'Verify',
        selectorHint: '.verify',
        clickable: true,
        x: 540,
        y: 470,
        width: 180,
        height: 48,
        zIndex: 200,
      },
    ],
    textBlocks: [],
  });

  assert.equal(result.visualHints.needsVisualFallback, true);
  assert.match(result.visualHints.reason, /canvas|visual|modal/i);
  assert.equal(result.regions.some((region) => region.name === 'modal'), true);
});

test('buildHybridLayoutModel clamps element bounding boxes to the viewport', () => {
  const result = buildHybridLayoutModel({
    title: 'Viewport clamp',
    url: 'https://ui.example.com/',
    viewport: { width: 100, height: 100 },
    textSample: 'Test',
    stats: {
      imageCount: 0,
      canvasCount: 0,
      modalCount: 0,
      textNodeCount: 1,
      interactiveCount: 1,
    },
    elements: [
      {
        role: 'button',
        tag: 'button',
        text: 'Huge button',
        selectorHint: '#huge',
        clickable: true,
        x: -50,
        y: -40,
        width: 400,
        height: 300,
        zIndex: 1,
      },
    ],
    textBlocks: [
      {
        text: 'Oversized text',
        x: 0,
        y: 0,
        width: 600,
        height: 200,
      },
    ],
  });

  assert.equal(result.elements.length, 1);
  assert.equal(result.elements[0].x, 0);
  assert.equal(result.elements[0].y, 0);
  assert.equal(result.elements[0].width, 100);
  assert.equal(result.elements[0].height, 100);

  assert.equal(result.textBlocks.length, 1);
  assert.equal(result.textBlocks[0].x, 0);
  assert.equal(result.textBlocks[0].y, 0);
  assert.equal(result.textBlocks[0].width, 100);
  assert.equal(result.textBlocks[0].height, 100);
});

test('buildHybridLayoutModel normalizes oversize feed boxes before region bucketing', () => {
  const result = buildHybridLayoutModel({
    title: '哔哩哔哩',
    url: 'https://www.bilibili.com/',
    viewport: { width: 1280, height: 720 },
    textSample: '首页 番剧 登录',
    stats: {
      imageCount: 26,
      canvasCount: 0,
      modalCount: 0,
      textNodeCount: 1,
      interactiveCount: 3,
    },
    elements: [
      {
        role: 'link',
        tag: 'a',
        text: '番剧',
        selectorHint: 'a.channel-link',
        clickable: true,
        x: -510,
        y: 172,
        width: 856,
        height: 404,
        zIndex: 0,
      },
      {
        role: 'link',
        tag: 'a',
        text: '社区中心',
        selectorHint: 'a.community-link',
        clickable: true,
        x: 945,
        y: 172,
        width: 275,
        height: 290,
        zIndex: 0,
      },
      {
        role: 'link',
        tag: 'a',
        text: '推荐视频',
        selectorHint: 'a.feed-card',
        clickable: true,
        x: 60,
        y: 172,
        width: 1140,
        height: 404,
        zIndex: 0,
      },
    ],
    textBlocks: [
      {
        text: '即便参加了最终试玩，我也无法窥见《红色沙漠》的全貌？！',
        x: 0,
        y: 255,
        width: 1280,
        height: 1696,
      },
    ],
  });

  assert.equal(result.regions.some((region) => region.name === 'footer'), false);
  assert.equal(result.regions.some((region) => region.name === 'main'), true);
  assert.equal(result.regions.some((region) => region.name === 'left-sidebar'), true);
  assert.equal(result.regions.some((region) => region.name === 'right-sidebar'), true);

  for (const region of result.regions) {
    assert.deepEqual(Object.keys(region.bbox).sort(), ['height', 'width', 'x', 'y']);
    assert.equal(region.bbox.x >= 0, true);
    assert.equal(region.bbox.y >= 0, true);
    assert.equal(region.bbox.x + region.bbox.width <= 1280, true);
    assert.equal(region.bbox.y + region.bbox.height <= 720, true);
  }
});
