import { expect, test } from '@playwright/test';

test.describe('production build smoke', () => {
  test('renders the landing screen without runtime errors', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        runtimeErrors.push(message.text());
      }
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Discord Attestation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login with Discord' })).toBeVisible();
    await expect(page.locator('appkit-button')).toBeVisible();
    await expect(page.locator('body')).not.toHaveText('');
    expect(runtimeErrors).toEqual([]);
  });

  test('starts the Discord OAuth flow and records the pending login marker', async ({
    context,
    page,
  }) => {
    await page.route('https://discord.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<h1>Discord OAuth</h1>',
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Login with Discord' }).click();

    await expect(page).toHaveURL(/discord\.com\/api\/oauth2\/authorize/);
    expect(new URL(page.url()).searchParams.get('client_id')).toBeTruthy();

    const storageState = await context.storageState();
    const appStorage = storageState.origins.find(
      (origin) => origin.origin === 'http://127.0.0.1:4173',
    );
    expect(
      appStorage?.localStorage.find(
        (entry) => entry.name === 'discord-attestation:oauth-started:v1',
      )?.value,
    ).toBe('true');
  });
});
