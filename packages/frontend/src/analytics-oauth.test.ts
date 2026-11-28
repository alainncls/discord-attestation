// @vitest-environment-options {"url":"https://alainnicolas.fr/discord/?code=secret&state=secret"}
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('does not load analytics while an OAuth code is in the URL', () => {
  localStorage.setItem(
    'analytics-consent',
    JSON.stringify({ value: 'accepted', date: Date.now(), version: 1 }),
  );
  window.eval(readFileSync('public/project-analytics.js', 'utf8'));
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  history.replaceState({}, '', '/discord/');
  expect(document.querySelector('script[src*="googletagmanager"]')).not.toBeNull();
  expect(JSON.stringify((window as unknown as { dataLayer: unknown[] }).dataLayer)).not.toContain(
    'secret',
  );
});
