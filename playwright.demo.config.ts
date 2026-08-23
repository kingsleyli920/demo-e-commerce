import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '.env.local'), quiet: true });

/** 录屏专用配置：pnpm exec playwright test --config playwright.demo.config.ts */
export default defineConfig({
  testDir: './tests/demo',
  timeout: 10 * 60_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${process.env.PORT ?? 3000}`,
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    launchOptions: { slowMo: 200 },
    actionTimeout: 15_000,
    locale: 'zh-CN',
  },
  webServer: {
    command: 'pnpm dev',
    url: `http://localhost:${process.env.PORT ?? 3000}`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [{ name: 'demo', use: { ...devices['Desktop Chrome'] } }],
});
