// @vitest-environment-options {"url":"https://alainnicolas.fr/efrogs/?utm=secret"}
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('public/project-analytics.js', 'utf8');

describe('project analytics', () => {
  it('loads GA only after consent and removes query parameters from page views', () => {
    window.eval(source);
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    document.querySelector<HTMLButtonElement>('[data-accept]')?.click();
    expect(document.querySelector('script[src*="googletagmanager"]')).not.toBeNull();
    const data = (window as unknown as { dataLayer: unknown[] }).dataLayer;
    expect(JSON.stringify(data)).not.toContain('secret');
    expect(localStorage.getItem('analytics-consent')).toContain('accepted');
  });
});
