import { expect, test, type Page } from '@playwright/test';

// This is a deterministic build test, not a live WalletConnect integration test.
// Only the observed read-only discovery endpoints are mocked. All console errors,
// failed requests and HTTP errors (including first-party assets) remain failures.
function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`);
  });
  page.on('requestfailed', (request) => {
    // WalletConnect's connectivity probes cancel a HEAD request after headers.
    // Exempt only that exact cancellation, never GET/assets or HTTP failures.
    if (
      request.method() === 'HEAD' &&
      request.url() === 'http://127.0.0.1:51973/' &&
      request.failure()?.errorText === 'net::ERR_ABORTED'
    )
      return;
    errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

async function mockWalletDiscovery(page: Page) {
  const calls = { wallets: 0, images: 0 };
  await page.route('https://api.web3modal.org/getWallets?*', async (route) => {
    calls.wallets++;
    await route.fulfill({ json: { data: [], count: 0 } });
  });
  await page.route('https://api.web3modal.org/public/getAssetImage/*', async (route) => {
    calls.images++;
    await route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    });
  });
  return calls;
}

test.describe('production build smoke', () => {
  test('renders the landing screen without runtime errors', async ({ page }) => {
    const runtimeErrors = captureRuntimeErrors(page);
    const mockedRequests = await mockWalletDiscovery(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Discord Attestation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login with Discord' })).toBeVisible();

    await page.getByRole('button', { name: 'Connect Wallet' }).click();
    await expect(page.locator('appkit-button')).toBeVisible();
    await expect(page.locator('body')).not.toHaveText('');
    await expect.poll(() => mockedRequests.wallets).toBeGreaterThan(0);
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
    expect(new URL(page.url()).searchParams.get('state')).toBeTruthy();

    const storageState = await context.storageState();
    const appStorage = storageState.origins.find(
      (origin) => origin.origin === 'http://127.0.0.1:51973',
    );
    expect(
      appStorage?.localStorage.find(
        (entry) => entry.name === 'discord-attestation:oauth-started:v1',
      )?.value,
    ).toBe('true');
    expect(
      appStorage?.localStorage.find((entry) => entry.name === 'discord-attestation:oauth-state:v1')
        ?.value,
    ).toBeTruthy();
  });
});

test('runtime monitor detects an unexpected application exception', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('deliberate-regression-probe');
    }, 0);
  });
  await expect
    .poll(() => errors.some((error) => error.includes('deliberate-regression-probe')))
    .toBe(true);
});

test('runtime monitor detects a missing first-party asset', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.route('**/assets/regression-probe.js', (route) =>
    route.fulfill({ status: 404, body: 'Not found' }),
  );
  await page.goto('/');
  await page.evaluate(() => fetch('/assets/regression-probe.js'));
  await expect
    .poll(() =>
      errors.some(
        (error) => error.includes('404') && error.includes('/assets/regression-probe.js'),
      ),
    )
    .toBe(true);
});
