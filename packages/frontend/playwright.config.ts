import { defineConfig, devices } from '@playwright/test';

const envOr = (key: string, fallback: string): string => {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:51973',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm run build && pnpm run preview --host 127.0.0.1 --port 51973',
    env: {
      ...process.env,
      VITE_DISCORD_CLIENT_ID: envOr('VITE_DISCORD_CLIENT_ID', 'discord-client-id'),
      VITE_REDIRECT_URL: envOr('VITE_REDIRECT_URL', 'http://127.0.0.1:51973/'),
      VITE_WALLETCONNECT_PROJECT_ID: envOr(
        'VITE_WALLETCONNECT_PROJECT_ID',
        'walletconnect-project-id',
      ),
      VITE_INFURA_API_KEY: envOr('VITE_INFURA_API_KEY', 'infura-api-key'),
    },
    url: 'http://127.0.0.1:51973',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
