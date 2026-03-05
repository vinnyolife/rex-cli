import test from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';

import { detectChallengeRequired } from '../src/browser/auth.js';

interface MockPageOptions {
  url: string;
  title?: string;
  bodyText?: string;
  selectorCounts?: Record<string, number>;
}

function makePage(options: MockPageOptions): Page {
  const selectorCounts = options.selectorCounts ?? {};

  const page = {
    url: () => options.url,
    title: async () => options.title ?? '',
    evaluate: async () => options.bodyText ?? '',
    locator: (selector: string) => ({
      count: async () => selectorCounts[selector] ?? 0,
    }),
  };

  return page as unknown as Page;
}

test('detectChallengeRequired flags Cloudflare challenge pages', async () => {
  const page = makePage({
    url: 'https://example.com/cdn-cgi/challenge-platform/h/b/orchestrate/jsch/v1',
    title: 'Just a moment...',
    bodyText: 'Checking your browser before accessing example.com',
  });

  const result = await detectChallengeRequired(page);

  assert.equal(result.challengeDetected, true);
  assert.equal(result.challengeType, 'cloudflare');
  assert.equal(result.requiresHumanVerification, true);
  assert.match(result.reason, /challenge/i);
});

test('detectChallengeRequired flags Google unusual traffic gates', async () => {
  const page = makePage({
    url: 'https://www.google.com/sorry/index?continue=https://www.google.com/',
    title: 'About this page',
    bodyText: 'Our systems have detected unusual traffic from your computer network.',
  });

  const result = await detectChallengeRequired(page);

  assert.equal(result.challengeDetected, true);
  assert.equal(result.challengeType, 'google-risk');
  assert.equal(result.requiresHumanVerification, true);
  assert.equal(result.signals.length > 0, true);
});

test('detectChallengeRequired flags captcha widgets', async () => {
  const page = makePage({
    url: 'https://target.example/form',
    title: 'Submit form',
    selectorCounts: {
      'iframe[src*="recaptcha" i]': 1,
    },
  });

  const result = await detectChallengeRequired(page);

  assert.equal(result.challengeDetected, true);
  assert.equal(result.challengeType, 'captcha');
});

test('detectChallengeRequired returns no challenge on normal pages', async () => {
  const page = makePage({
    url: 'https://docs.example.com/home',
    title: 'Home',
    bodyText: 'Welcome to docs.',
  });

  const result = await detectChallengeRequired(page);

  assert.equal(result.challengeDetected, false);
  assert.equal(result.challengeType, 'none');
  assert.equal(result.requiresHumanVerification, false);
});
