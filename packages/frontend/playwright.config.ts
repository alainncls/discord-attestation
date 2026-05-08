import { defineConfig, devices } from '@playwright/test';

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
      VITE_DISCORD_CLIENT_ID: process.env.VITE_DISCORD_CLIENT_ID || 'discord-client-id',
      VITE_REDIRECT_URL: process.env.VITE_REDIRECT_URL || 'http://127.0.0.1:51973/',
      VITE_WALLETCONNECT_PROJECT_ID:
        process.env.VITE_WALLETCONNECT_PROJECT_ID || 'walletconnect-project-id',
      VITE_INFURA_API_KEY: process.env.VITE_INFURA_API_KEY || 'infura-api-key',
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
