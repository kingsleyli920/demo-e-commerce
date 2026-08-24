import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '.env.local'), quiet: true });
loadEnv({ path: path.resolve(__dirname, '.env'), quiet: true });

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

type StorageStateObject = { cookies: never[]; origins: never[] };
export const STORAGE_STATE = {
  buyer: path.join(__dirname, 'playwright/.auth/buyer.json'),
  admin: path.join(__dirname, 'playwright/.auth/admin.json'),
  anonymous: { cookies: [], origins: [] } as StorageStateObject,
};

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.(spec|setup)\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'zh-CN',
  },
  webServer: {
    command: process.env.CI ? 'pnpm start' : 'pnpm dev', // CI 在前一步已 build
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE.buyer },
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.ts/,
    },
  ],
});
